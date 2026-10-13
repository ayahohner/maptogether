import {
  createToken,
  Lexer,
  CstParser,
  type ParserMethod,
  type CstNode,
  type TokenType,
  type ITokenConfig,
  type IRecognitionException,
  type IToken,
  EOF,
} from "chevrotain";

import XRegExp from "xregexp";

// Fragment dictionary
const f: { [key: string]: RegExp } = {};

// Create re-usable fragments using xRegExp
function FRAGMENT(name: string, def: string | RegExp) {
  f[name] = XRegExp.build(def as string, f);
}

// Create a pattern using previously defined fragments
// function MAKE_PATTERN(def: string, flags?: Flags) {
//   return XRegExp.build(def, f, flags);
// }

/**
 * Compose
 *
 * Return a fragment from the fragment dictionary in a composable form
 */

function C(name: string) {
  return f[name].source;
}

const createComposableToken = ({ name, pattern, ...args }: ITokenConfig): TokenType => {
  FRAGMENT(name, pattern as string | RegExp);
  return createToken({
    name,
    pattern: RegExp(pattern as string | RegExp),
    ...args,
  });
};

// define fragments
FRAGMENT("BaseWhitespace", " \\t");
FRAGMENT("Command", "\\/");
FRAGMENT("EdgeJoin", "\\.");
FRAGMENT("Assign", "=");
FRAGMENT("DefinitionSpecifier", ":");
FRAGMENT("FutureSpecifier", "\\^");
FRAGMENT("NoteSpecifier", "#");
FRAGMENT("QuoteSingle", "'");
FRAGMENT("QuoteDouble", '"');
FRAGMENT("Comma", ",");
FRAGMENT("ParenOpen", "\\(");
FRAGMENT("ParenClose", "\\)");
FRAGMENT("BraceOpen", "\\{");
FRAGMENT("BraceClose", "\\}");
FRAGMENT("BracketOpen", "\\[");
FRAGMENT("BracketClose", "\\]");
FRAGMENT("IdentifierSymbols", `'"~\`!@$%&\\*\\-_+\\|\\\\;\\?`);

// Strings
const StringLiteral = createComposableToken({
  name: "StringLiteral",
  pattern: `"(.*?)"|'(.*?)'`,
});

const Comment = createComposableToken({
  name: "Comment",
  pattern: `//.*`,
  group: Lexer.SKIPPED,
});

// Reserved Symbols
// gotta escape - / \ ^ $ * + ? . ( ) | [ ] { }
const Command = createComposableToken({
  name: "Command",
  pattern: "\\/[a-zA-Z][a-zA-Z0-9]*",
  longer_alt: Comment,
});
const EdgeJoin = createComposableToken({ name: "EdgeJoin", pattern: "\\." });
const Assign = createComposableToken({ name: "Assign", pattern: "=" });
const DefinitionSpecifier = createComposableToken({
  name: "DefinitionSpecifier",
  pattern: ":",
});
const AttributeSubvalueSpecifier = createComposableToken({
  name: "AttributeSubvalueSpecifier",
  pattern: ":",
});
const FutureSpecifier = createComposableToken({
  name: "FutureSpecifier",
  pattern: "\\^",
});
const NoteSpecifier = createComposableToken({
  name: "NoteSpecifier",
  pattern: "#",
});
const Comma = createComposableToken({
  name: "Comma",
  pattern: ",",
});
const ParenOpen = createComposableToken({
  name: "ParenOpen",
  pattern: "\\(",
  push_mode: "attribute_mode",
});
const ParenClose = createComposableToken({
  name: "ParenClose",
  pattern: "\\)",
  pop_mode: true,
});
const BraceOpen = createComposableToken({
  name: "BraceOpen",
  pattern: "\\{",
  push_mode: "normal_mode",
});
const BraceClose = createComposableToken({
  name: "BraceClose",
  pattern: "\\}",
  pop_mode: true,
});
const BracketOpen = createComposableToken({
  name: "BracketOpen",
  pattern: "\\[",
});
const BracketClose = createComposableToken({
  name: "BracketClose",
  pattern: "\\]",
});

// Skipped Symbols
const Newline = createComposableToken({
  name: "Newline",
  pattern: "\\r\\n|\\n",
  line_breaks: true,
  // group: Lexer.SKIPPED,
});
const Whitespace = createComposableToken({
  name: "Whitespace",
  pattern: `[${C("BaseWhitespace")}]+`,
  group: Lexer.SKIPPED,
});
const AttributeBreak = createComposableToken({
  name: "AttributeBreak",
  pattern: `[${C("BaseWhitespace")}\\r\\n]+`,
  line_breaks: true,
});

// Identifiers & Keywords
const AttributeIdentifier = createToken({
  name: "AttributeIdentifier",
  pattern: /[a-zA-Z_][a-zA-Z0-9-]*/,
});

const Identifier = createToken({
  name: "Identifier",
  // not // / . = : ^ ' " , ( ) { } [ ]
  pattern: new RegExp(
    `[a-zA-Z0-9${C("IdentifierSymbols")}]+([ ]+[a-zA-Z0-9${C("IdentifierSymbols")}]+)*`,
  ),
});

// Tokens are out of order because of longer_alt
const NumberLiteral = createToken({
  name: "NumberLiteral",
  pattern: /-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/,
  longer_alt: Identifier,
});

const AttributeNumberLiteral = createToken({
  name: "NumberLiteral",
  pattern: /-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/,
});

export const togetherTokens = {
  modes: {
    normal_mode: [
      Command,
      EdgeJoin,
      DefinitionSpecifier,
      FutureSpecifier,
      NoteSpecifier,
      // only because brackets with coords for now
      Comma,
      ParenOpen,
      BraceOpen,
      BraceClose,
      BracketOpen,
      BracketClose,

      Whitespace,
      Newline,
      Comment,

      // only because brackets with coords for now
      NumberLiteral,
      Identifier,
    ],
    attribute_mode: [
      Assign,
      AttributeSubvalueSpecifier,
      Comma,
      ParenClose,

      AttributeBreak,
      Comment,

      StringLiteral,
      AttributeNumberLiteral,
      AttributeIdentifier,
    ],
  },
  defaultMode: "normal_mode",

  // can match anything, have to come last
  // Name,
};

// ============== Lexer ===============
export const TogetherLexer = new Lexer(togetherTokens, {
  // Optimize position info for performance
  // positionTracking: "onlyStart",
  // Throw error if Lexer isn't able to use all optimizations
  // disabled because /[^]/ (Complement Sets) can't be optimized
  ensureOptimizations: true,
});

// ============== Parser ==============
class TogetherParser extends CstParser {
  public default!: ParserMethod<[], CstNode>;
  private statement!: ParserMethod<[], CstNode>;
  private command!: ParserMethod<[], CstNode>;
  private attributes!: ParserMethod<[], CstNode>;
  private attribute!: ParserMethod<[], CstNode>;
  private edgeDeclaration!: ParserMethod<[], CstNode>;
  private componentDeclaration!: ParserMethod<[], CstNode>;
  private pipeline!: ParserMethod<[], CstNode>;
  private coordinates!: ParserMethod<[], CstNode>;
  private note!: ParserMethod<[], CstNode>;

  constructor(tokens: typeof togetherTokens) {
    super(tokens, {
      // This can cause some problems
      // TODO: enable once debugged
      recoveryEnabled: false,
    });

    this.default = this.RULE("default", () => {
      this.MANY(() => {
        this.OR([
          { ALT: () => this.CONSUME(Newline) },
          { ALT: () => this.SUBRULE(this.statement) },
          { ALT: () => this.CONSUME(Comment) },
        ]);
      });
    });

    this.statement = this.RULE("statement", () => {
      this.OR({
        DEF: [
          { ALT: () => this.SUBRULE(this.command) },
          {
            GATE: this.BACKTRACK(this.edgeDeclaration),
            ALT: () => this.SUBRULE(this.edgeDeclaration),
          },
          {
            // GATE: $.BACKTRACK($.componentDeclaration), // Do we need this?
            ALT: () => this.SUBRULE(this.componentDeclaration),
          },
          { ALT: () => this.SUBRULE(this.note) },
        ],
        ERR_MSG: "a statement",
      });
      this.OR1({
        DEF: [{ ALT: () => this.CONSUME(Newline) }, { ALT: () => this.CONSUME(EOF) }],
        ERR_MSG: "a new line",
      });
    });

    this.command = this.RULE("command", () => {
      this.CONSUME(Command);
      this.OPTION(() => this.SUBRULE(this.attributes));
    });

    this.attributes = this.RULE("attributes", () => {
      this.CONSUME(ParenOpen);
      this.MANY(() => {
        this.OR([
          {
            ALT: () => this.SUBRULE(this.attribute),
          },
          {
            ALT: () => this.CONSUME(AttributeBreak),
          },
        ]);
      });
      this.CONSUME(ParenClose);
    });

    this.attribute = this.RULE("attribute", () => {
      this.CONSUME(AttributeIdentifier, { LABEL: "AttributeName" });
      this.OPTION(() => {
        this.CONSUME(Assign);
        this.OR([
          {
            ALT: () => {
              this.CONSUME1(AttributeNumberLiteral);
              this.OPTION1(() => {
                this.CONSUME(Comma);
                this.CONSUME2(AttributeNumberLiteral);
              });
            },
          },
          {
            ALT: () => {
              this.CONSUME(StringLiteral);
            },
          },
          {
            ALT: () => {
              this.AT_LEAST_ONE_SEP({
                SEP: Comma,
                DEF: () => {
                  this.CONSUME1(AttributeIdentifier);
                  this.OPTION2(() => {
                    this.CONSUME2(AttributeSubvalueSpecifier);
                    this.CONSUME3(AttributeNumberLiteral);
                  });
                },
              });
            },
          },
        ]);
      });
    });

    this.componentDeclaration = this.RULE("componentDeclaration", () => {
      this.CONSUME(Identifier);
      this.OPTION(() => {
        this.CONSUME(DefinitionSpecifier);
        this.CONSUME(NumberLiteral);
      });
      this.OPTION1(() => {
        this.SUBRULE(this.coordinates);
      });
      this.OPTION2(() => {
        this.SUBRULE(this.attributes);
      });
      this.OPTION3(() => {
        this.SUBRULE(this.pipeline);
      });
    });

    this.edgeDeclaration = this.RULE("edgeDeclaration", () => {
      this.CONSUME(Identifier, { LABEL: "LHS" });
      this.CONSUME(EdgeJoin);
      this.OPTION(() => this.SUBRULE(this.attributes));
      this.CONSUME1(Identifier, { LABEL: "RHS" });
    });

    this.pipeline = this.RULE("pipeline", () => {
      this.CONSUME(BraceOpen);
      // Blank lines are allowed anywhere inside, as at the top level.
      this.MANY(() => {
        this.OR([
          { ALT: () => this.CONSUME(Newline) },
          { ALT: () => this.SUBRULE(this.statement) },
        ]);
      });
      this.CONSUME(BraceClose);
    });

    this.coordinates = this.RULE("coordinates", () => {
      this.CONSUME(BracketOpen);
      this.CONSUME(NumberLiteral, { LABEL: "LHS" });
      this.OPTION1(() => this.CONSUME1(Whitespace));
      this.CONSUME(Comma);
      this.OPTION2(() => this.CONSUME2(Whitespace));
      this.CONSUME1(NumberLiteral, { LABEL: "RHS" });
      this.CONSUME(BracketClose);
    });

    this.note = this.RULE("note", () => {
      this.CONSUME(NoteSpecifier);
      this.CONSUME(Identifier);
      this.OPTION1(() => {
        this.SUBRULE(this.coordinates);
      });
    });

    // very important to call this after all the rules have been setup.
    // otherwise the parser may not work correctly as it will lack information
    // derived from the self analysis.
    this.performSelfAnalysis();
  }
}

const parserInstance = new TogetherParser(togetherTokens);

export const BaseTogetherVisitor = parserInstance.getBaseCstVisitorConstructor();

export interface ParseProblem {
  /** 1-based line number. */
  line: number;
  message: string;
}

export interface ParseResult {
  /** Undefined when the text couldn't be tokenized. */
  cst: CstNode | undefined;
  problems: ParseProblem[];
}

const isLine = (line: number | undefined): line is number => (line ?? 0) >= 1;

/** The line an error is on. End-of-input errors belong to the token before, or else the last line. */
const problemAt = (e: IRecognitionException): ParseProblem => {
  const previous = (e as { previousToken?: IToken }).previousToken?.startLine;
  const line = [e.token.startLine, previous].find(isLine) ?? Infinity;
  return { line, message: e.message };
};

/**
 * Parses map text. Reports every tokenizing error, or else the first parse
 * error (recovery is off), by line; see `parseLeniently` to get past them.
 */
export const tryParse = (text: string): ParseResult => {
  const tokenized = TogetherLexer.tokenize(text);
  if (tokenized.errors.length > 0) {
    const problems = tokenized.errors.map((e) => ({
      line: e.line ?? Infinity,
      message: e.message,
    }));
    return { cst: undefined, problems };
  }
  parserInstance.input = tokenized.tokens;
  const cst = parserInstance.default();
  return { cst, problems: parserInstance.errors.map(problemAt) };
};

// Disabled until implement AST
// export function parseToAST(text: string) {
//   const visitorInstance = new WardleyVisitorToAST();
//   return visitorInstance.visit(parseToCST(text)) as WardleyASTT;
// }

/* ============ Regexes ============ */
function escapeRegex(string: string) {
  return string.replace(/[/\\^$*+?.()|[\]{}]/g, "\\$&"); // Note: removed '-' as it creates invalid escapes?
}

// $.componentDeclaration = $.RULE("componentDeclaration", () => {
//   $.CONSUME(Identifier);
//   $.OPTION(() => {
//     $.CONSUME(DefinitionSpecifier);
//     $.CONSUME(NumberLiteral);
//   });
//   $.OPTION1(() => {
//     $.SUBRULE($.coordinates);
//   });
//   $.OPTION2(() => {
//     $.SUBRULE($.attributes);
//   });
//   $.OPTION3(() => {
//     $.SUBRULE($.pipeline);
//   });
// });

/**
 * matchComponentRegex
 * Capture Groups
 * - 0: everything
 * - 1: Whitespace (optional)
 * - 2: component name
 * - 3: DefinitionSpecifier (optional)
 * - 4: Whitespace (optional)
 * - 5: Coordinates (optional)
 * - 6: Whitespace (optional)
 * - 7: Attributes (optional)
 * - 8: Whitespace (optional)
 * - 9: Pipeline (optional)
 * - 10: Whitespace (optional)
 * - 11: Comment (optional)
 *
 */
export const matchComponentRegex = (componentName: string) => {
  return [
    `^(${C("Whitespace")})?`,
    `(${escapeRegex(componentName)})`,
    `(${C("DefinitionSpecifier")}\\d+)?`,
    `(${C("Whitespace")})?`,
    `(${C("BracketOpen")}.+${C("BracketClose")})?`,
    `(${C("Whitespace")})?`,
    `(${C("ParenOpen")}[^${C("ParenClose")}]*$|${C("ParenOpen")}.*?${C("ParenClose")})?`,
    `(${C("Whitespace")})?`,
    `(${C("BraceOpen")}[^${C("BraceClose")}]*$|${C("BraceOpen")}.*?${C("BraceClose")})?`,
    `(${C("Whitespace")})?`,
    `(${C("Comment")})?$`,
  ].join("");
};

export const matchEdgeRegex = (edgeComponentName: string) => {
  return [
    `^(${C("Whitespace")})?(${escapeRegex(edgeComponentName)})(${C("Whitespace")})?\\.(.*)$`,
    `|(.*?)(\\.(${C("ParenOpen")}.*?${C("ParenClose")})?|\\))(${C(
      "Whitespace",
    )})?(${escapeRegex(edgeComponentName)})(${C("Whitespace")})?(${C("Comment")})?$`,
  ].join("");
};

/** A line that is just the link between `a` and `b`, written either way round. */
export const matchEdgeBetweenRegex = (a: string, b: string) => {
  const ws = `(?:${C("Whitespace")})?`;
  const link = (from: string, to: string) =>
    `${escapeRegex(from)}${ws}\\.(?:${C("ParenOpen")}.*?${C("ParenClose")})?${ws}${escapeRegex(to)}`;
  return `^${ws}(?:${link(a, b)}|${link(b, a)})${ws}(?:${C("Comment")})?$`;
};

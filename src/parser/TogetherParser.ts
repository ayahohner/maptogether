import {
  createToken,
  Lexer,
  CstParser,
  ParserMethod,
  CstNode,
  TokenType,
  ITokenConfig,
  IRecognitionException,
  IToken,
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

const createComposableToken = ({
  name,
  pattern,
  ...args
}: ITokenConfig): TokenType => {
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
  pattern: `\/\/.*`,
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
    `[a-zA-Z0-9${C("IdentifierSymbols")}]+([ ]+[a-zA-Z0-9${C(
      "IdentifierSymbols"
    )}]+)*`
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

    // shorthand for easier writing and comprehension
    const $ = this;

    $.default = $.RULE("default", () => {
      $.MANY(() => {
        $.OR([
          { ALT: () => $.CONSUME(Newline) },
          { ALT: () => $.SUBRULE($.statement) },
          { ALT: () => $.CONSUME(Comment) },
        ]);
      });
    });

    $.statement = $.RULE("statement", () => {
      $.OR({
        DEF: [
          { ALT: () => $.SUBRULE($.command) },
          {
            GATE: $.BACKTRACK($.edgeDeclaration),
            ALT: () => $.SUBRULE($.edgeDeclaration),
          },
          {
            // GATE: $.BACKTRACK($.componentDeclaration), // Do we need this?
            ALT: () => $.SUBRULE($.componentDeclaration),
          },
          { ALT: () => $.SUBRULE($.note) },
        ],
        ERR_MSG: "a statement",
      });
      $.OR1({
        DEF: [{ ALT: () => $.CONSUME(Newline) }, { ALT: () => $.CONSUME(EOF) }],
        ERR_MSG: "a new line",
      });
    });

    $.command = $.RULE("command", () => {
      $.CONSUME(Command);
      $.OPTION(() => $.SUBRULE($.attributes));
    });

    $.attributes = $.RULE("attributes", () => {
      $.CONSUME(ParenOpen);
      $.MANY(() => {
        $.OR([
          {
            ALT: () => $.SUBRULE($.attribute),
          },
          {
            ALT: () => $.CONSUME(AttributeBreak),
          },
        ]);
      });
      $.CONSUME(ParenClose);
    });

    $.attribute = $.RULE("attribute", () => {
      $.CONSUME(AttributeIdentifier, { LABEL: "AttributeName" });
      $.OPTION(() => {
        $.CONSUME(Assign);
        $.OR([
          {
            ALT: () => {
              $.CONSUME1(AttributeNumberLiteral);
              $.OPTION1(() => {
                $.CONSUME(Comma);
                $.CONSUME2(AttributeNumberLiteral);
              });
            },
          },
          {
            ALT: () => {
              $.CONSUME(StringLiteral);
            },
          },
          {
            ALT: () => {
              $.AT_LEAST_ONE_SEP({
                SEP: Comma,
                DEF: () => {
                  $.CONSUME1(AttributeIdentifier);
                  $.OPTION2(() => {
                    $.CONSUME2(AttributeSubvalueSpecifier);
                    $.CONSUME3(AttributeNumberLiteral);
                  });
                },
              });
            },
          },
        ]);
      });
    });

    $.componentDeclaration = $.RULE("componentDeclaration", () => {
      $.CONSUME(Identifier);
      $.OPTION(() => {
        $.CONSUME(DefinitionSpecifier);
        $.CONSUME(NumberLiteral);
      });
      $.OPTION1(() => {
        $.SUBRULE($.coordinates);
      });
      $.OPTION2(() => {
        $.SUBRULE($.attributes);
      });
      $.OPTION3(() => {
        $.SUBRULE($.pipeline);
      });
    });

    $.edgeDeclaration = $.RULE("edgeDeclaration", () => {
      $.CONSUME(Identifier, { LABEL: "LHS" });
      $.CONSUME(EdgeJoin);
      $.OPTION(() => $.SUBRULE($.attributes));
      $.CONSUME1(Identifier, { LABEL: "RHS" });
    });

    $.pipeline = $.RULE("pipeline", () => {
      $.CONSUME(BraceOpen);
      // Blank lines are allowed anywhere inside, as at the top level.
      $.MANY(() => {
        $.OR([
          { ALT: () => $.CONSUME(Newline) },
          { ALT: () => $.SUBRULE($.statement) },
        ]);
      });
      $.CONSUME(BraceClose);
    });

    $.coordinates = $.RULE("coordinates", () => {
      $.CONSUME(BracketOpen);
      $.CONSUME(NumberLiteral, { LABEL: "LHS" });
      $.OPTION1(() => $.CONSUME1(Whitespace));
      $.CONSUME(Comma);
      $.OPTION2(() => $.CONSUME2(Whitespace));
      $.CONSUME1(NumberLiteral, { LABEL: "RHS" });
      $.CONSUME(BracketClose);
    });

    $.note = $.RULE("note", () => {
      $.CONSUME(NoteSpecifier);
      $.CONSUME(Identifier);
      $.OPTION1(() => {
        $.SUBRULE($.coordinates);
      });
    });

    // very important to call this after all the rules have been setup.
    // otherwise the parser may not work correctly as it will lack information
    // derived from the self analysis.
    this.performSelfAnalysis();
  }
}

const parserInstance = new TogetherParser(togetherTokens);

export const BaseTogetherVisitor =
  parserInstance.getBaseCstVisitorConstructor();

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
    const problems = tokenized.errors.map((e) => ({ line: e.line ?? Infinity, message: e.message }));
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
  return string.replace(/[\/\\^$*+?.()|[\]{}]/g, "\\$&"); // Note: removed '-' as it creates invalid escapes?
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
    `(${C("ParenOpen")}[^${C("ParenClose")}]*$|${C("ParenOpen")}.*?${C(
      "ParenClose"
    )})?`,
    `(${C("Whitespace")})?`,
    `(${C("BraceOpen")}[^${C("BraceClose")}]*$|${C("BraceOpen")}.*?${C(
      "BraceClose"
    )})?`,
    `(${C("Whitespace")})?`,
    `(${C("Comment")})?$`,
  ].join("");
};

export const matchEdgeRegex = (edgeComponentName: string) => {
  return [
    `^(${C("Whitespace")})?(${escapeRegex(edgeComponentName)})(${C(
      "Whitespace"
    )})?\\.(.*)$`,
    `|(.*?)(\\.(${C("ParenOpen")}.*?${C("ParenClose")})?|\\))(${C(
      "Whitespace"
    )})?(${escapeRegex(edgeComponentName)})(${C("Whitespace")})?(${C(
      "Comment"
    )})?$`,
  ].join("");
};

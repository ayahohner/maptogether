import {
  createToken,
  Lexer,
  CstParser,
  ParserMethod,
  CstNode,
  TokenTypeDictionary,
} from "chevrotain";

// ================ Types ================
type CoordinatesASTT = [number, number] | undefined;

interface ComponentDeclarationASTT {
  type: "componentDeclaration";
  componentName: string;
  coordinates: CoordinatesASTT;
}

interface EdgeDeclarationASTT {
  type: "edgeDeclaration";
  lhs: string;
  rhs: string;
}

type DeclarationASTT = ComponentDeclarationASTT | EdgeDeclarationASTT;

export type WardleyASTT = DeclarationASTT[];

// ================ Tokens ================
const Component = createToken({ name: "Component", pattern: /component/ });
const Pipeline = createToken({ name: "Pipeline", pattern: /pipeline/ });
const Inertia = createToken({ name: "Inertia", pattern: /inertia/ });
const Edge = createToken({ name: "Edge", pattern: /->/, label: "'->'" });
const Comment = createToken({
  name: "Comment",
  pattern: /\/\/[^\n\r]*/,
  group: Lexer.SKIPPED,
});

const LSquare = createToken({
  name: "LSquare",
  pattern: /\[/,
  label: "'['",
});
const RSquare = createToken({
  name: "RSquare",
  pattern: /]/,
  label: "']'",
});
const Comma = createToken({ name: "Comma", pattern: /,/, label: "','" });

const NewLine = createToken({
  name: "NewLine",
  pattern: /\r?\n+/,
  line_breaks: true,
});

// TODO: string literal starting with a number matches numberliteral, need to do lookahead
const StringLiteral = createToken({
  name: "StringLiteral",
  pattern:
    /[a-zA-Z0-9_\+:\?!@#$%^&\*\(\)\{\}\/\`~]+([ -]+[a-zA-Z0-9_\+:\?!@#$%^&\*\(\)\{\}\/\`~]+)*/,
});

const NumberLiteral = createToken({
  name: "NumberLiteral",
  pattern: /-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/,
});

const Whitespace = createToken({
  name: "Whitespace",
  pattern: /[ \t]+/,
  // group: Lexer.SKIPPED,
});

const SkippedWhitespace = createToken({
  name: "SkippedWhitespace",
  pattern: /[ \t]{1,}/,
  group: Lexer.SKIPPED,
});

// BUG: Object may introduce different ordering (unlikely after ES2015)
const wardleyTokensMap = {
  Component,
  Pipeline,
  Inertia,
  Edge,
  LSquare,
  RSquare,
  Comma,
  Comment,
  NumberLiteral,
  StringLiteral,
  NewLine,
  Whitespace,
  SkippedWhitespace,
} as TokenTypeDictionary;

// ============== Lexer ===============
const WardleyLexer = new Lexer(Object.values(wardleyTokensMap), {
  // Optimize position info for performance
  // positionTracking: "onlyStart",
  // Throw error if Lexer isn't able to use all optimizations
  ensureOptimizations: true,
});

// ============== Parser ==============
class WardleyParser extends CstParser {
  public wardley!: ParserMethod<[], CstNode>;
  private declaration!: ParserMethod<[], CstNode>;
  private edgeDeclaration!: ParserMethod<[], CstNode>;
  private pipelineDeclaration!: ParserMethod<[], CstNode>;
  private componentDeclaration!: ParserMethod<[], CstNode>;
  private coordinates!: ParserMethod<[], CstNode>;
  private t: TokenTypeDictionary;

  constructor(wardleyTokensMap: TokenTypeDictionary) {
    super(Object.values(wardleyTokensMap), {
      // This can cause some problems
      recoveryEnabled: true,
    });

    this.t = wardleyTokensMap;

    // shorthand for easier writing and comprehension
    const $ = this;
    const t = this.t;

    $.wardley = $.RULE("wardley", () => {
      $.MANY(() => {
        $.OR([
          { ALT: () => $.CONSUME(t.Comment) },
          { ALT: () => $.SUBRULE($.declaration) },
          { ALT: () => $.CONSUME(t.NewLine) },
          { ALT: () => $.CONSUME(t.Whitespace) },
        ]);
      });
    });

    $.declaration = $.RULE("declaration", () => {
      $.OR([
        { ALT: () => $.SUBRULE($.componentDeclaration) },
        { ALT: () => $.SUBRULE($.pipelineDeclaration) },
        { ALT: () => $.SUBRULE($.edgeDeclaration) },
      ]);
      $.OPTION(() => $.CONSUME(t.Whitespace));
    });

    $.componentDeclaration = $.RULE("componentDeclaration", () => {
      $.CONSUME(t.Component);
      $.CONSUME(t.Whitespace);
      $.CONSUME(t.StringLiteral);
      $.OPTION(() => $.CONSUME2(t.Whitespace));
      $.OPTION1(() => $.SUBRULE($.coordinates));
    });

    $.pipelineDeclaration = $.RULE("pipelineDeclaration", () => {
      $.CONSUME(t.Pipeline);
      $.CONSUME(t.Whitespace);
      $.CONSUME(t.StringLiteral);
      $.OPTION(() => $.CONSUME2(t.Whitespace));
      $.OPTION1(() => $.SUBRULE($.coordinates));
    });

    $.edgeDeclaration = $.RULE("edgeDeclaration", () => {
      $.CONSUME(t.StringLiteral, { LABEL: "LHS" });
      $.OPTION(() => $.CONSUME(t.Whitespace));
      $.CONSUME(t.Edge);
      $.OPTION1(() => $.CONSUME1(t.Whitespace));
      $.CONSUME1(t.StringLiteral, { LABEL: "RHS" });
    });

    $.coordinates = $.RULE("coordinates", () => {
      $.CONSUME(t.LSquare);
      $.OPTION(() => $.CONSUME(t.Whitespace));
      $.CONSUME(t.NumberLiteral, { LABEL: "LHS" });
      $.OPTION1(() => $.CONSUME1(t.Whitespace));
      $.CONSUME(t.Comma);
      $.OPTION2(() => $.CONSUME2(t.Whitespace));
      $.CONSUME1(t.NumberLiteral, { LABEL: "RHS" });
      $.OPTION3(() => $.CONSUME3(t.Whitespace));
      $.CONSUME(t.RSquare);
    });
    // very important to call this after all the rules have been setup.
    // otherwise the parser may not work correctly as it will lack information
    // derived from the self analysis.
    this.performSelfAnalysis();
  }
}

const parserInstance = new WardleyParser(wardleyTokensMap);

export const BaseWardleyVisitor = parserInstance.getBaseCstVisitorConstructor();

class WardleyVisitorToAST extends BaseWardleyVisitor {
  constructor() {
    super();
    // The "validateVisitor" method is a helper utility which performs static analysis
    // to detect missing or redundant visitor methods
    this.validateVisitor();
  }
  /* Visit methods */
  wardley(ctx: any) {
    if (ctx.declaration) {
      return ctx.declaration.map((dec: any) => this.visit(dec));
    } else {
      return [];
    }
  }

  declaration(ctx: any) {
    let dec = undefined;
    if (ctx.componentDeclaration) {
      dec = this.visit(ctx.componentDeclaration[0]);
    } else if (ctx.pipelineDeclaration) {
      dec = this.visit(ctx.pipelineDeclaration[0]);
    } else if (ctx.edgeDeclaration) {
      dec = this.visit(ctx.edgeDeclaration[0]);
    }
    return dec;
  }

  componentDeclaration(ctx: any) {
    let coordinates = undefined;
    if (ctx.coordinates) {
      coordinates = this.visit(ctx.coordinates[0]);
    }
    return {
      type: "componentDeclaration",
      componentName: ctx.StringLiteral[0].image,
      coordinates,
    };
  }

  pipelineDeclaration(ctx: any) {
    let coordinates = undefined;
    if (ctx.coordinates) {
      coordinates = this.visit(ctx.coordinates[0]);
    }
    return {
      type: "pipelineDeclaration",
      componentName: ctx.StringLiteral[0].image,
      coordinates,
    };
  }

  edgeDeclaration(ctx: any) {
    return {
      type: "edgeDeclaration",
      lhs: ctx.LHS[0].image,
      rhs: ctx.RHS[0].image,
    };
  }

  coordinates(ctx: any) {
    return [Number(ctx.LHS[0].image), Number(ctx.RHS[0].image)];
  }
}

export function parseToCST(text: string) {
  // Initiate parse from top level aka default rule ("wardley")
  parserInstance.input = WardleyLexer.tokenize(text).tokens;
  const cst = parserInstance.wardley();

  if (parserInstance.errors.length > 0) {
    const err = parserInstance.errors[0];

    throw new Error(
      `Error: ${err.name} at line ${err.token.startLine} col ${
        err.token.startColumn
      }\n${err.stack!}`,
    );
  }

  return cst;
}

export function parseToAST(text: string) {
  const visitorInstance = new WardleyVisitorToAST();
  return visitorInstance.visit(parseToCST(text)) as WardleyASTT;
}

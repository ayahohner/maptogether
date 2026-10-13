import {
  createToken,
  Lexer,
  CstParser,
  type ParserMethod,
  type CstNode,
  type TokenTypeDictionary,
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
  pattern: /[a-zA-Z0-9_+:?!@#$%^&*(){}/`~]+([ -]+[a-zA-Z0-9_+:?!@#$%^&*(){}/`~]+)*/,
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
    const t = this.t;

    this.wardley = this.RULE("wardley", () => {
      this.MANY(() => {
        this.OR([
          { ALT: () => this.CONSUME(t.Comment) },
          { ALT: () => this.SUBRULE(this.declaration) },
          { ALT: () => this.CONSUME(t.NewLine) },
          { ALT: () => this.CONSUME(t.Whitespace) },
        ]);
      });
    });

    this.declaration = this.RULE("declaration", () => {
      this.OR([
        { ALT: () => this.SUBRULE(this.componentDeclaration) },
        { ALT: () => this.SUBRULE(this.pipelineDeclaration) },
        { ALT: () => this.SUBRULE(this.edgeDeclaration) },
      ]);
      this.OPTION(() => this.CONSUME(t.Whitespace));
    });

    this.componentDeclaration = this.RULE("componentDeclaration", () => {
      this.CONSUME(t.Component);
      this.CONSUME(t.Whitespace);
      this.CONSUME(t.StringLiteral);
      this.OPTION(() => this.CONSUME2(t.Whitespace));
      this.OPTION1(() => this.SUBRULE(this.coordinates));
    });

    this.pipelineDeclaration = this.RULE("pipelineDeclaration", () => {
      this.CONSUME(t.Pipeline);
      this.CONSUME(t.Whitespace);
      this.CONSUME(t.StringLiteral);
      this.OPTION(() => this.CONSUME2(t.Whitespace));
      this.OPTION1(() => this.SUBRULE(this.coordinates));
    });

    this.edgeDeclaration = this.RULE("edgeDeclaration", () => {
      this.CONSUME(t.StringLiteral, { LABEL: "LHS" });
      this.OPTION(() => this.CONSUME(t.Whitespace));
      this.CONSUME(t.Edge);
      this.OPTION1(() => this.CONSUME1(t.Whitespace));
      this.CONSUME1(t.StringLiteral, { LABEL: "RHS" });
    });

    this.coordinates = this.RULE("coordinates", () => {
      this.CONSUME(t.LSquare);
      this.OPTION(() => this.CONSUME(t.Whitespace));
      this.CONSUME(t.NumberLiteral, { LABEL: "LHS" });
      this.OPTION1(() => this.CONSUME1(t.Whitespace));
      this.CONSUME(t.Comma);
      this.OPTION2(() => this.CONSUME2(t.Whitespace));
      this.CONSUME1(t.NumberLiteral, { LABEL: "RHS" });
      this.OPTION3(() => this.CONSUME3(t.Whitespace));
      this.CONSUME(t.RSquare);
    });
    // very important to call this after all the rules have been setup.
    // otherwise the parser may not work correctly as it will lack information
    // derived from the self analysis.
    this.performSelfAnalysis();
  }
}

const parserInstance = new WardleyParser(wardleyTokensMap);

const BaseWardleyVisitor = parserInstance.getBaseCstVisitorConstructor();

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
    let dec: unknown;
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
    let coordinates: unknown;
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
    let coordinates: unknown;
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

function parseToCST(text: string) {
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

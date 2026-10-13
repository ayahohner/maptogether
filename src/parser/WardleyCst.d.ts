// Generated from the grammar by cst.test.ts. After changing it, run `vitest -u`.
import type { CstNode, ICstVisitor, IToken } from "chevrotain";

export interface WardleyCstNode extends CstNode {
  name: "wardley";
  children: WardleyCstChildren;
}

export type WardleyCstChildren = {
  Comment?: IToken[];
  declaration?: DeclarationCstNode[];
  NewLine?: IToken[];
  Whitespace?: IToken[];
};

export interface DeclarationCstNode extends CstNode {
  name: "declaration";
  children: DeclarationCstChildren;
}

export type DeclarationCstChildren = {
  componentDeclaration?: ComponentDeclarationCstNode[];
  pipelineDeclaration?: PipelineDeclarationCstNode[];
  edgeDeclaration?: EdgeDeclarationCstNode[];
  Whitespace?: IToken[];
};

export interface ComponentDeclarationCstNode extends CstNode {
  name: "componentDeclaration";
  children: ComponentDeclarationCstChildren;
}

export type ComponentDeclarationCstChildren = {
  Component: IToken[];
  Whitespace: (IToken)[];
  StringLiteral: IToken[];
  coordinates?: CoordinatesCstNode[];
};

export interface PipelineDeclarationCstNode extends CstNode {
  name: "pipelineDeclaration";
  children: PipelineDeclarationCstChildren;
}

export type PipelineDeclarationCstChildren = {
  Pipeline: IToken[];
  Whitespace: (IToken)[];
  StringLiteral: IToken[];
  coordinates?: CoordinatesCstNode[];
};

export interface EdgeDeclarationCstNode extends CstNode {
  name: "edgeDeclaration";
  children: EdgeDeclarationCstChildren;
}

export type EdgeDeclarationCstChildren = {
  LHS: IToken[];
  Whitespace?: (IToken)[];
  Edge: IToken[];
  RHS: IToken[];
};

export interface CoordinatesCstNode extends CstNode {
  name: "coordinates";
  children: CoordinatesCstChildren;
}

export type CoordinatesCstChildren = {
  LSquare: IToken[];
  Whitespace?: (IToken)[];
  LHS: IToken[];
  Comma: IToken[];
  RHS: IToken[];
  RSquare: IToken[];
};

export interface ICstNodeVisitor<IN, OUT> extends ICstVisitor<IN, OUT> {
  wardley(children: WardleyCstChildren, param?: IN): OUT;
  declaration(children: DeclarationCstChildren, param?: IN): OUT;
  componentDeclaration(children: ComponentDeclarationCstChildren, param?: IN): OUT;
  pipelineDeclaration(children: PipelineDeclarationCstChildren, param?: IN): OUT;
  edgeDeclaration(children: EdgeDeclarationCstChildren, param?: IN): OUT;
  coordinates(children: CoordinatesCstChildren, param?: IN): OUT;
}

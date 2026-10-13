// Generated from the grammar by cst.test.ts. After changing it, run `vitest -u`.
import type { CstNode, ICstVisitor, IToken } from "chevrotain";

export interface DefaultCstNode extends CstNode {
  name: "default";
  children: DefaultCstChildren;
}

export type DefaultCstChildren = {
  Newline?: IToken[];
  statement?: StatementCstNode[];
  Comment?: IToken[];
};

export interface StatementCstNode extends CstNode {
  name: "statement";
  children: StatementCstChildren;
}

export type StatementCstChildren = {
  command?: CommandCstNode[];
  edgeDeclaration?: EdgeDeclarationCstNode[];
  componentDeclaration?: ComponentDeclarationCstNode[];
  note?: NoteCstNode[];
  Newline?: IToken[];
  EOF?: IToken[];
};

export interface CommandCstNode extends CstNode {
  name: "command";
  children: CommandCstChildren;
}

export type CommandCstChildren = {
  Command: IToken[];
  attributes?: AttributesCstNode[];
};

export interface AttributesCstNode extends CstNode {
  name: "attributes";
  children: AttributesCstChildren;
}

export type AttributesCstChildren = {
  ParenOpen: IToken[];
  attribute?: AttributeCstNode[];
  AttributeBreak?: IToken[];
  ParenClose: IToken[];
};

export interface AttributeCstNode extends CstNode {
  name: "attribute";
  children: AttributeCstChildren;
}

export type AttributeCstChildren = {
  AttributeName: IToken[];
  Assign?: IToken[];
  NumberLiteral?: (IToken)[];
  Comma?: (IToken)[];
  StringLiteral?: IToken[];
  AttributeIdentifier?: IToken[];
  AttributeSubvalueSpecifier?: IToken[];
};

export interface ComponentDeclarationCstNode extends CstNode {
  name: "componentDeclaration";
  children: ComponentDeclarationCstChildren;
}

export type ComponentDeclarationCstChildren = {
  Identifier: IToken[];
  DefinitionSpecifier?: IToken[];
  NumberLiteral?: IToken[];
  coordinates?: CoordinatesCstNode[];
  attributes?: AttributesCstNode[];
  pipeline?: PipelineCstNode[];
};

export interface EdgeDeclarationCstNode extends CstNode {
  name: "edgeDeclaration";
  children: EdgeDeclarationCstChildren;
}

export type EdgeDeclarationCstChildren = {
  LHS: IToken[];
  EdgeJoin: IToken[];
  attributes?: AttributesCstNode[];
  RHS: IToken[];
};

export interface PipelineCstNode extends CstNode {
  name: "pipeline";
  children: PipelineCstChildren;
}

export type PipelineCstChildren = {
  BraceOpen: IToken[];
  Newline?: IToken[];
  statement?: StatementCstNode[];
  BraceClose: IToken[];
};

export interface CoordinatesCstNode extends CstNode {
  name: "coordinates";
  children: CoordinatesCstChildren;
}

export type CoordinatesCstChildren = {
  BracketOpen: IToken[];
  LHS: IToken[];
  Whitespace?: (IToken)[];
  Comma: IToken[];
  RHS: IToken[];
  BracketClose: IToken[];
};

export interface NoteCstNode extends CstNode {
  name: "note";
  children: NoteCstChildren;
}

export type NoteCstChildren = {
  NoteSpecifier: IToken[];
  Identifier: IToken[];
  coordinates?: CoordinatesCstNode[];
};

export interface ICstNodeVisitor<IN, OUT> extends ICstVisitor<IN, OUT> {
  default(children: DefaultCstChildren, param?: IN): OUT;
  statement(children: StatementCstChildren, param?: IN): OUT;
  command(children: CommandCstChildren, param?: IN): OUT;
  attributes(children: AttributesCstChildren, param?: IN): OUT;
  attribute(children: AttributeCstChildren, param?: IN): OUT;
  componentDeclaration(children: ComponentDeclarationCstChildren, param?: IN): OUT;
  edgeDeclaration(children: EdgeDeclarationCstChildren, param?: IN): OUT;
  pipeline(children: PipelineCstChildren, param?: IN): OUT;
  coordinates(children: CoordinatesCstChildren, param?: IN): OUT;
  note(children: NoteCstChildren, param?: IN): OUT;
}

/** What an importer returns: the map in the current syntax, and what it couldn't carry over. */
export interface ImportResult {
  text: string;
  /** 1-based line numbers in the imported text. */
  problems: { line: number; message: string }[];
}

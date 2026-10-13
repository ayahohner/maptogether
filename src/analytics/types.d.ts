interface Heap {
  track: (event: string, properties?: Record<string, unknown>) => void;
  identify: (identity: string) => void;
  resetIdentity: () => void;
  addUserProperties: (properties: Record<string, unknown>) => void;
  addEventProperties: (properties: Record<string, unknown>) => void;
  removeEventProperty: (property: string) => void;
  clearEventProperties: () => void;
  appid: string;
  userId: string;
  identity: string | null;
  config: unknown;
}

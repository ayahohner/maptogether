import type { Awareness } from "y-protocols/awareness";
import { proxy } from "valtio/vanilla";
import type { SyncStatus } from "./SaveStatus";

export interface ConnectedUser {
  id: number;
  name: string;
  color: string;
  self: boolean;
}

/** "draft": a new map that isn't saved or shared until someone edits it. */
export type CollaborationStatus = SyncStatus | "draft";

export const collaboration = proxy<{
  status: CollaborationStatus;
  users: ConnectedUser[];
}>({
  status: "connecting",
  users: [],
});

/** A user from their awareness state, which any peer can set to anything. */
export function readUser(id: number, value: unknown, localId: number): ConnectedUser {
  const { name, color } = (value as { user?: Record<string, unknown> } | null)?.user ?? {};
  return {
    id,
    name: typeof name === "string" ? name.slice(0, 80) : "Anonymous",
    color: typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color) ? color : "#666666",
    self: id === localId,
  };
}

export function bindPresence(awareness: Awareness) {
  const update = () => {
    const users = [...awareness.getStates()].map(([id, value]) =>
      readUser(id, value, awareness.clientID),
    );
    users.sort((a, b) => Number(b.self) - Number(a.self) || a.id - b.id);
    // Pointer movement must not rerender the menu.
    if (JSON.stringify(users) !== JSON.stringify(collaboration.users)) collaboration.users = users;
  };
  awareness.on("change", update);
  update();
  return () => awareness.off("change", update);
}

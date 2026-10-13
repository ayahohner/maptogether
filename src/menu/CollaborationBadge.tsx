import { useEffect, useId, useRef, useState } from "react";
import { useSnapshot } from "valtio";
import { collaboration, type CollaborationStatus } from "../sync/presence";

const labels: Record<CollaborationStatus, string> = {
  draft: "Not saved yet: edit the map or share it to save it",
  connecting: "Connecting…",
  saving: "Saving changes…",
  saved: "Saved",
  disconnected: "Disconnected — waiting to reconnect",
  error: "Save or connection error — retrying",
};

export function CollaborationBadge() {
  const { users, status } = useSnapshot(collaboration);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, []);
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hovering shows the same list that focusing the indicator does.
    <div
      ref={root}
      className="collaboration-badge"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      {/* biome-ignore lint/a11y/useSemanticElements: a fieldset groups form fields. */}
      <span
        className="collaboration-indicator"
        role="group"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: focus shows who is on the map, for keyboard users.
        tabIndex={0}
        aria-describedby={open ? id : undefined}
        aria-label="People"
        title={labels[status]}
        onFocus={() => setOpen(true)}
      >
        <SyncLight status={status} />
        <span>{users.length}</span>
      </span>
      {open && <PeopleList id={id} users={users} />}
    </div>
  );
}

function SyncLight({ status }: { status: CollaborationStatus }) {
  return <span className={`sync-light sync-${status}`} role="img" aria-label={labels[status]} />;
}

function PeopleList({
  id,
  users,
}: {
  id: string;
  users: readonly { id: number; name: string; color: string }[];
}) {
  return (
    <div id={id} className="collaboration-popover">
      <ul>
        {users.map((user) => (
          <li key={user.id}>
            <span
              className="presence-triangle"
              style={{ backgroundColor: user.color }}
              aria-hidden="true"
            />
            <span>{user.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

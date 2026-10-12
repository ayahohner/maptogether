import { useState } from "react";
import { Menu, MenuButton, MenuItem, MenuItems, MenuSeparator } from "@headlessui/react";
import {
  ChatBubbleLeftEllipsisIcon,
  CheckIcon,
  EllipsisVerticalIcon,
  InformationCircleIcon,
  LinkIcon,
  MapIcon,
  PlusIcon,
  QuestionMarkCircleIcon,
} from "@heroicons/react/24/outline";

import { CollaborationBadge } from "./CollaborationBadge";
import { copyTextToClipboard } from "../app/utilities/Clipboard";
import { openHelp } from "../state/Ui";

const ISSUES_URL = "https://github.com/ayahohner/wmaps/issues";

export interface TopBarProps {
  onAbout: () => void;
  onDemo: () => void;
  /** Creates the map if it's still a draft, so the copied link works. */
  onShare: () => void;
}

export function TopBar({ onAbout, onDemo, onShare }: TopBarProps) {
  return (
    <nav className="flex h-full items-center gap-2 px-3 sm:px-4" aria-label="Map">
      <Brand />
      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <CollaborationBadge />
        <a href="/" aria-label="New map" className="btn btn-ghost max-sm:w-9 max-sm:px-0">
          <PlusIcon aria-hidden="true" />
          <span className="max-sm:hidden">New map</span>
        </a>
        <ShareButton onShare={onShare} />
        <OverflowMenu onAbout={onAbout} onDemo={onDemo} />
      </div>
    </nav>
  );
}

function Brand() {
  return (
    <a href="/" className="flex items-center gap-2.5 rounded-lg pr-1 select-none" title="MapTogether: new map">
      <img src="/favicon.svg" alt="" width={28} height={28} className="size-7" />
      <span className="text-[15px] font-semibold tracking-tight text-ink max-[400px]:hidden">MapTogether</span>
      <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-ink-muted max-sm:hidden">
        Alpha
      </span>
    </a>
  );
}

function ShareButton({ onShare }: Pick<TopBarProps, "onShare">) {
  const [copied, setCopied] = useState(false);
  const share = () => {
    onShare();
    copyTextToClipboard(document.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button type="button" className="btn btn-primary" onClick={share} aria-live="polite">
      {copied ? <CheckIcon aria-hidden="true" /> : <LinkIcon aria-hidden="true" />}
      {copied ? "Link copied" : "Share"}
    </button>
  );
}

function OverflowMenu({ onAbout, onDemo }: Omit<TopBarProps, "onShare">) {
  return (
    <Menu>
      <MenuButton className="icon-btn" aria-label="More">
        <EllipsisVerticalIcon aria-hidden="true" />
      </MenuButton>
      <MenuItems
        anchor={{ to: "bottom end", gap: 6 }}
        transition
        className="panel z-50 w-60 p-1.5 outline-none transition duration-150 ease-out data-closed:scale-95 data-closed:opacity-0"
      >
        <MenuAction icon={InformationCircleIcon} label="About MapTogether" onClick={onAbout} />
        <MenuAction icon={QuestionMarkCircleIcon} label="Help and shortcuts" onClick={() => openHelp()} />
        <MenuAction icon={MapIcon} label="Open the demo map" onClick={onDemo} />
        <MenuSeparator className="my-1.5 h-px bg-line" />
        <MenuItem>
          <a className="menu-item" href={ISSUES_URL} target="_blank" rel="noopener">
            <ChatBubbleLeftEllipsisIcon aria-hidden="true" /> Send feedback
          </a>
        </MenuItem>
        <p className="px-2.5 pt-1.5 pb-1 text-xs text-ink-subtle">{`Version ${__APP_VERSION__}`}</p>
      </MenuItems>
    </Menu>
  );
}

interface MenuActionProps {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  onClick: () => void;
}

function MenuAction({ icon: Icon, label, onClick }: MenuActionProps) {
  return (
    <MenuItem>
      <button className="menu-item" onClick={onClick}>
        <Icon aria-hidden="true" /> {label}
      </button>
    </MenuItem>
  );
}

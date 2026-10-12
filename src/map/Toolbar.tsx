import type { ComponentType, MouseEvent, SVGProps } from "react";
import { useSnapshot } from "valtio";
import {
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  HandRaisedIcon,
  MinusIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";

import { isApple } from "../app/common/BrowserPlatform";
import { state } from "../state/State";
import { activeTool, setTool, tools, type Tool } from "../state/Tools";
import { MAX_SCALE, MIN_SCALE, viewport } from "./viewport";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

const mod = isApple ? "⌘" : "Ctrl";
const ZOOM_STEP = 1.25;

const SelectIcon: Icon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" {...props}>
    <path d="M5.5 3.5 18 10l-5.5 1.8-2.6 5.7z" />
  </svg>
);

const ComponentIcon: Icon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" {...props}>
    <circle cx="10" cy="14" r="5" />
    <path d="M18 3v6M15 6h6" />
  </svg>
);

const LinkToolIcon: Icon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
    <circle cx="6.5" cy="6.5" r="3" />
    <circle cx="17.5" cy="17.5" r="3" />
    <path d="m8.6 8.6 6.8 6.8" />
  </svg>
);

interface ToolItem {
  tool: Tool;
  label: string;
  keys: string[];
  icon: Icon;
}

const toolItems: ToolItem[] = [
  { tool: "select", label: "Select", keys: ["V"], icon: SelectIcon },
  { tool: "hand", label: "Pan", keys: ["H"], icon: HandRaisedIcon },
  { tool: "component", label: "Component", keys: ["C"], icon: ComponentIcon },
  { tool: "link", label: "Link", keys: ["L", `hold ${mod}`], icon: LinkToolIcon },
];

export interface MapControlsProps {
  onUndo: () => void;
  onRedo: () => void;
  onDelete: () => void;
  onZoom: (factor: number) => void;
  onResetZoom: () => void;
}

/** Toolbar, zoom buttons and tool hints, over the canvas. */
export function MapControls(props: MapControlsProps) {
  return (
    <>
      <Toolbar {...props} />
      <ZoomControls {...props} />
      <ToolHint />
    </>
  );
}

/** Clicking a control shouldn't take focus from the editor or a name field. */
const keepFocus = (e: MouseEvent) => e.preventDefault();

function Toolbar({ onUndo, onRedo, onDelete }: MapControlsProps) {
  const active = activeTool(useSnapshot(tools));
  const hasSelection = useSnapshot(state.selection).selectionItems.size > 0;
  return (
    <div role="toolbar" aria-label="Map tools" aria-orientation="vertical" className="map-toolbar float">
      {toolItems.map((item) => (
        <ControlButton
          key={item.tool}
          {...item}
          pressed={active === item.tool}
          onClick={() => setTool(item.tool)}
        />
      ))}
      <hr className="map-toolbar-rule" />
      <ControlButton label="Undo" keys={[`${mod} Z`]} icon={ArrowUturnLeftIcon} onClick={onUndo} />
      <ControlButton label="Redo" keys={[`${mod} ⇧ Z`]} icon={ArrowUturnRightIcon} onClick={onRedo} />
      {hasSelection && <ControlButton label="Delete" keys={["⌫"]} icon={TrashIcon} onClick={onDelete} />}
    </div>
  );
}

interface ControlButtonProps {
  label: string;
  keys: string[];
  icon: Icon;
  pressed?: boolean;
  onClick: () => void;
}

function ControlButton({ label, keys, icon: Icon, pressed, onClick }: ControlButtonProps) {
  return (
    <button
      type="button"
      className="icon-btn map-tool"
      aria-label={label}
      aria-pressed={pressed}
      onMouseDown={keepFocus}
      onClick={onClick}
    >
      <Icon aria-hidden="true" />
      <span className="map-tool-tip" aria-hidden="true">
        {label}
        {keys.map((key) => (
          <kbd key={key} className="kbd">
            {key}
          </kbd>
        ))}
      </span>
    </button>
  );
}

function ZoomControls({ onZoom, onResetZoom }: MapControlsProps) {
  const { scale } = useSnapshot(viewport);
  return (
    <div role="group" aria-label="Zoom" className="map-zoom float">
      <button
        type="button"
        className="icon-btn"
        aria-label="Zoom out"
        disabled={scale <= MIN_SCALE}
        onMouseDown={keepFocus}
        onClick={() => onZoom(1 / ZOOM_STEP)}
      >
        <MinusIcon aria-hidden="true" />
      </button>
      <button type="button" className="map-zoom-level" title="Reset zoom" onMouseDown={keepFocus} onClick={onResetZoom}>
        {Math.round(scale * 100)}%
      </button>
      <button
        type="button"
        className="icon-btn"
        aria-label="Zoom in"
        disabled={scale >= MAX_SCALE}
        onMouseDown={keepFocus}
        onClick={() => onZoom(ZOOM_STEP)}
      >
        <PlusIcon aria-hidden="true" />
      </button>
    </div>
  );
}

/** What to do next with the link and component tools. */
export function toolHint(tool: Tool, linkFrom: string | undefined) {
  if (tool === "component") return "Choose where the new component goes";
  if (tool !== "link") return undefined;
  return linkFrom ? `Now choose the component ${linkFrom} needs` : "Choose a component, then the one it needs";
}

function ToolHint() {
  const tool = activeTool(useSnapshot(tools));
  const { initialLinkTarget } = useSnapshot(state.linking);
  const hint = toolHint(tool, initialLinkTarget);
  return (
    <p role="status" className="map-tool-hint" hidden={!hint}>
      {hint}
    </p>
  );
}

import { useEffect, useRef, useState, type RefObject } from "react";
import { useSnapshot } from "valtio";
import { Tab, TabGroup, TabList, TabPanel, TabPanels, Transition } from "@headlessui/react";
import { CodeBracketIcon, CursorArrowRaysIcon, XMarkIcon } from "@heroicons/react/24/outline";

import { closeHelp, setHelpTopic, toggleHelp, ui, type HelpTopic } from "../state/Ui";
import { keys } from "../app/keys";
import { canvasHelp, syntaxHelp, type Input, type Part } from "./topics";

const topics: HelpTopic[] = ["canvas", "code"];
const prefersTouch = () => window.matchMedia?.("(pointer: coarse)").matches ?? false;

/** The floating ? button in the corner and the help panel it opens. */
export function HelpLauncher() {
  const { help } = useSnapshot(ui);
  const root = useRef<HTMLDivElement>(null);
  useDismiss(root, help.open);
  return (
    <div ref={root} className="help-launcher">
      <Transition show={help.open}>
        <section
          id="help-panel"
          role="dialog"
          aria-label="Help"
          className="help-panel panel transition duration-200 ease-out data-closed:translate-y-2 data-closed:opacity-0"
        >
          <HelpContents topic={help.topic} />
        </section>
      </Transition>
      <button
        type="button"
        className="help-fab"
        aria-label={help.open ? "Close help" : "Help"}
        aria-expanded={help.open}
        aria-controls="help-panel"
        onClick={toggleHelp}
      >
        {help.open ? (
          <XMarkIcon aria-hidden="true" className="size-5" />
        ) : (
          <span aria-hidden="true">?</span>
        )}
      </button>
    </div>
  );
}

/** Closes the panel on Escape or a press outside it. */
function useDismiss(root: RefObject<HTMLElement | null>, open: boolean) {
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) closeHelp();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeHelp();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [root, open]);
}

function HelpContents({ topic }: { topic: HelpTopic }) {
  return (
    <TabGroup selectedIndex={topics.indexOf(topic)} onChange={(i) => setHelpTopic(topics[i])}>
      <header className="flex items-center gap-3 border-b border-line px-4 pt-3.5 pb-3">
        <h2 className="text-[15px] font-heading">Help</h2>
        <TabList className="ml-auto flex rounded-[10px] bg-surface-muted p-0.5 text-[13px] font-medium">
          <HelpTab icon={<CursorArrowRaysIcon />}>Canvas</HelpTab>
          <HelpTab icon={<CodeBracketIcon />}>Code editor</HelpTab>
        </TabList>
      </header>
      <TabPanels className="help-scroll">
        <TabPanel>
          <CanvasHelp />
        </TabPanel>
        <TabPanel>
          <SyntaxHelp />
        </TabPanel>
      </TabPanels>
    </TabGroup>
  );
}

function HelpTab({ icon, children }: { icon: React.ReactElement; children: string }) {
  return (
    <Tab className="help-tab">
      <span aria-hidden="true">{icon}</span>
      {children}
    </Tab>
  );
}

function CanvasHelp() {
  const [input, setInput] = useState<Input>(prefersTouch() ? "touch" : "mouse");
  const other: Input = input === "touch" ? "mouse" : "touch";
  return (
    <div className="px-4 pt-1 pb-4">
      {canvasHelp(input, keys).map((section) => (
        <section key={section.title} className="mt-3">
          <h3 className="help-heading">{section.title}</h3>
          <dl className="divide-y divide-line/70">
            {section.rows.map((row) => (
              <div key={row.action} className="flex items-baseline gap-4 py-2 text-[13px]">
                <dt className="font-medium text-ink">{row.action}</dt>
                <dd className="ml-auto flex flex-wrap items-center justify-end gap-1 text-right text-ink-muted">
                  {row.how.map((part, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: the parts are fixed and can repeat.
                    <HowPart key={i} part={part} />
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
      <button
        type="button"
        className="mt-3 text-[13px] font-medium text-accent hover:underline"
        onClick={() => setInput(other)}
      >
        {other === "touch" ? "Show touch gestures" : "Show mouse and keyboard"}
      </button>
    </div>
  );
}

const HowPart = ({ part }: { part: Part }) =>
  typeof part === "string" ? <span>{part}</span> : <kbd className="kbd">{part.key}</kbd>;

function SyntaxHelp() {
  return (
    <div className="px-4 pt-3 pb-4 text-[13px]">
      <p className="text-ink-muted">
        The editor and the canvas show the same map. Anything you draw appears here as text, and
        anything you type appears on the canvas.
      </p>
      {syntaxHelp.map((example) => (
        <section key={example.title} className="mt-4">
          <h3 className="help-heading">{example.title}</h3>
          <pre className="help-code">
            <Highlighted code={example.code} />
          </pre>
          <p className="mt-1.5 leading-relaxed text-ink-muted">{example.explanation}</p>
        </section>
      ))}
    </div>
  );
}

const TOKEN = /(\/\/.*$|-?\d+(?:\.\d+)?|[[\]{}.,])/gm;

/** Light syntax colouring: comments, numbers and punctuation. */
function Highlighted({ code }: { code: string }) {
  return code.split(TOKEN).map((token, i) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: tokens repeat, and the list is rebuilt whole.
    <span key={i} className={tokenClass(token)}>
      {token}
    </span>
  ));
}

export function tokenClass(token: string) {
  if (token.startsWith("//")) return "text-ink-subtle italic";
  if (/^-?\d/.test(token)) return "text-accent";
  return /^[[\]{}.,]$/.test(token) ? "text-ink-subtle" : undefined;
}

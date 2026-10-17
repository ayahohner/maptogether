import { useState } from "react";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  /** Opens the pasted OnlineWardleyMaps text as a new map. */
  onImport: (owm: string) => void;
}

/** Takes a map pasted from OnlineWardleyMaps. */
export function ImportDialog({ open, onClose, onImport }: ImportDialogProps) {
  const [owm, setOwm] = useState("");
  const close = () => {
    setOwm("");
    onClose();
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    onImport(owm);
    close();
  };
  return (
    <Dialog open={open} onClose={close} className="relative z-50">
      <div className="fixed inset-0 bg-ink/20" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel as="form" onSubmit={submit} className="panel w-full max-w-lg p-5">
          <DialogTitle className="font-heading text-lg text-ink">
            Import from OnlineWardleyMaps
          </DialogTitle>
          <p className="mt-1 text-sm text-ink-muted">
            Paste a map's text. It opens as a new map in MapTogether's syntax, and lines that can't
            be converted stay in it as comments.
          </p>
          <textarea
            aria-label="OnlineWardleyMaps text"
            className="mt-3 h-56 w-full resize-y rounded-lg border border-line bg-surface p-2 font-mono text-sm text-ink"
            placeholder={
              "title Tea Shop\ncomponent Cup of Tea [0.79, 0.61]\ncomponent Tea [0.63, 0.81]\nCup of Tea->Tea"
            }
            value={owm}
            onChange={(event) => setOwm(event.target.value)}
            data-autofocus
          />
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={close}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={!owm.trim()}>
              Import
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

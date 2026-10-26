"use client";

import { useCallback, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { HelpCircleIcon } from "@hugeicons/core-free-icons";
import { exportBackup, useEditorStore } from "@/lib/editor-store";
import { ALT_KEY, IS_MAC, MOD_KEY } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const SHORTCUTS = [
  { key: "/", description: "Open the block menu" },
  { key: "#, ##, ###", description: "Create headings" },
  { key: `${MOD_KEY}K`, description: "Add a link" },
  { key: `${MOD_KEY}click`, description: "Open a link" },
  { key: IS_MAC ? "⌘⇧C" : "Ctrl+Shift+C", description: "Copy the doc as Markdown" },
  { key: `${ALT_KEY}N`, description: "New doc" },
  { key: `${ALT_KEY}W`, description: "Close doc" },
  { key: `${ALT_KEY}[ / ]`, description: "Previous / next doc" },
  { key: `${ALT_KEY}1–9`, description: "Jump to a doc" },
  { key: `${ALT_KEY}↑ / ↓`, description: "Switch between alternatives" },
  { key: `${ALT_KEY}↵`, description: "Add an alternative (with text selected), or show versions" },
  { key: `${ALT_KEY}D`, description: "Dim or undim the selected text" },
];

const FEATURES = [
  "Paste Markdown to turn it into rich text.",
  "Select text, then click the small Aa button for formatting, links, and copy-as-Markdown.",
  "A doc's tab is named after its first line.",
  "Text with a dotted underline has other versions. Select text and use the bubble to add an alternative or dim it.",
];

function SectionLabel({ children }: { children: string }) {
  return (
    <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </h3>
  );
}

export function HelpDialog({ tooltipClassName }: { tooltipClassName?: string }) {
  const restoreInputRef = useRef<HTMLInputElement | null>(null);
  const [backupStatus, setBackupStatus] = useState("");

  const downloadBackup = useCallback(() => {
    const url = URL.createObjectURL(new Blob([exportBackup()], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `minimal-editor-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, []);

  const restoreBackup = useCallback(async (file: File) => {
    try {
      const count = useEditorStore.getState().importDocs(await file.text());
      setBackupStatus(`Restored ${count} ${count === 1 ? "doc" : "docs"} as new tabs.`);
    } catch {
      setBackupStatus("That file isn't a Minimal Editor backup.");
    }
  }, []);

  return (
    <Dialog onOpenChange={(open) => !open && setBackupStatus("")}>
      <Tooltip>
        <TooltipTrigger
          render={
            <DialogTrigger
              render={<Button variant="ghost" size="icon-sm" aria-label="Help" />}
            >
              <HugeiconsIcon icon={HelpCircleIcon} size={18} strokeWidth={1.5} />
            </DialogTrigger>
          }
        />
        <TooltipContent className={tooltipClassName}>Help</TooltipContent>
      </Tooltip>

      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-5 overflow-y-auto rounded-2xl sm:max-w-3xl">
        <DialogHeader className="gap-1">
          <DialogTitle>Help</DialogTitle>
          <DialogDescription>A few useful rules, kept out of the way.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 sm:grid-cols-2">
          <section className="space-y-2">
            <SectionLabel>Shortcuts</SectionLabel>
            <dl className="space-y-2">
              {SHORTCUTS.map((item) => (
                <div key={item.key} className="flex items-start justify-between gap-3">
                  <dt className="text-foreground">{item.description}</dt>
                  <dd>
                    <kbd className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 font-sans text-xs whitespace-nowrap text-muted-foreground">
                      {item.key}
                    </kbd>
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <div className="space-y-6">
            <section className="space-y-2">
              <SectionLabel>Good to know</SectionLabel>
              <div className="space-y-2 text-muted-foreground">
                {FEATURES.map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <SectionLabel>Your docs</SectionLabel>
              <p className="text-muted-foreground">
                Docs autosave in this browser and nowhere else. Clearing your
                browser&apos;s data deletes them, so download a backup now and then.
              </p>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" onClick={downloadBackup}>
                  Download backup
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => restoreInputRef.current?.click()}
                >
                  Restore backup
                </Button>
                <input
                  ref={restoreInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) restoreBackup(file);
                    event.target.value = "";
                  }}
                />
              </div>
              {backupStatus ? (
                <p role="status" className="text-muted-foreground">
                  {backupStatus}
                </p>
              ) : null}
            </section>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

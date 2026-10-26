"use client";

import { useCallback, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { BotIcon, Copy01Icon, HelpCircleIcon, Tick02Icon } from "@hugeicons/core-free-icons";
import { announce } from "@/lib/announce";
import { exportBackup, useEditorStore } from "@/lib/editor-store";
import { ALT_KEY, IS_MAC, MOD_KEY, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
  { key: `${ALT_KEY}↵`, description: "Add or show alternatives" },
  { key: `${ALT_KEY}D`, description: "Dim or undim the selected text" },
  { key: `↵ / ${MOD_KEY}↵`, description: "In the panel: add / accept a version" },
];

const AGENT_SETUP = "claude mcp add --scope user minimal-editor -- npx -y minimal-editor-mcp";
const AGENT_DOCS = "https://github.com/bschm0622/minimal-editor#working-with-an-ai-agent";

const FEATURES = [
  "Paste Markdown and it turns into rich text.",
  "Select text for a small bar to format it, copy it as Markdown, add an alternative or dim it.",
  "Text with a dotted underline has other versions.",
  "A doc's tab is named after its first line.",
];

function SectionLabel({ children }: { children: string }) {
  return (
    <h3 className="text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
      {children}
    </h3>
  );
}

export function HelpDialog({ triggerClassName }: { triggerClassName?: string }) {
  const restoreInputRef = useRef<HTMLInputElement | null>(null);
  const [backupStatus, setBackupStatus] = useState("");
  const [setupCopied, setSetupCopied] = useState(false);

  const copySetup = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(AGENT_SETUP);
      setSetupCopied(true);
      announce("Copied");
      setTimeout(() => setSetupCopied(false), 1200);
    } catch {
      // Clipboard access can be denied; the command is still there to select.
    }
  }, []);

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
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Help"
                  className={triggerClassName}
                />
              }
            >
              <HugeiconsIcon icon={HelpCircleIcon} size={16} strokeWidth={1.5} />
            </DialogTrigger>
          }
        />
        <TooltipContent>Help</TooltipContent>
      </Tooltip>

      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-5 overflow-y-auto rounded-2xl sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Help</DialogTitle>
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
              <div className="flex gap-2">
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

        <section className="space-y-2 border-t border-border pt-5">
          <SectionLabel>Working with an AI agent</SectionLabel>
          <p className="text-muted-foreground">
            The editor has no AI built in. Your own agent, such as Claude Code, can
            read your doc and suggest edits as alternatives, and you decide what to
            keep. Add the helper once, then click{" "}
            <HugeiconsIcon
              icon={BotIcon}
              size={14}
              strokeWidth={1.5}
              className="inline align-[-2px]"
              aria-label="the robot button"
            />{" "}
            in the toolbar to connect. The agent can only reach this editor, and
            only while it&apos;s connected.
          </p>
          <div className="flex items-center gap-2 rounded-xl bg-muted py-0.5 pr-0.5 pl-3">
            <code className="min-w-0 flex-1 truncate text-xs text-muted-foreground select-all">
              {AGENT_SETUP}
            </code>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={copySetup}
              aria-label={setupCopied ? "Copied" : "Copy command"}
              className={cn("text-muted-foreground", setupCopied && "text-foreground")}
            >
              <HugeiconsIcon
                icon={setupCopied ? Tick02Icon : Copy01Icon}
                strokeWidth={1.75}
                className="size-3.5"
              />
            </Button>
          </div>
          <p className="text-muted-foreground">
            Then, in Claude Code, type{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">/mcp__minimal-editor__edit</code>{" "}
            and what you&apos;d like, or ask for edits to your draft in Minimal Editor.{" "}
            <a
              href={AGENT_DOCS}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-3 hover:text-foreground"
            >
              Setup details
            </a>
          </p>
        </section>
      </DialogContent>
    </Dialog>
  );
}

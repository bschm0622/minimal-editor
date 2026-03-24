"use client";

import { useCallback, useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Copy01Icon,
  Download01Icon,
  Sun01Icon,
  Moon01Icon,
  CenterFocusIcon,
  Menu01Icon,
  TextFontIcon,
} from "@hugeicons/core-free-icons";
import { useEditorStore, type EditorFont } from "@/lib/editor-store";
import { saveFileAs } from "@/lib/file-sync";
import { htmlToMarkdown } from "@/lib/markdown";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const FONT_OPTIONS: { value: EditorFont; label: string; sample: string }[] = [
  { value: "sans", label: "Sans Serif", sample: "Aa" },
  { value: "serif", label: "Serif", sample: "Aa" },
  { value: "mono", label: "Monospace", sample: "Aa" },
];

export function Toolbar() {
  const { isSaved, fileHandle, focusMode, font, toggleFocusMode, setFont } =
    useEditorStore();
  const [isDark, setIsDark] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const stored = localStorage.getItem("minimal-editor-theme");
    const dark = stored ? stored === "dark" : mq.matches;
    setIsDark(dark);
    document.documentElement.classList.toggle("dark", dark);

    const handler = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem("minimal-editor-theme")) {
        setIsDark(e.matches);
        document.documentElement.classList.toggle("dark", e.matches);
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const toggleTheme = useCallback(() => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("minimal-editor-theme", next ? "dark" : "light");
  }, [isDark]);

  const handleSyncToFile = useCallback(async () => {
    const content = useEditorStore.getState().content;
    const markdown = htmlToMarkdown(content);
    await saveFileAs(markdown);
  }, []);

  const handleCopyMarkdown = useCallback(async () => {
    const content = useEditorStore.getState().content;
    const markdown = htmlToMarkdown(content);
    await navigator.clipboard.writeText(markdown);
  }, []);

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 h-14"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      {/* Left side: icon hint + file info */}
      <div className="flex items-center gap-3">
        <div
          className={`flex items-center justify-center transition-all duration-200 ${
            expanded ? "text-muted-foreground" : "text-muted-foreground/30"
          }`}
        >
          <HugeiconsIcon icon={Menu01Icon} size={18} strokeWidth={1.5} />
        </div>

        <div
          className={`flex items-center gap-2 transition-opacity duration-200 ${
            expanded ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <span className="text-sm text-muted-foreground">
            {fileHandle ? fileHandle.name : "Untitled"}
          </span>
          <span
            className={`inline-block size-2 rounded-full transition-colors ${
              isSaved ? "bg-emerald-500" : "bg-amber-500"
            }`}
          />
        </div>
      </div>

      {/* Action buttons */}
      <div
        className={`flex items-center gap-1 rounded-xl border border-border bg-background/80 p-1.5 backdrop-blur-sm transition-all duration-200 ${
          expanded
            ? "opacity-100 translate-y-0"
            : "opacity-0 -translate-y-1 pointer-events-none"
        }`}
      >
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleCopyMarkdown}
                aria-label="Copy as Markdown"
              />
            }
          >
            <HugeiconsIcon icon={Copy01Icon} size={18} strokeWidth={1.5} />
          </TooltipTrigger>
          <TooltipContent>Copy as Markdown</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleSyncToFile}
                aria-label="Save as .md file"
              />
            }
          >
            <HugeiconsIcon icon={Download01Icon} size={18} strokeWidth={1.5} />
          </TooltipTrigger>
          <TooltipContent>Save as .md</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="mx-1 h-5" />

        {/* Font picker */}
        <Popover>
          <Tooltip>
            <TooltipTrigger
              render={
                <PopoverTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Change font"
                    />
                  }
                >
                  <HugeiconsIcon
                    icon={TextFontIcon}
                    size={18}
                    strokeWidth={1.5}
                  />
                </PopoverTrigger>
              }
            />
            <TooltipContent>Font</TooltipContent>
          </Tooltip>
          <PopoverContent className="w-44 p-1.5" side="bottom" align="end">
            {FONT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFont(opt.value)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  font === opt.value
                    ? "bg-accent text-accent-foreground"
                    : "text-foreground hover:bg-accent/50"
                }`}
              >
                <span
                  className={`text-base ${
                    opt.value === "serif"
                      ? "font-serif"
                      : opt.value === "mono"
                        ? "font-mono"
                        : "font-sans"
                  }`}
                >
                  {opt.sample}
                </span>
                <span>{opt.label}</span>
              </button>
            ))}
          </PopoverContent>
        </Popover>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={toggleFocusMode}
                aria-label="Toggle focus mode"
                className={focusMode ? "bg-accent" : ""}
              />
            }
          >
            <HugeiconsIcon
              icon={CenterFocusIcon}
              size={18}
              strokeWidth={1.5}
            />
          </TooltipTrigger>
          <TooltipContent>Focus mode</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={toggleTheme}
                aria-label="Toggle theme"
              />
            }
          >
            <HugeiconsIcon
              icon={isDark ? Sun01Icon : Moon01Icon}
              size={18}
              strokeWidth={1.5}
            />
          </TooltipTrigger>
          <TooltipContent>{isDark ? "Light mode" : "Dark mode"}</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}

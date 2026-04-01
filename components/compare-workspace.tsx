"use client";

import { useCallback, useMemo, useState } from "react";
import { useEditorStore } from "@/lib/editor-store";
import { debouncedSave } from "@/lib/editor-store";
import { htmlToMarkdown, markdownToHtml } from "@/lib/markdown";
import {
  computeBlockDiff,
  computeWordDiff,
  joinMarkdownBlocks,
  replaceMarkdownBlocks,
  splitMarkdownBlocks,
  type DiffSegment,
  type WordDiffPart,
} from "@/lib/compare";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";

function segmentTitle(segment: DiffSegment) {
  if (segment.type === "replace") return "Suggested revision";
  if (segment.type === "insert") return "Suggested addition";
  if (segment.type === "delete") return "Suggested removal";
  return "Match";
}

export function CompareWorkspace() {
  const {
    content,
    setContent,
    compareContent,
    setCompareContent,
    setCompareMode,
    font,
  } = useEditorStore();
  const [rewriteSource, setRewriteSource] = useState(() =>
    compareContent ? htmlToMarkdown(compareContent) : ""
  );
  const [editingSegmentKey, setEditingSegmentKey] = useState<string | null>(null);
  const [editingDraftText, setEditingDraftText] = useState("");

  const draftMarkdown = useMemo(() => htmlToMarkdown(content), [content]);
  const compareMarkdown = rewriteSource;
  const diff = useMemo(
    () => computeBlockDiff(draftMarkdown, compareMarkdown),
    [compareMarkdown, draftMarkdown]
  );
  const changedSegments = diff.segments.filter((segment) => segment.type !== "equal");
  const hasPendingEdit = editingSegmentKey !== null;
  const compareFontClassName =
    font === "editorial"
      ? "font-editorial"
      : font === "classic"
        ? "font-classic"
        : font === "mono"
          ? "font-mono"
          : "font-sans";

  const persistDraftHtml = useCallback(
    (nextHtml: string) => {
      setContent(nextHtml);
      debouncedSave(nextHtml);
    },
    [setContent]
  );

  const applySegmentToDraft = useCallback(
    (segment: DiffSegment) => {
      const nextBlocks = replaceMarkdownBlocks(
        diff.draftBlocks,
        segment.draftStart,
        segment.draftEnd,
        segment.compareBlocks
      );

      persistDraftHtml(markdownToHtml(joinMarkdownBlocks(nextBlocks)));
    },
    [diff.draftBlocks, persistDraftHtml]
  );

  const closeCompareMode = useCallback(() => {
    if (hasPendingEdit) {
      const shouldClose = window.confirm(
        "You have an in-progress edit. Close and discard it?"
      );

      if (!shouldClose) {
        return;
      }
    }

    setCompareMode(false);
    setEditingSegmentKey(null);
    setEditingDraftText("");
  }, [hasPendingEdit, setCompareMode]);

  const handleRewriteSourceChange = useCallback(
    (nextValue: string) => {
      setRewriteSource(nextValue);
      setCompareContent(nextValue.trim() ? markdownToHtml(nextValue) : "");
    },
    [setCompareContent]
  );

  const updateDraftSegment = useCallback(
    (segment: DiffSegment, nextMarkdown: string) => {
      const replacementBlocks = splitMarkdownBlocks(nextMarkdown);
      const nextBlocks = replaceMarkdownBlocks(
        diff.draftBlocks,
        segment.draftStart,
        segment.draftEnd,
        replacementBlocks
      );

      persistDraftHtml(markdownToHtml(joinMarkdownBlocks(nextBlocks)));
    },
    [diff.draftBlocks, persistDraftHtml]
  );

  const beginEditingSegment = useCallback((segment: DiffSegment, key: string) => {
    setEditingSegmentKey(key);
    setEditingDraftText(segment.compareBlocks.join("\n\n"));
  }, []);

  const cancelEditingSegment = useCallback(() => {
    setEditingSegmentKey(null);
    setEditingDraftText("");
  }, []);

  const saveEditingSegment = useCallback(
    (segment: DiffSegment) => {
      updateDraftSegment(segment, editingDraftText);
      setEditingSegmentKey(null);
      setEditingDraftText("");
    },
    [editingDraftText, updateDraftSegment]
  );

  return (
    <div
      className={`flex flex-1 flex-col px-3 pb-6 pt-4 sm:px-4 lg:px-6 ${compareFontClassName}`}
    >
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-4">
          <div className="space-y-1">
            <div className="text-sm font-medium text-foreground">
              Compare Versions
            </div>
            <p className="max-w-2xl text-xs text-muted-foreground">
              Compare your draft against another version and apply the changes you want.
            </p>
          </div>
          <Button variant="ghost" size="xs" onClick={closeCompareMode}>
            Done
          </Button>
        </div>

        <Separator />

        {/* Other version input */}
        <div className="py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Paste a version to compare
          </p>
          <textarea
            value={rewriteSource}
            onChange={(event) => handleRewriteSourceChange(event.target.value)}
            placeholder="Paste here..."
            className={`mt-3 min-h-32 w-full resize-y rounded-xl border border-input bg-background px-4 py-3 text-sm leading-6 text-foreground outline-none transition-colors focus:border-ring ${compareFontClassName}`}
          />
        </div>

        <Separator />

        {/* Review header */}
        <div className="flex items-center justify-between gap-3 pt-4 pb-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Review
          </p>
          <span className="text-xs text-muted-foreground">
            {changedSegments.length} change{changedSegments.length === 1 ? "" : "s"}
          </span>
        </div>

        {hasPendingEdit ? (
          <p className="pb-3 text-xs text-muted-foreground">
            Save or cancel the active edit before applying other changes.
          </p>
        ) : null}

        {/* Segments */}
        <div className="flex flex-col gap-0">
          {diff.segments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              Paste another version above to see changes.
            </div>
          ) : null}

          {diff.segments.map((segment, index) => {
            const segmentKey = `${segment.type}-${segment.draftStart}-${segment.compareStart}-${index}`;
            const isEditing = editingSegmentKey === segmentKey;

            if (segment.type === "equal") {
              return (
                <div key={segmentKey} className="py-3">
                  {isEditing ? (
                    <>
                      <textarea
                        value={editingDraftText}
                        onChange={(event) => setEditingDraftText(event.target.value)}
                        className={`min-h-40 w-full resize-y rounded-xl border border-input bg-background px-4 py-3 text-sm leading-6 text-foreground outline-none transition-colors focus:border-ring ${compareFontClassName}`}
                      />
                      <div className="mt-2 flex gap-1.5">
                        <Button size="xs" variant="outline" onClick={cancelEditingSegment}>
                          Cancel
                        </Button>
                        <Button size="xs" onClick={() => saveEditingSegment(segment)}>
                          Save
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div>
                      <BlockPreview
                        markdown={segment.draftBlocks.join("\n\n")}
                        emptyLabel=""
                        className={cn(compareFontClassName, "text-muted-foreground/60")}
                      />
                      <Button
                        size="xs"
                        variant="ghost"
                        className="mt-1 text-muted-foreground/40"
                        onClick={() => beginEditingSegment(segment, segmentKey)}
                        disabled={hasPendingEdit}
                      >
                        Edit
                      </Button>
                    </div>
                  )}
                </div>
              );
            }

            const accentColor =
              segment.type === "insert"
                ? "border-emerald-500/50"
                : segment.type === "delete"
                  ? "border-rose-500/50"
                  : "border-amber-500/50";

            return (
              <div
                key={segmentKey}
                className={cn(
                  "my-1.5 rounded-lg border-l-[3px] bg-muted/40 py-3 pl-4 pr-3",
                  accentColor
                )}
              >
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">
                    {segmentTitle(segment)}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {isEditing ? (
                      <>
                        <Button size="xs" variant="outline" onClick={cancelEditingSegment}>
                          Cancel
                        </Button>
                        <Button size="xs" onClick={() => saveEditingSegment(segment)}>
                          Save
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="xs"
                          onClick={() => applySegmentToDraft(segment)}
                          disabled={hasPendingEdit}
                        >
                          {segment.type === "delete"
                            ? "Apply removal"
                            : segment.type === "insert"
                              ? "Apply addition"
                              : "Apply change"}
                        </Button>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => beginEditingSegment(segment, segmentKey)}
                          disabled={hasPendingEdit}
                        >
                          Edit before applying
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {segment.type === "replace" &&
                segment.draftBlocks.length === 1 &&
                segment.compareBlocks.length === 1 ? (
                  <div className="mb-3 rounded-md bg-muted/25 px-3 py-2.5">
                    <div className="mb-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      Revision preview
                    </div>
                    <InlineWordDiffPreview
                      parts={computeWordDiff(
                        segment.draftBlocks[0],
                        segment.compareBlocks[0]
                      )}
                      className={compareFontClassName}
                    />
                  </div>
                ) : null}

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      Current
                    </div>
                    {isEditing ? (
                      <textarea
                        value={editingDraftText}
                        onChange={(event) => setEditingDraftText(event.target.value)}
                        className={`min-h-40 w-full resize-y rounded-xl border border-input bg-background px-4 py-3 text-sm leading-6 text-foreground outline-none transition-colors focus:border-ring ${compareFontClassName}`}
                      />
                    ) : (
                      <BlockPreview
                        markdown={segment.draftBlocks.join("\n\n")}
                        emptyLabel="[Nothing in current draft]"
                        className={compareFontClassName}
                      />
                    )}
                  </div>

                  <div className="space-y-2 border-t border-border/40 pt-4 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      Suggested
                    </div>
                    <BlockPreview
                      markdown={segment.compareBlocks.join("\n\n")}
                      emptyLabel="[Removed in suggested version]"
                      className={compareFontClassName}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BlockPreview({
  markdown,
  emptyLabel,
  className,
}: {
  markdown: string;
  emptyLabel: string;
  className?: string;
}) {
  if (!markdown.trim()) {
    return <p className="text-xs text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div
      className={cn(
        "editor-prose prose prose-sm prose-neutral dark:prose-invert max-w-none select-text [&_h1]:text-inherit [&_h2]:text-inherit [&_h3]:text-inherit",
        className
      )}
      dangerouslySetInnerHTML={{ __html: markdownToHtml(markdown) }}
    />
  );
}

function InlineWordDiffPreview({
  parts,
  className,
}: {
  parts: WordDiffPart[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "whitespace-pre-wrap wrap-break-word select-text text-xs leading-6 text-foreground",
        className
      )}
    >
      {parts.map((part, index) => {
        return (
          <span
            key={`${part.type}-${index}`}
            className={cn(
              part.type === "equal" && "",
              part.type === "insert" &&
                "rounded bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
              part.type === "delete" &&
                "rounded bg-rose-500/12 text-rose-700 line-through decoration-rose-500/70 dark:text-rose-300"
            )}
          >
            {part.text}
          </span>
        );
      })}
    </div>
  );
}

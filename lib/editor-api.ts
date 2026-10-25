import {
  DOMParser as ProseMirrorDOMParser,
  type Node as ProseMirrorNode,
} from "@tiptap/pm/model";
import {
  addAlternative,
  inlineToText,
  listAlternatives,
  textToInline,
  type AlternativeResult,
} from "./alternatives";
import { DOC_LOADED_EVENT, docLabel, useEditorStore } from "./editor-store";
import { htmlToMarkdown, markdownToHtml } from "./markdown";

/*
 * A small hook on `window.minimalEditor` so an AI driving the browser can
 * read the open doc, suggest alternatives and draft new paragraphs, without
 * the app calling any AI service itself. Documented in README.md.
 */

interface Suggestion {
  /** Exact text as it appears in the doc (plain text, not Markdown). */
  find: string;
  /** New versions. Inline Markdown is fine. "" suggests removing the text (shown dimmed). */
  alternatives: string[];
  /** Which match to use when the text appears more than once (1 = first). */
  occurrence?: number;
  /** Show the original or the first suggestion. Defaults to the suggestion. */
  show?: "original" | "first";
}

type SuggestResult = AlternativeResult & { matches?: number };

function findText(doc: ProseMirrorNode, needle: string, occurrence: number) {
  let count = 0;
  let found: { from: number; to: number } | null = null;

  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;

    let text = "";
    const positions: number[] = [];
    node.forEach((child, offset) => {
      const start = pos + 1 + offset;
      if (child.isText) {
        for (let i = 0; i < child.text!.length; i++) positions.push(start + i);
        text += child.text;
      } else {
        positions.push(start);
        text += "￼";
      }
    });

    for (let i = text.indexOf(needle); i !== -1; i = text.indexOf(needle, i + 1)) {
      count++;
      if (count === occurrence) {
        found = {
          from: positions[i],
          to: positions[i + needle.length - 1] + 1,
        };
      }
    }
    return false;
  });

  return { range: found as { from: number; to: number } | null, count };
}

interface Insertion {
  /** Markdown for one or more new blocks (paragraphs, headings, lists). */
  markdown: string;
  /** Exact text from the paragraph to put it after (or `before`). Neither: end of the doc. */
  after?: string;
  before?: string;
}

function insertBlocks(input: Insertion): AlternativeResult | { ok: true } {
  const editor = getEditor();
  if (!input?.markdown?.trim()) return { ok: false, error: "`markdown` is required." };

  const { doc, schema } = editor.state;
  let pos = doc.content.size;
  const anchor = input.after ?? input.before;
  if (anchor) {
    const { range } = findText(doc, anchor, 1);
    if (!range) return { ok: false, error: "That text isn't in the doc. Copy it exactly from text()." };
    const $at = doc.resolve(range.from);
    pos = input.after ? $at.after(1) : $at.before(1);
  }

  const wrapper = document.createElement("div");
  wrapper.innerHTML = markdownToHtml(input.markdown);
  const blocks = ProseMirrorDOMParser.fromSchema(schema).parse(wrapper).content;
  editor.view.dispatch(editor.state.tr.insert(pos, blocks).scrollIntoView());
  return { ok: true };
}

function getEditor() {
  const { editor } = useEditorStore.getState();
  if (!editor || editor.isDestroyed) throw new Error("The editor isn't ready yet.");
  return editor;
}

function suggestOne(input: Suggestion): SuggestResult {
  const editor = getEditor();
  if (!input?.find) return { ok: false, error: "`find` is required." };
  if (!Array.isArray(input.alternatives) || !input.alternatives.length) {
    return { ok: false, error: "`alternatives` needs at least one version." };
  }

  const { range, count } = findText(
    editor.state.doc,
    input.find,
    input.occurrence ?? 1
  );
  if (!range) {
    return {
      ok: false,
      matches: count,
      error: count
        ? `Only ${count} match${count === 1 ? "" : "es"} for that text.`
        : "That text isn't in the doc. Copy it exactly from text().",
    };
  }

  const result = addAlternative(
    editor,
    range,
    input.alternatives.map((text) => textToInline(editor.schema, text)),
    { show: input.show, ai: true }
  );
  return { ...result, matches: count };
}

const HELP = `minimalEditor: suggest rewrites the writer can switch between and keep or reject.

Read
  docs()            [{ id, title, open }]
  await open(id)    switch to a doc; resolves once it's loaded
  text()            open doc as plain text, one paragraph per block. Copy find strings from here.
  read()            open doc as Markdown (shows whichever versions are on screen)
  list()            existing alternatives: [{ id, shown, versions: [original, ...], fromAi }]

Draft
  insert({ markdown, after? | before? })
    Adds new paragraphs (Markdown, can be several) after or before the paragraph containing
    the exact text given, or at the end. Only when the writer asked for drafted text.
    To rewrite an existing paragraph, use suggest() with the whole paragraph as find instead.

Suggest
  suggest([{ find, alternatives, show?, occurrence? }, ...])
    find          exact plain text inside ONE paragraph (not Markdown). Copy it from text().
    alternatives  1-3 rewrites. Inline Markdown is fine. "" suggests removing the text (shown dimmed).
    show          "first" (default) shows your first rewrite in place; "original" keeps theirs on screen.
    occurrence    which match when the text appears more than once (1 = first).
  Returns one result per suggestion: { ok, id } or { ok: false, error, matches }. Retry failures.

Rules
  - Send every suggestion in one suggest([...]) call, then check every result.
  - When removing a whole sentence, include its trailing space in find.
  - Suggest at the smallest unit that works: a word or sentence, not a whole paragraph.
  - Keep the writer's voice. Never keep or reject versions for them; they decide in the editor.
  - Don't overlap an existing alternative; suggesting on exactly its text adds versions to it.`;

const api = {
  /** How to use this hook, for an agent that just found it. */
  help() {
    return HELP;
  },
  /** The open doc as Markdown, showing whichever versions are on screen. */
  read() {
    return htmlToMarkdown(getEditor().getHTML());
  },
  /** The open doc as plain text, one paragraph per block. Use it to copy `find` strings. */
  text() {
    const { doc } = getEditor().state;
    return doc.textBetween(0, doc.content.size, "\n\n", "￼");
  },
  docs() {
    const { docs, activeId } = useEditorStore.getState();
    return docs.map((doc) => ({
      id: doc.id,
      title: docLabel(doc),
      open: doc.id === activeId,
    }));
  },
  /** Switch docs. Resolves once the doc is in the editor, so suggest() can follow. */
  open(id: string): Promise<boolean> {
    const store = useEditorStore.getState();
    if (!store.docs.some((d) => d.id === id)) return Promise.resolve(false);
    if (store.activeId === id) return Promise.resolve(true);
    return new Promise((resolve) => {
      const done = (loaded: boolean) => {
        window.removeEventListener(DOC_LOADED_EVENT, onLoaded);
        clearTimeout(timeout);
        resolve(loaded);
      };
      const onLoaded = (event: Event) => {
        if ((event as CustomEvent<string>).detail === id) done(true);
      };
      const timeout = setTimeout(() => done(false), 3000);
      window.addEventListener(DOC_LOADED_EVENT, onLoaded);
      store.switchDoc(id);
    });
  },
  /** Add alternatives. Pass one suggestion or an array of them. */
  suggest(input: Suggestion | Suggestion[]) {
    if (!Array.isArray(input)) return suggestOne(input);
    return input.map((item) => {
      try {
        return suggestOne(item);
      } catch (error) {
        return { ok: false, error: String(error) };
      }
    });
  },
  /** Add new paragraphs from Markdown, after/before a paragraph or at the end. */
  insert(input: Insertion) {
    return insertBlocks(input);
  },
  /** Alternatives in the open doc. Version 0 is the original. */
  list() {
    return listAlternatives(getEditor().state).map((range) => ({
      id: range.id,
      shown: range.active,
      versions: range.variants.map(inlineToText),
      fromAi: range.ai,
    }));
  },
};

declare global {
  interface Window {
    minimalEditor?: typeof api;
  }
}

export function installEditorApi() {
  window.minimalEditor = api;
}

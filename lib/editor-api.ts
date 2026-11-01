import { createDocument, getHTMLFromFragment } from "@tiptap/core";
import {
  DOMParser as ProseMirrorDOMParser,
  Fragment,
  type Node as ProseMirrorNode,
} from "@tiptap/pm/model";
import { EditorState } from "@tiptap/pm/state";
import {
  addAlternative,
  inlineToText,
  listAlternatives,
  suggestedBlock,
  textToInline,
  type AlternativeResult,
  type DocTarget,
} from "./alternatives";
import {
  DOC_LOADED_EVENT,
  docLabel,
  docSessions,
  readDocContent,
  saveDocState,
  useEditorStore,
} from "./editor-store";
import { htmlToMarkdown, markdownToHtml } from "./markdown";

/*
 * A small hook on `window.minimalEditor` so an AI driving the browser can
 * read docs, suggest alternatives and draft new paragraphs, without the app
 * calling any AI service itself. Documented in README.md.
 *
 * Every call works on the open doc unless it's given another doc's id. Other
 * docs are changed in place without opening them, so the writer can keep
 * reading or writing elsewhere while the agent works.
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

    for (let i = text.indexOf(needle); i !== -1; i = text.indexOf(needle, i + needle.length)) {
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
  /** Another doc's id. Leave out for the open doc. */
  doc?: string;
}

function insertBlocks(input: Insertion): AlternativeResult | { ok: true; ids: string[] } {
  if (!input?.markdown?.trim()) return { ok: false, error: "`markdown` is required." };
  const target = docTarget(input.doc);

  const { doc, schema } = target.state;
  let pos = doc.content.size;
  // An empty doc is one empty paragraph: replace it rather than adding after it.
  const empty = doc.childCount === 1 && !doc.firstChild!.content.size;
  const anchor = input.after ?? input.before;
  if (anchor) {
    const { range } = findText(doc, anchor, 1);
    if (!range) return { ok: false, error: "That text isn't in the doc. Copy it exactly from the doc's plain text." };
    const $at = doc.resolve(range.from);
    pos = input.after ? $at.after(1) : $at.before(1);
  }

  const wrapper = document.createElement("div");
  wrapper.innerHTML = markdownToHtml(input.markdown);
  const parsed = ProseMirrorDOMParser.fromSchema(schema).parse(wrapper).content;
  // Paragraphs and headings arrive as suggestions, so the writer sees what's new and decides.
  const ids: string[] = [];
  const blocks: ProseMirrorNode[] = [];
  parsed.forEach((block) => {
    const suggested = suggestedBlock(schema, block);
    if (suggested) ids.push(suggested.id);
    blocks.push(suggested?.node ?? block);
  });
  const tr = empty && !anchor
    ? target.state.tr.replaceWith(0, doc.content.size, Fragment.fromArray(blocks))
    : target.state.tr.insert(pos, Fragment.fromArray(blocks));
  target.view.dispatch(tr.setMeta("addToHistory", false).scrollIntoView());
  return { ok: true, ids };
}

function getEditor() {
  const { editor } = useEditorStore.getState();
  if (!editor || editor.isDestroyed) throw new Error("The editor isn't ready yet.");
  return editor;
}

/** The open doc's editor, or another doc changed in place without opening it. */
function docTarget(id?: string): DocTarget {
  const editor = getEditor();
  const { docs, activeId } = useEditorStore.getState();
  if (!id || id === activeId) return editor;
  if (!docs.some((d) => d.id === id)) {
    throw new Error(`There's no doc with id "${id}". docs() lists them.`);
  }
  let state =
    docSessions.get(id)?.state ??
    EditorState.create({
      doc: createDocument(readDocContent(id), editor.schema),
      plugins: editor.state.plugins,
    });
  return {
    get state() {
      return state;
    },
    view: {
      dispatch(tr) {
        state = state.apply(tr);
        saveDocState(id, state);
      },
    },
  };
}

function suggestOne(input: Suggestion, doc?: string): SuggestResult {
  if (!input?.find) return { ok: false, error: "`find` is required." };
  if (!Array.isArray(input.alternatives) || !input.alternatives.length) {
    return { ok: false, error: "`alternatives` needs at least one version." };
  }

  const target = docTarget(doc);
  const { range, count } = findText(
    target.state.doc,
    input.find,
    input.occurrence ?? 1
  );
  if (!range) {
    return {
      ok: false,
      matches: count,
      error: count
        ? `Only ${count} match${count === 1 ? "" : "es"} for that text.`
        : "That text isn't in the doc. Copy it exactly from the doc's plain text.",
    };
  }

  const result = addAlternative(
    target,
    range,
    input.alternatives.map((text) => textToInline(target.state.schema, text)),
    // An agent's edits stay out of the writer's undo history: ⌘Z undoes their own typing.
    { show: input.show, ai: true, history: false }
  );
  return { ...result, matches: count };
}

const HELP = `minimalEditor: suggest rewrites the writer can switch between and keep or reject.

Every call below works on the doc on the writer's screen, unless you pass another doc's id
(from docs()). Other docs are changed in place without opening them, so the writer can keep
working where they are. Only open() changes what's on their screen.

Read
  docs()            [{ id, title, open }]
  await open(id)    show a doc on the writer's screen; resolves once it's loaded
  text(doc?)        a doc as plain text, one paragraph per block. Copy find strings from here.
                    Line breaks and dimmed text show as "￼"; keep that character in find strings.
  read(doc?)        a doc as Markdown (shows whichever versions are showing)
  list(doc?)        existing alternatives: [{ id, shown, versions: [original, ...], fromAi }]

Draft
  create({ title?, markdown? })
    Adds a new doc as the last tab, without opening it, and returns { ok, id }. The title
    becomes its heading; markdown is added like insert(). Only when the writer asked for one.
  insert({ markdown, after? | before?, doc? })
    Adds new paragraphs (Markdown, can be several) after or before the paragraph containing
    the exact text given, or at the end. Inside a list, quote or table, they go after or
    before the whole list, quote or table. Only when the writer asked for drafted text.
    New paragraphs and headings arrive as suggestions the writer keeps or drops; lists,
    quotes, tables and code arrive as plain text, so tell the writer which ones you added.
    To rewrite an existing paragraph, use suggest() with the whole paragraph as find instead.

Suggest
  suggest([{ find, alternatives, show?, occurrence? }, ...], doc?)
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

let cancelPendingOpen: (() => void) | null = null;

export const editorApi = {
  /** How to use this hook, for an agent that just found it. */
  help() {
    return HELP;
  },
  /** A doc as Markdown, showing whichever versions are showing. The open doc by default. */
  read(doc?: string) {
    const { state } = docTarget(doc);
    return htmlToMarkdown(getHTMLFromFragment(state.doc.content, state.schema));
  },
  /** A doc as plain text, one paragraph per block. Use it to copy `find` strings. */
  text(doc?: string) {
    const { doc: node } = docTarget(doc).state;
    return node.textBetween(0, node.content.size, "\n\n", "￼");
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
    // A newer open() wins; the one before it resolves false straight away.
    cancelPendingOpen?.();
    const store = useEditorStore.getState();
    if (!store.docs.some((d) => d.id === id)) return Promise.resolve(false);
    if (store.activeId === id) return Promise.resolve(true);
    return new Promise((resolve) => {
      const done = (loaded: boolean) => {
        window.removeEventListener(DOC_LOADED_EVENT, onLoaded);
        clearTimeout(timeout);
        cancelPendingOpen = null;
        resolve(loaded);
      };
      cancelPendingOpen = () => done(false);
      const onLoaded = (event: Event) => {
        if ((event as CustomEvent<string>).detail === id) done(true);
      };
      const timeout = setTimeout(() => done(false), 3000);
      window.addEventListener(DOC_LOADED_EVENT, onLoaded);
      store.switchDoc(id);
    });
  },
  /** Add alternatives. Pass one suggestion or an array of them. */
  suggest(input: Suggestion | Suggestion[], doc?: string) {
    if (!Array.isArray(input)) return suggestOne(input, doc);
    return input.map((item) => {
      try {
        return suggestOne(item, doc);
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    });
  },
  /** Add new paragraphs from Markdown, after/before a paragraph or at the end. */
  insert(input: Insertion) {
    return insertBlocks(input);
  },
  /** A new doc at the end of the tabs, left closed so the writer stays where they are. */
  create(input: { title?: string; markdown?: string } = {}) {
    const title = input.title?.trim();
    const heading = document.createElement("h1");
    heading.textContent = title ?? "";
    const doc = useEditorStore.getState().addDoc(title ? heading.outerHTML : "");
    if (!doc) return { ok: false, error: "The writer's browser storage is full." };
    if (!input.markdown?.trim()) return { ok: true, id: doc.id };
    const inserted = insertBlocks({ markdown: input.markdown, doc: doc.id });
    return inserted.ok ? { ...inserted, id: doc.id } : inserted;
  },
  /** Alternatives in a doc. Version 0 is the original. */
  list(doc?: string) {
    return listAlternatives(docTarget(doc).state).map((range) => ({
      id: range.id,
      shown: range.active,
      versions: range.variants.map(inlineToText),
      fromAi: range.ai,
    }));
  },
};

declare global {
  interface Window {
    minimalEditor?: typeof editorApi;
  }
}

export function installEditorApi() {
  window.minimalEditor = editorApi;
}

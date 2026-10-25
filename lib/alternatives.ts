import { Mark, Node, type Editor, type JSONContent } from "@tiptap/core";
import {
  DOMParser as ProseMirrorDOMParser,
  DOMSerializer,
  Fragment,
  Slice,
  type MarkType,
  type Node as ProseMirrorNode,
  type Schema,
} from "@tiptap/pm/model";
import {
  Plugin,
  PluginKey,
  TextSelection,
  type EditorState,
} from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { create } from "zustand";
import { onBeforeDocChange, useEditorStore } from "./editor-store";
import { htmlToMarkdown, markdownToHtml } from "./markdown";

/*
 * Alternatives: a stretch of text inside one paragraph that has several
 * versions. Version 0 is always the original. The version on screen lives in
 * the doc as ordinary text carrying the `alternative` mark; the mark's attrs
 * hold every version, so the doc's saved HTML carries them too. A version
 * with no text (a suggested removal) is shown as an `alternativeGap` node,
 * since a mark can't sit on nothing; it draws the original text dimmed.
 */

const MARK_NAME = "alternative";
const GAP_NAME = "alternativeGap";

export interface AlternativeAttrs {
  id: string;
  active: number;
  variants: JSONContent[][];
  /** Which versions an AI suggested, in step with `variants`. */
  ai: boolean[];
}

export interface AlternativeRange extends AlternativeAttrs {
  from: number;
  to: number;
  /** The shown version is empty, so the doc holds a gap node. */
  gap: boolean;
}

export type AlternativeResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

function createId() {
  return "alt-" + Math.random().toString(36).slice(2, 10);
}

function readAttrs(element: HTMLElement, idAttribute: string) {
  const id = element.getAttribute(idAttribute);
  if (!id) return false;
  try {
    const data = JSON.parse(element.getAttribute("data-alternatives") ?? "");
    const { active, variants, ai } = data ?? {};
    if (
      !Array.isArray(variants) ||
      variants.length < 2 ||
      !variants.every(Array.isArray) ||
      !Number.isInteger(active) ||
      active < 0 ||
      active >= variants.length
    ) {
      return false;
    }
    return { id, active, variants, ai: normalizeAi(variants, ai) };
  } catch {
    return false;
  }
}

function normalizeAi(variants: unknown[], ai: unknown): boolean[] {
  return variants.map((_, i) => Array.isArray(ai) && ai[i] === true);
}

function renderAttrs(attrs: AlternativeAttrs) {
  return {
    "data-alternatives": JSON.stringify({
      active: attrs.active,
      variants: attrs.variants,
      ai: attrs.ai,
    }),
    "data-shown": attrs.active === 0 ? "original" : "variant",
  };
}

const attributes = {
  id: { default: null, rendered: false, parseHTML: () => null },
  active: { default: 0, rendered: false, parseHTML: () => null },
  variants: { default: [], rendered: false, parseHTML: () => null },
  ai: { default: [], rendered: false, parseHTML: () => null },
};

/** A copy of `attrs` without version `index`, still showing a sensible version. */
export function withoutVersion(attrs: AlternativeAttrs, index: number): AlternativeAttrs {
  return {
    ...attrs,
    variants: attrs.variants.filter((_, i) => i !== index),
    ai: attrs.ai.filter((_, i) => i !== index),
    active:
      attrs.active === index
        ? Math.max(0, index - 1)
        : attrs.active > index
          ? attrs.active - 1
          : attrs.active,
  };
}

/** A copy of `attrs` with `content` inserted as version `index`, and shown. */
export function withVersion(
  attrs: AlternativeAttrs,
  index: number,
  content: JSONContent[],
  ai = false
): AlternativeAttrs {
  const variants = attrs.variants.slice();
  const flags = attrs.ai.slice();
  variants.splice(index, 0, content);
  flags.splice(index, 0, ai);
  return { ...attrs, variants, ai: flags, active: index };
}

/** A copy of `attrs` with version `index` rewritten by you. */
export function withVersionContent(
  attrs: AlternativeAttrs,
  index: number,
  content: JSONContent[]
): AlternativeAttrs {
  return {
    ...attrs,
    variants: attrs.variants.map((v, i) => (i === index ? content : v)),
    ai: attrs.ai.map((flag, i) => (i === index ? false : flag)),
  };
}

function attrsOf(node: ProseMirrorNode | null | undefined): AlternativeAttrs | null {
  if (!node) return null;
  const raw =
    node.type.name === GAP_NAME
      ? node.attrs
      : node.marks.find((m) => m.type.name === MARK_NAME)?.attrs;
  if (!raw) return null;
  return {
    id: raw.id,
    active: raw.active,
    variants: raw.variants,
    ai: normalizeAi(raw.variants, raw.ai),
  };
}

/** Every alternative in a textblock, in order. Repeats of an id are skipped. */
function rangesInBlock(block: ProseMirrorNode, start: number) {
  const ranges: AlternativeRange[] = [];
  let open: AlternativeRange | null = null;

  block.forEach((child, offset) => {
    const from = start + offset;
    const to = from + child.nodeSize;
    const attrs = attrsOf(child);
    const gap = child.type.name === GAP_NAME;

    if (attrs && !gap && open && !open.gap && open.id === attrs.id && open.to === from) {
      open.to = to;
      return;
    }
    open = attrs ? { ...attrs, from, to, gap } : null;
    if (open) ranges.push(open);
  });

  return ranges;
}

export function collectAlternatives(doc: ProseMirrorNode) {
  const seen = new Set<string>();
  const ranges: AlternativeRange[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    for (const range of rangesInBlock(node, pos + 1)) {
      if (seen.has(range.id)) continue;
      seen.add(range.id);
      ranges.push(range);
    }
    return false;
  });
  return ranges;
}

function findAlternative(doc: ProseMirrorNode, id: string) {
  return collectAlternatives(doc).find((range) => range.id === id) ?? null;
}

/** The alternative the cursor is in or right next to. */
export function alternativeAt(state: EditorState) {
  const { $from } = state.selection;
  if (!$from.parent.isTextblock) return null;
  const attrs = attrsOf($from.nodeBefore) ?? attrsOf($from.nodeAfter);
  if (!attrs) return null;
  return (
    rangesInBlock($from.parent, $from.start()).find((r) => r.id === attrs.id) ??
    null
  );
}

function stripAlternatives(fragment: Fragment, markType: MarkType): Fragment {
  const nodes: ProseMirrorNode[] = [];
  fragment.forEach((node) => {
    if (node.type.name === GAP_NAME) return;
    const marks = markType.removeFromSet(node.marks);
    if (node.isText) {
      nodes.push(node.mark(marks));
    } else {
      nodes.push(
        node.type.create(
          node.attrs,
          stripAlternatives(node.content, markType),
          marks
        )
      );
    }
  });
  return Fragment.fromArray(nodes);
}

/** The text each alternative holds within a fragment. */
function textById(fragment: Fragment) {
  const text = new Map<string, string>();
  fragment.descendants((node) => {
    const attrs = node.isText ? attrsOf(node) : null;
    if (attrs) text.set(attrs.id, (text.get(attrs.id) ?? "") + node.text);
  });
  return text;
}

/** Rewrites (or with `null`, removes) every alternative in a fragment. */
function mapAlternatives(
  fragment: Fragment,
  schema: Schema,
  change: (attrs: AlternativeAttrs, gap: boolean) => AlternativeAttrs | null
): Fragment {
  const markType = schema.marks[MARK_NAME];
  const nodes: ProseMirrorNode[] = [];
  fragment.forEach((node) => {
    const attrs = attrsOf(node);
    if (node.type.name === GAP_NAME) {
      const next = attrs && change(attrs, true);
      if (next) nodes.push(node.type.create(next));
      return;
    }
    let marks = node.marks;
    if (attrs) {
      const next = change(attrs, false);
      marks = markType.removeFromSet(marks);
      if (next) marks = markType.create(next).addToSet(marks);
    }
    nodes.push(
      node.isText
        ? node.mark(marks)
        : node.type.create(node.attrs, mapAlternatives(node.content, schema, change), marks)
    );
  });
  return Fragment.fromArray(nodes);
}

function inlineToJSON(fragment: Fragment, markType: MarkType) {
  const json: JSONContent[] = [];
  stripAlternatives(fragment, markType).forEach((node) => json.push(node.toJSON()));
  return json;
}

function inlineFromJSON(schema: Schema, content: JSONContent[]) {
  try {
    return Fragment.fromJSON(schema, content);
  } catch {
    return Fragment.from(schema.text(inlineToText(content) || " "));
  }
}

/** Every version, with the shown one read back from the doc (it may have been edited). */
function liveVariants(state: EditorState, range: AlternativeRange) {
  const variants = range.variants.slice();
  if (range.gap) {
    variants[range.active] = [];
  } else {
    const $from = state.doc.resolve(range.from);
    const start = $from.start();
    variants[range.active] = inlineToJSON(
      $from.parent.content.cut(range.from - start, range.to - start),
      state.schema.marks[MARK_NAME]
    );
  }
  return variants;
}

function buildContent(schema: Schema, attrs: AlternativeAttrs) {
  const content = attrs.variants[attrs.active];
  if (!content.length) {
    return Fragment.from(schema.nodes[GAP_NAME].create(attrs));
  }
  const mark = schema.marks[MARK_NAME].create(attrs);
  const nodes: ProseMirrorNode[] = [];
  inlineFromJSON(schema, content).forEach((node) =>
    nodes.push(node.mark(mark.addToSet(node.marks)))
  );
  return Fragment.fromArray(nodes);
}

export function inlineToText(content: JSONContent[]): string {
  return content
    .map((node) =>
      node.type === "text"
        ? (node.text ?? "")
        : node.type === "hardBreak"
          ? " "
          : inlineToText(node.content ?? [])
    )
    .join("");
}

/**
 * Inline Markdown for a version, so editing it keeps bold, links and so on.
 * Unformatted text stays as is, without Markdown's escapes ("2024\.").
 */
export function inlineToMarkdown(schema: Schema, content: JSONContent[]) {
  if (!content.length) return "";
  if (content.every((node) => node.type === "text" && !node.marks?.length)) {
    return inlineToText(content).trim();
  }
  const paragraph = schema.nodes.paragraph.create(null, inlineFromJSON(schema, content));
  const wrapper = document.createElement("div");
  wrapper.appendChild(
    DOMSerializer.fromSchema(schema).serializeNode(paragraph, { document })
  );
  return htmlToMarkdown(wrapper.innerHTML).trim();
}

/**
 * Text (plain or inline Markdown) to inline content. Edges keep their
 * whitespace, so "Bar. " still leaves a space before the next sentence.
 */
export function textToInline(schema: Schema, text: string): JSONContent[] {
  const flat = text.replace(/\s*\n\s*/g, " ");
  const core = flat.trim();
  if (!core) return [];

  const lead = flat.match(/^\s*/)?.[0] ?? "";
  const trail = flat.match(/\s*$/)?.[0] ?? "";
  let inner: JSONContent[] = [{ type: "text", text: core }];

  if (/[*_`[\]~\\]/.test(core)) {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = markdownToHtml(core);
    const parsed = ProseMirrorDOMParser.fromSchema(schema).parse(wrapper);
    const block = parsed.firstChild;
    if (block?.isTextblock && parsed.childCount === 1 && block.textContent) {
      inner = inlineToJSON(block.content, schema.marks[MARK_NAME]);
    }
  }

  return [
    ...(lead ? [{ type: "text", text: lead }] : []),
    ...inner,
    ...(trail ? [{ type: "text", text: trail }] : []),
  ];
}

function sameContent(a: JSONContent[], b: JSONContent[]) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Whether a range can become an alternative: one textblock, no existing alternative. */
export function canAddAlternative(state: EditorState, from: number, to: number) {
  if (from >= to) return false;
  const $from = state.doc.resolve(from);
  const $to = state.doc.resolve(to);
  const markType = state.schema.marks[MARK_NAME];
  if ($from.parent !== $to.parent || !$from.parent.isTextblock) return false;
  if (!$from.parent.type.allowsMarkType(markType)) return false;
  let taken = false;
  state.doc.nodesBetween(from, to, (node) => {
    if (attrsOf(node)) taken = true;
  });
  return !taken;
}

/**
 * Turns from..to into an alternative with the given versions after the
 * original. If from..to is exactly an existing alternative, the versions are
 * added to it.
 */
export function addAlternative(
  editor: Editor,
  { from, to }: { from: number; to: number },
  suggestions: JSONContent[][],
  options: {
    show?: "original" | "first";
    allowDuplicate?: boolean;
    ai?: boolean;
    /** Put the cursor at the end of the new alternative. */
    select?: boolean;
  } = {}
): AlternativeResult {
  const flag = options.ai ?? false;
  const { state } = editor;
  const markType = state.schema.marks[MARK_NAME];
  const existing = collectAlternatives(state.doc).find(
    (r) => r.from === from && r.to === to
  );

  let attrs: AlternativeAttrs;
  if (existing) {
    const variants = liveVariants(state, existing);
    const fresh = suggestions.filter(
      (s) => options.allowDuplicate || !variants.some((v) => sameContent(v, s))
    );
    if (!fresh.length) return { ok: false, error: "Those versions are already there." };
    attrs = {
      id: existing.id,
      active: options.show === "original" ? existing.active : variants.length,
      variants: [...variants, ...fresh],
      ai: [...existing.ai, ...fresh.map(() => flag)],
    };
  } else {
    if (!canAddAlternative(state, from, to)) {
      return {
        ok: false,
        error:
          "The text must sit inside one paragraph and not overlap another alternative.",
      };
    }
    const $from = state.doc.resolve(from);
    const start = $from.start();
    const original = inlineToJSON(
      $from.parent.content.cut(from - start, to - start),
      markType
    );
    const fresh: JSONContent[][] = [];
    for (const s of suggestions) {
      if (options.allowDuplicate || ![original, ...fresh].some((v) => sameContent(v, s))) {
        fresh.push(s);
      }
    }
    if (!fresh.length) return { ok: false, error: "That's the same as the original." };
    attrs = {
      id: createId(),
      active: options.show === "original" ? 0 : 1,
      variants: [original, ...fresh],
      ai: [false, ...fresh.map(() => flag)],
    };
  }

  const content = buildContent(state.schema, attrs);
  const tr = state.tr.replaceWith(from, to, content);
  if (options.select) {
    tr.setSelection(TextSelection.create(tr.doc, from + content.size));
  }
  editor.view.dispatch(tr);
  return { ok: true, id: attrs.id };
}

/** Rebuilds an alternative after changing its versions or which one is shown. */
export function updateAlternative(
  editor: Editor,
  id: string,
  change: (attrs: AlternativeAttrs) => AlternativeAttrs,
  options: { moveCursor?: boolean } = {}
) {
  const { state } = editor;
  const range = findAlternative(state.doc, id);
  if (!range) return false;

  const next = change({
    id,
    active: range.active,
    variants: liveVariants(state, range),
    ai: range.ai,
  });
  const tr = state.tr;

  if (next.variants.length < 2) {
    const content = inlineFromJSON(state.schema, next.variants[0] ?? []);
    tr.replaceWith(range.from, range.to, content);
    // Keeping a removal shouldn't leave two spaces where the text was.
    const $at = tr.doc.resolve(range.from);
    const after = $at.nodeAfter?.text?.[0];
    const before = $at.nodeBefore ? $at.nodeBefore.text?.slice(-1) : " ";
    if (!content.size && after === " " && before === " ") {
      tr.delete(range.from, range.from + 1);
    }
  } else {
    const content = buildContent(state.schema, next);
    tr.replaceWith(range.from, range.to, content);
    if (options.moveCursor) {
      tr.setSelection(TextSelection.create(tr.doc, range.from + content.size));
    }
  }

  editor.view.dispatch(tr.scrollIntoView());
  return true;
}

export function showVariant(editor: Editor, id: string, index: number) {
  const cursorInside = alternativeAt(editor.state)?.id === id;
  return updateAlternative(
    editor,
    id,
    (attrs) => ({ ...attrs, active: index }),
    { moveCursor: cursorInside }
  );
}

export function cycleAlternative(editor: Editor, direction: 1 | -1) {
  const range = alternativeAt(editor.state);
  if (!range) return false;
  const count = range.variants.length;
  return showVariant(editor, range.id, (range.active + direction + count) % count);
}

/** Ends an alternative, leaving either the shown version or the original as plain text. */
export function resolveAlternative(editor: Editor, id: string, keep: "shown" | "original") {
  return updateAlternative(editor, id, (attrs) => ({
    ...attrs,
    variants: [attrs.variants[keep === "shown" ? attrs.active : 0]],
    ai: [false],
  }));
}

export function resolveAllAlternatives(editor: Editor, keep: "shown" | "original") {
  const { state } = editor;
  const tr = state.tr;
  // Back to front, so earlier positions stay valid.
  for (const range of collectAlternatives(state.doc).reverse()) {
    const variants = liveVariants(state, range);
    const content = variants[keep === "shown" ? range.active : 0];
    tr.replaceWith(range.from, range.to, inlineFromJSON(state.schema, content));
  }
  if (tr.docChanged) editor.view.dispatch(tr);
}

/** Alternatives with every version read live, for the side panel and the API. */
export function listAlternatives(state: EditorState) {
  return collectAlternatives(state.doc).map((range) => ({
    ...range,
    variants: liveVariants(state, range),
  }));
}

const pluginKey = new PluginKey("alternatives");

const alternativesPlugin = (markType: () => MarkType) =>
  new Plugin({
    key: pluginKey,
    // Pasting or a line break inside an alternative leaves it in two pieces
    // in one paragraph: join them again. Splitting the paragraph leaves it in
    // two paragraphs: only the first keeps it, so cycling never duplicates text.
    appendTransaction(transactions, _old, state) {
      if (!transactions.some((tr) => tr.docChanged)) return null;
      const seen = new Set<string>();
      const tr = state.tr;
      state.doc.descendants((node, pos) => {
        if (!node.isTextblock) return true;
        const ranges = rangesInBlock(node, pos + 1);
        const firstInBlock = new Map<string, AlternativeRange>();
        for (const range of ranges) {
          if (!seen.has(range.id)) {
            seen.add(range.id);
            firstInBlock.set(range.id, range);
            continue;
          }
          const first = firstInBlock.get(range.id);
          const joinable =
            first &&
            !first.gap &&
            !range.gap &&
            !ranges.some((r) => r.id !== range.id && r.from >= first.to && r.to <= range.from);
          if (first && joinable) {
            const { id, active, variants, ai } = first;
            tr.addMark(
              tr.mapping.map(first.from),
              tr.mapping.map(range.to),
              markType().create({ id, active, variants, ai })
            );
            first.to = range.to;
            continue;
          }
          const from = tr.mapping.map(range.from);
          const to = tr.mapping.map(range.to);
          if (range.gap) tr.delete(from, to);
          else tr.removeMark(from, to, markType());
        }
        return false;
      });
      return tr.docChanged ? tr : null;
    },
    props: {
      decorations(state) {
        const range = alternativeAt(state);
        if (!range) return null;
        const { $from } = state.selection;
        return DecorationSet.create(state.doc, [
          range.gap
            ? Decoration.node(range.from, range.to, { class: "alt-current" })
            : Decoration.inline(range.from, range.to, { class: "alt-current" }),
          // The block around it stays bright while the panel dims the rest.
          Decoration.node($from.before(1), $from.after(1), { class: "alt-block" }),
        ]);
      },
      // Copying (or dragging) a whole alternative keeps its versions, up to
      // date with any edits; a piece of one becomes plain text.
      transformCopied(slice, view) {
        const { state } = view;
        const copiedText = textById(slice.content);
        const whole = new Map<string, AlternativeAttrs>();
        for (const range of collectAlternatives(state.doc)) {
          const copied = copiedText.get(range.id);
          if (copied !== undefined && copied === state.doc.textBetween(range.from, range.to, "", "")) {
            whole.set(range.id, { ...range, variants: liveVariants(state, range) });
          }
        }
        return new Slice(
          mapAlternatives(slice.content, state.schema, (attrs, gap) =>
            gap ? attrs : (whole.get(attrs.id) ?? null)
          ),
          slice.openStart,
          slice.openEnd
        );
      },
      // A pasted alternative gets its own id: moved text keeps its versions,
      // and a copy can be changed without touching the original. Plain text
      // pasted inside an alternative picks up its mark from the cursor; that
      // isn't a copy, so it just becomes part of the alternative around it.
      transformPasted(slice, view) {
        const { doc } = view.state;
        const pastedText = textById(slice.content);
        const liveText = new Map(
          collectAlternatives(doc).map((r) => [r.id, doc.textBetween(r.from, r.to, "", "")])
        );
        const ids = new Map<string, string>();
        return new Slice(
          mapAlternatives(slice.content, view.state.schema, (attrs, gap) => {
            const live = liveText.get(attrs.id);
            if (!gap && live !== undefined && pastedText.get(attrs.id) !== live) return null;
            if (!ids.has(attrs.id)) ids.set(attrs.id, createId());
            return { ...attrs, id: ids.get(attrs.id)! };
          }),
          slice.openStart,
          slice.openEnd
        );
      },
    },
  });

export const AlternativeMark = Mark.create({
  name: MARK_NAME,
  // Above links, so the alternative wraps everything inside it.
  priority: 1001,
  inclusive: false,

  addAttributes() {
    return attributes;
  },

  parseHTML() {
    return [
      {
        tag: "span[data-alternative]",
        getAttrs: (element) => readAttrs(element, "data-alternative"),
      },
    ];
  },

  renderHTML({ mark }) {
    const attrs = mark.attrs as AlternativeAttrs;
    return [
      "span",
      { class: "alt", "data-alternative": attrs.id, ...renderAttrs(attrs) },
      0,
    ];
  },

  addKeyboardShortcuts() {
    return {
      "Alt-ArrowUp": () => cycleAlternative(this.editor, -1),
      "Alt-ArrowDown": () => cycleAlternative(this.editor, 1),
      "Alt-Enter": () => {
        const ui = useAlternativesUI.getState();
        if (ui.panelOpen) {
          ui.closePanel();
          return true;
        }
        // With text selected: make it an alternative and type the new version.
        const { state } = this.editor;
        const { from, to, empty } = state.selection;
        if (!empty && canAddAlternative(state, from, to)) {
          return startAlternativeFromSelection(this.editor).ok;
        }
        const id = alternativeInSelection(state);
        return id ? showVersions(this.editor, id) : false;
      },
      // ProseMirror's Mac keymap binds Option+D to delete; here it dims instead,
      // and never deletes.
      "Alt-d": () => {
        toggleDim(this.editor);
        return true;
      },
      Escape: () => {
        if (!useAlternativesUI.getState().panelOpen) return false;
        useAlternativesUI.getState().closePanel();
        return true;
      },
    };
  },

  addProseMirrorPlugins() {
    return [alternativesPlugin(() => this.type)];
  },
});

export const AlternativeGap = Node.create({
  name: GAP_NAME,
  group: "inline",
  inline: true,
  atom: true,
  // Clicking dimmed text selects it, so the bubble can offer to undim it.
  selectable: true,
  draggable: false,

  addAttributes() {
    return attributes;
  },

  parseHTML() {
    return [
      {
        tag: "span[data-alternative-gap]",
        getAttrs: (element) => readAttrs(element, "data-alternative-gap"),
      },
    ];
  },

  renderHTML({ node }) {
    const attrs = node.attrs as AlternativeAttrs;
    return [
      "span",
      {
        class: "alt-gap",
        "data-alternative-gap": attrs.id,
        // Shown dimmed through CSS, so it never counts as doc text.
        "data-removed-text": inlineToText(attrs.variants[0] ?? []),
        ...renderAttrs(attrs),
      },
    ];
  },

  renderText() {
    return "";
  },
});

interface PanelFocus {
  id: string;
  index: number;
  /** Where the cursor goes in the version's text, or select all of it. */
  caret?: "start" | "end" | "all";
}

interface AlternativesUIState {
  panelOpen: boolean;
  /** A version the panel should put the cursor in once it renders. */
  focus: PanelFocus | null;
  /** A version added from the panel, dropped if it's left empty or unchanged. */
  fresh: { id: string; index: number } | null;
  openPanel: (focus?: PanelFocus) => void;
  closePanel: () => void;
  setFocus: (focus: PanelFocus | null) => void;
  setFresh: (fresh: AlternativesUIState["fresh"]) => void;
}

export const useAlternativesUI = create<AlternativesUIState>((set) => ({
  panelOpen: false,
  focus: null,
  fresh: null,
  openPanel: (focus) => set({ panelOpen: true, focus: focus ?? null }),
  closePanel: () => {
    pruneFreshVersion();
    set({ panelOpen: false, focus: null });
  },
  setFocus: (focus) => set({ focus }),
  setFresh: (fresh) => set({ fresh }),
}));

/** Drops the version just added in the panel if it was left empty or the same as the original. */
export function pruneFreshVersion(): { id: string; index: number } | null {
  const { fresh } = useAlternativesUI.getState();
  const { editor } = useEditorStore.getState();
  if (!fresh) return null;
  useAlternativesUI.setState({ fresh: null });
  if (!editor || editor.isDestroyed) return null;
  const range = listAlternatives(editor.state).find((r) => r.id === fresh.id);
  const content = range?.variants[fresh.index];
  if (content && (!content.length || inlineToText(content) === inlineToText(range.variants[0]))) {
    updateAlternative(editor, fresh.id, (attrs) => withoutVersion(attrs, fresh.index));
    return fresh;
  }
  return null;
}

// Tidy up before another doc opens, while edits still save to this one.
onBeforeDocChange(() => useAlternativesUI.getState().closePanel());

/** Makes the selection an alternative and opens a blank line in the panel for the new version. */
export function startAlternativeFromSelection(editor: Editor) {
  const { from, to } = editor.state.selection;
  // The blank version stays out of sight until it has text, and is dropped if it never does.
  const result = addAlternative(editor, { from, to }, [[]], { show: "original", select: true });
  if (result.ok) {
    const ui = useAlternativesUI.getState();
    ui.setFresh({ id: result.id, index: 1 });
    ui.openPanel({ id: result.id, index: 1 });
  }
  return result;
}

/** The first alternative the selection touches, or the one the cursor is in. */
export function alternativeInSelection(state: EditorState) {
  const { from, to } = state.selection;
  let id: string | null = null;
  state.doc.nodesBetween(from, to, (node) => {
    id ??= attrsOf(node)?.id ?? null;
  });
  return id ?? alternativeAt(state)?.id ?? null;
}

/** Opens the panel on an alternative, moving the cursor into it so the panel follows. */
export function showVersions(editor: Editor, id: string) {
  const range = collectAlternatives(editor.state.doc).find((r) => r.id === id);
  if (!range) return false;
  editor.commands.setTextSelection(range.to);
  useAlternativesUI.getState().openPanel({ id, index: range.active });
  return true;
}

/** Ids of dimmed alternatives (removals on screen) inside the selection. */
export function dimmedInSelection(state: EditorState) {
  const { from, to } = state.selection;
  const ids: string[] = [];
  state.doc.nodesBetween(from, to, (node) => {
    if (node.type.name === GAP_NAME) ids.push(node.attrs.id);
  });
  return ids;
}

/** Alt+D: undims dimmed text in or at the selection, otherwise dims the selection. */
export function toggleDim(editor: Editor) {
  const { state } = editor;
  const dimmed = dimmedInSelection(state);
  const at = alternativeAt(state);
  if (!dimmed.length && at?.gap) dimmed.push(at.id);
  if (dimmed.length) {
    undim(editor, dimmed);
    return true;
  }
  const { from, to, empty } = state.selection;
  if (empty || !canAddAlternative(state, from, to)) return false;
  return dimSelection(editor).ok;
}

/** Brings dimmed text back: drops the removal versions, keeping any other rewrites. */
export function undim(editor: Editor, ids: string[]) {
  for (const id of ids) {
    updateAlternative(editor, id, (attrs) => {
      const keep = attrs.variants.map((v, i) => i === 0 || v.length > 0);
      const variants = attrs.variants.filter((_, i) => keep[i]);
      return {
        ...attrs,
        variants,
        ai: attrs.ai.filter((_, i) => keep[i]),
        active: Math.max(0, variants.indexOf(attrs.variants[attrs.active])),
      };
    });
  }
}

/** Dims the selection: an alternative whose shown version removes it. */
export function dimSelection(editor: Editor) {
  const { from, to } = editor.state.selection;
  return addAlternative(editor, { from, to }, [[]], { select: true });
}

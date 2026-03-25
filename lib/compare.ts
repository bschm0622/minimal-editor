export type DiffSegmentType = "equal" | "replace" | "insert" | "delete";
export type WordDiffPartType = "equal" | "insert" | "delete";

export type DiffSegment = {
  type: DiffSegmentType;
  draftStart: number;
  draftEnd: number;
  compareStart: number;
  compareEnd: number;
  draftBlocks: string[];
  compareBlocks: string[];
};

export type WordDiffPart = {
  type: WordDiffPartType;
  text: string;
};

type AlignmentOp =
  | { type: "match"; draftIndex: number; compareIndex: number; similarity: number }
  | { type: "delete"; draftIndex: number; compareIndex: number }
  | { type: "insert"; draftIndex: number; compareIndex: number };

export function splitMarkdownBlocks(markdown: string) {
  const lines = markdown.trim().split("\n");

  if (lines.length === 1 && lines[0] === "") {
    return [] as string[];
  }

  const blocks: string[] = [];
  let current: string[] = [];
  let inFence = false;

  const flush = () => {
    const block = current.join("\n").trim();

    if (block) {
      blocks.push(block);
    }

    current = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const isFence = /^```/.test(trimmed);

    if (isFence) {
      current.push(line);
      inFence = !inFence;

      if (!inFence) {
        flush();
      }
      continue;
    }

    if (inFence) {
      current.push(line);
      continue;
    }

    if (!trimmed) {
      flush();
      continue;
    }

    if (/^#{1,6}\s/.test(trimmed)) {
      flush();
      blocks.push(trimmed);
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      flush();
      blocks.push(trimmed);
      continue;
    }

    if (/^([-*+]\s|\d+\.\s)/.test(trimmed)) {
      flush();
      blocks.push(trimmed);
      continue;
    }

    current.push(line);
  }

  flush();

  return blocks;
}

function normalizeBlock(block: string) {
  return block.replace(/\s+/g, " ").trim();
}

function getWordSet(block: string) {
  return new Set(
    normalizeBlock(block)
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .filter((word) => word.length > 1)
  );
}

function blockSimilarity(a: string, b: string) {
  if (!a || !b) return 0;
  if (a === b) return 1;

  const aWords = getWordSet(a);
  const bWords = getWordSet(b);

  if (aWords.size === 0 || bWords.size === 0) {
    return 0;
  }

  let overlap = 0;

  for (const word of aWords) {
    if (bWords.has(word)) {
      overlap += 1;
    }
  }

  return (2 * overlap) / (aWords.size + bWords.size);
}

export function joinMarkdownBlocks(blocks: string[]) {
  return blocks.filter(Boolean).join("\n\n").trim();
}

export function replaceMarkdownBlocks(
  blocks: string[],
  start: number,
  end: number,
  replacement: string[]
) {
  return [...blocks.slice(0, start), ...replacement, ...blocks.slice(end)];
}

export function computeBlockDiff(draftMarkdown: string, compareMarkdown: string) {
  const draftBlocks = splitMarkdownBlocks(draftMarkdown);
  const compareBlocks = splitMarkdownBlocks(compareMarkdown);
  const normalizedDraft = draftBlocks.map(normalizeBlock);
  const normalizedCompare = compareBlocks.map(normalizeBlock);
  const gapPenalty = -0.65;
  const dp = Array.from({ length: normalizedDraft.length + 1 }, () =>
    Array<number>(normalizedCompare.length + 1).fill(0)
  );

  for (let i = normalizedDraft.length - 1; i >= 0; i -= 1) {
    dp[i][normalizedCompare.length] = dp[i + 1][normalizedCompare.length] + gapPenalty;
  }

  for (let j = normalizedCompare.length - 1; j >= 0; j -= 1) {
    dp[normalizedDraft.length][j] = dp[normalizedDraft.length][j + 1] + gapPenalty;
  }

  for (let i = normalizedDraft.length - 1; i >= 0; i -= 1) {
    for (let j = normalizedCompare.length - 1; j >= 0; j -= 1) {
      const similarity = blockSimilarity(normalizedDraft[i], normalizedCompare[j]);
      const diagonal =
        dp[i + 1][j + 1] + (similarity >= 0.34 ? 2.4 + similarity : -1.15);
      const deleteScore = dp[i + 1][j] + gapPenalty;
      const insertScore = dp[i][j + 1] + gapPenalty;

      dp[i][j] = Math.max(diagonal, deleteScore, insertScore);
    }
  }

  const ops: AlignmentOp[] = [];
  let i = 0;
  let j = 0;

  while (i < normalizedDraft.length && j < normalizedCompare.length) {
    const similarity = blockSimilarity(normalizedDraft[i], normalizedCompare[j]);
    const diagonal =
      dp[i + 1][j + 1] + (similarity >= 0.34 ? 2.4 + similarity : -1.15);
    const deleteScore = dp[i + 1][j] + gapPenalty;
    const bestScore = dp[i][j];

    if (bestScore === diagonal) {
      ops.push({
        type: "match",
        draftIndex: i,
        compareIndex: j,
        similarity,
      });
      i += 1;
      j += 1;
      continue;
    }

    if (bestScore === deleteScore) {
      ops.push({ type: "delete", draftIndex: i, compareIndex: j });
      i += 1;
      continue;
    }

    ops.push({ type: "insert", draftIndex: i, compareIndex: j });
    j += 1;
  }

  while (i < normalizedDraft.length) {
    ops.push({ type: "delete", draftIndex: i, compareIndex: j });
    i += 1;
  }

  while (j < normalizedCompare.length) {
    ops.push({ type: "insert", draftIndex: i, compareIndex: j });
    j += 1;
  }

  const segments: DiffSegment[] = [];
  let cursorDraft = 0;
  let cursorCompare = 0;
  let pendingDeletes = 0;
  let pendingInserts = 0;

  const flushPending = () => {
    if (pendingDeletes === 0 && pendingInserts === 0) {
      return;
    }

    const draftStart = cursorDraft - pendingDeletes;
    const compareStart = cursorCompare - pendingInserts;

    const type: DiffSegmentType =
      pendingDeletes > 0 && pendingInserts > 0
        ? "replace"
        : pendingDeletes > 0
          ? "delete"
          : "insert";

    segments.push({
      type,
      draftStart,
      draftEnd: cursorDraft,
      compareStart,
      compareEnd: cursorCompare,
      draftBlocks: draftBlocks.slice(draftStart, cursorDraft),
      compareBlocks: compareBlocks.slice(compareStart, cursorCompare),
    });

    pendingDeletes = 0;
    pendingInserts = 0;
  };

  for (const op of ops) {
    if (op.type === "match") {
      flushPending();
      const isEqual =
        op.similarity >= 0.999 &&
        normalizedDraft[cursorDraft] === normalizedCompare[cursorCompare];

      segments.push({
        type: isEqual ? "equal" : "replace",
        draftStart: cursorDraft,
        draftEnd: cursorDraft + 1,
        compareStart: cursorCompare,
        compareEnd: cursorCompare + 1,
        draftBlocks: [draftBlocks[cursorDraft]],
        compareBlocks: [compareBlocks[cursorCompare]],
      });
      cursorDraft += 1;
      cursorCompare += 1;
      continue;
    }

    if (op.type === "delete") {
      pendingDeletes += 1;
      cursorDraft += 1;
      continue;
    }

    pendingInserts += 1;
    cursorCompare += 1;
  }

  flushPending();

  return {
    draftBlocks,
    compareBlocks,
    segments,
  };
}

function tokenizeWords(text: string) {
  return text.match(/\S+\s*/g) ?? [];
}

export function computeWordDiff(draftText: string, compareText: string) {
  const draftTokens = tokenizeWords(draftText);
  const compareTokens = tokenizeWords(compareText);
  const dp = Array.from({ length: draftTokens.length + 1 }, () =>
    Array<number>(compareTokens.length + 1).fill(0)
  );

  for (let i = draftTokens.length - 1; i >= 0; i -= 1) {
    for (let j = compareTokens.length - 1; j >= 0; j -= 1) {
      dp[i][j] =
        draftTokens[i] === compareTokens[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const parts: WordDiffPart[] = [];
  let i = 0;
  let j = 0;

  const pushPart = (type: WordDiffPartType, text: string) => {
    const previous = parts[parts.length - 1];

    if (previous?.type === type) {
      previous.text += text;
      return;
    }

    parts.push({ type, text });
  };

  while (i < draftTokens.length && j < compareTokens.length) {
    if (draftTokens[i] === compareTokens[j]) {
      pushPart("equal", draftTokens[i]);
      i += 1;
      j += 1;
      continue;
    }

    if (dp[i + 1][j] >= dp[i][j + 1]) {
      pushPart("delete", draftTokens[i]);
      i += 1;
    } else {
      pushPart("insert", compareTokens[j]);
      j += 1;
    }
  }

  while (i < draftTokens.length) {
    pushPart("delete", draftTokens[i]);
    i += 1;
  }

  while (j < compareTokens.length) {
    pushPart("insert", compareTokens[j]);
    j += 1;
  }

  return parts;
}

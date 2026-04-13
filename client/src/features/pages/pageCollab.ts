import { baseApiUrl } from "../../common/baseApi";
import type { PageRequest } from "./pageApi";
import type {
  AppliedCollabPatch,
  CollabCursorPosition,
  CollabPatch,
  CollabParticipant,
  CollabRemoteCursor,
  CollabServerEnvelope,
  CollabSnapshot,
  CollabStatus,
  HtmlCollabPatch,
  ScalarCollabPatch,
  TextCollabPatch,
} from "./pageCollabTypes";

const TEXT_FIELDS = ["title", "url", "shortDesc"] as const;
const SCALAR_FIELDS = ["parentId", "isProtected", "isPinned", "isCategoryPage", "sortChildrenDesc"] as const;

type TextField = (typeof TEXT_FIELDS)[number];
type ScalarField = (typeof SCALAR_FIELDS)[number];

export function buildCollabPage(page: Partial<PageRequest> & { id: number }): PageRequest {
  return {
    id: page.id,
    parentId: page.parentId ?? null,
    url: page.url ?? "",
    title: page.title ?? "",
    shortDesc: page.shortDesc ?? "",
    content: normalizeHtmlFragment(page.content ?? ""),
    isProtected: page.isProtected ?? false,
    isPinned: page.isPinned ?? false,
    isCategoryPage: page.isCategoryPage ?? false,
    sortChildrenDesc: page.sortChildrenDesc ?? false,
  };
}

export function createTextPatch(field: TextField, before: string, after: string, baseVersion: number): TextCollabPatch | null {
  if (before === after) return null;

  const beforeRunes = toRunes(before);
  const afterRunes = toRunes(after);
  let prefix = 0;
  const maxPrefix = Math.min(beforeRunes.length, afterRunes.length);
  while (prefix < maxPrefix && beforeRunes[prefix] === afterRunes[prefix]) {
    prefix += 1;
  }

  let suffix = 0;
  const maxSuffix = Math.min(beforeRunes.length - prefix, afterRunes.length - prefix);
  while (
    suffix < maxSuffix &&
    beforeRunes[beforeRunes.length - 1 - suffix] === afterRunes[afterRunes.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  return {
    id: createPatchId(),
    kind: "text",
    field,
    baseVersion,
    start: prefix,
    deleteText: beforeRunes.slice(prefix, beforeRunes.length - suffix || undefined).join(''),
    insertText: afterRunes.slice(prefix, afterRunes.length - suffix || undefined).join(''),
  };
}

export function createScalarPatch(field: ScalarField, value: number | boolean | null, baseVersion: number): ScalarCollabPatch {
  return {
    id: createPatchId(),
    kind: "set",
    field,
    baseVersion,
    value,
  };
}

export function createHtmlPatch(beforeHtml: string, afterHtml: string, baseVersion: number): HtmlCollabPatch | null {
  const normalizedBefore = normalizeHtmlFragment(beforeHtml);
  const normalizedAfter = normalizeHtmlFragment(afterHtml);
  if (normalizedBefore === normalizedAfter) return null;

  const beforeBlocks = splitHtmlBlocks(normalizedBefore);
  const afterBlocks = splitHtmlBlocks(normalizedAfter);
  const prefix = commonArrayPrefix(beforeBlocks, afterBlocks);
  const suffix = commonArraySuffix(beforeBlocks, afterBlocks, prefix);
  const beforeRange = beforeBlocks.slice(prefix, beforeBlocks.length - suffix);
  const afterRange = afterBlocks.slice(prefix, afterBlocks.length - suffix);

  const patch: HtmlCollabPatch = {
    id: createPatchId(),
    kind: "html",
    field: "content",
    baseVersion,
    blockIndex: prefix,
    beforeBlocks: beforeRange,
    afterBlocks: afterRange,
  };

  if (beforeRange.length === 1 && afterRange.length === 1) {
    const inlinePatch = createSafeInlineHtmlPatch(beforeRange[0], afterRange[0]);
    if (inlinePatch) {
      patch.htmlStart = inlinePatch.start;
      patch.htmlDeleteText = inlinePatch.deleteText;
      patch.htmlInsertText = inlinePatch.insertText;
    }
  }

  return patch;
}

export function applyPatchToPage(page: PageRequest, patch: AppliedCollabPatch | CollabPatch): PageRequest {
  const nextPage = { ...page };

  if (patch.kind === "text") {
    const field = patch.field;
    const current = field === "title" ? nextPage.title : field === "url" ? nextPage.url : nextPage.shortDesc;
    const next = applyTextPatch(current, patch.start, patch.deleteText, patch.insertText);
    if (field === "title") nextPage.title = next;
    if (field === "url") nextPage.url = next;
    if (field === "shortDesc") nextPage.shortDesc = next;
    return nextPage;
  }

  if (patch.kind === "set") {
    const field = patch.field;
    if (field === "parentId") {
      nextPage.parentId = (patch.value as number | null) ?? null;
      return nextPage;
    }
    if (field === "isProtected") nextPage.isProtected = Boolean(patch.value);
    if (field === "isPinned") nextPage.isPinned = Boolean(patch.value);
    if (field === "isCategoryPage") nextPage.isCategoryPage = Boolean(patch.value);
    if (field === "sortChildrenDesc") nextPage.sortChildrenDesc = Boolean(patch.value);
    return nextPage;
  }

  nextPage.content = applyHtmlPatch(nextPage.content, patch);
  return nextPage;
}

export function normalizeHtmlFragment(fragment: string): string {
  const container = document.createElement("div");
  container.innerHTML = fragment;
  removeIgnorableNodes(container);
  return container.innerHTML;
}

export function splitHtmlBlocks(fragment: string): string[] {
  const container = document.createElement("div");
  container.innerHTML = fragment;
  removeIgnorableNodes(container);
  return Array.from(container.childNodes).map((node) => serializeNode(node));
}

export class PageCollabClient {
  private socket: WebSocket | null = null;
  private closedByUser = false;
  private reconnectTimer: number | null = null;

  constructor(
    private readonly pageId: number,
    private readonly handlers: {
      onSnapshot: (snapshot: CollabSnapshot) => void;
      onPatch: (patch: AppliedCollabPatch) => void;
      onPresence: (participants: CollabParticipant[]) => void;
      onCursor: (cursor: CollabRemoteCursor) => void;
      onError: (message: string, snapshot?: CollabSnapshot) => void;
      onStatus: (status: CollabStatus) => void;
    }
  ) {}

  connect() {
    this.closedByUser = false;
    this.handlers.onStatus(this.socket ? "reconnecting" : "connecting");
    this.socket = new WebSocket(buildCollabUrl(this.pageId));

    this.socket.addEventListener("open", () => {
      this.handlers.onStatus("connected");
    });

    this.socket.addEventListener("message", (event) => {
      const envelope = JSON.parse(event.data) as CollabServerEnvelope;
      switch (envelope.type) {
        case "snapshot":
          if (envelope.snapshot) this.handlers.onSnapshot(envelope.snapshot);
          break;
        case "patch":
          if (envelope.patch) this.handlers.onPatch(envelope.patch);
          break;
        case "presence":
          this.handlers.onPresence(envelope.participants ?? []);
          break;
        case "cursor":
          if (envelope.cursor) this.handlers.onCursor(envelope.cursor);
          break;
        case "error":
          this.handlers.onError(envelope.message ?? "Collaboration error", envelope.snapshot);
          break;
      }
    });

    this.socket.addEventListener("close", () => {
      this.socket = null;
      if (this.closedByUser) {
        this.handlers.onStatus("disconnected");
        return;
      }
      this.handlers.onStatus("reconnecting");
      this.scheduleReconnect();
    });

    this.socket.addEventListener("error", () => {
      this.handlers.onStatus("reconnecting");
    });
  }

  disconnect() {
    this.closedByUser = true;
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket?.close();
    this.socket = null;
    this.handlers.onStatus("disconnected");
  }

  sendPatch(patch: CollabPatch): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return false;
    }
    this.socket.send(JSON.stringify({ type: "patch", patch }));
    return true;
  }

  sendCursor(cursor: CollabCursorPosition): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify({ type: "cursor", cursor }));
  }

  private scheduleReconnect() {
    if (this.reconnectTimer !== null) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.closedByUser) {
        this.connect();
      }
    }, 1500);
  }
}

function buildCollabUrl(pageId: number): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${baseApiUrl}/editor/collab/pages/${pageId}/ws`;
}

function createPatchId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// Split a string into an array of Unicode code points (runes).
// Mirrors Go's []rune so that patch offsets are consistent between
// the JS client and the Go server for all Unicode characters,
// including supplementary-plane characters (emoji, etc.) which are
// 2 UTF-16 code units in JS but a single rune in Go.
function toRunes(s: string): string[] { return [...s]; }

function applyTextPatch(current: string, start: number, deleteText: string, insertText: string): string {
  const currentRunes = toRunes(current);
  const deleteRunes = toRunes(deleteText);
  const end = start + deleteRunes.length;
  if (start < 0 || end > currentRunes.length) {
    throw new Error("Invalid text patch range");
  }
  if (currentRunes.slice(start, end).join('') !== deleteText) {
    throw new Error("Text patch conflict");
  }
  return currentRunes.slice(0, start).join('') + insertText + currentRunes.slice(end).join('');
}

function applyHtmlPatch(current: string, patch: HtmlCollabPatch): string {
  const normalized = normalizeHtmlFragment(current);
  const blocks = splitHtmlBlocks(normalized);
  const end = patch.blockIndex + patch.beforeBlocks.length;
  if (patch.blockIndex < 0 || end > blocks.length) {
    throw new Error("Invalid HTML patch range");
  }
  for (let index = 0; index < patch.beforeBlocks.length; index += 1) {
    if (blocks[patch.blockIndex + index] !== patch.beforeBlocks[index]) {
      throw new Error("HTML patch conflict");
    }
  }
  if (typeof patch.htmlStart === "number") {
    if (patch.beforeBlocks.length !== 1 || patch.afterBlocks.length !== 1) {
      throw new Error("HTML patch conflict");
    }
    const updatedBlock = applyTextPatch(
      blocks[patch.blockIndex],
      patch.htmlStart,
      patch.htmlDeleteText ?? "",
      patch.htmlInsertText ?? ""
    );
    if (updatedBlock !== patch.afterBlocks[0]) {
      throw new Error("HTML patch conflict");
    }
  }
  return [
    ...blocks.slice(0, patch.blockIndex),
    ...patch.afterBlocks,
    ...blocks.slice(end),
  ].join("");
}

function commonArrayPrefix(before: string[], after: string[]): number {
  let index = 0;
  while (index < before.length && index < after.length && before[index] === after[index]) {
    index += 1;
  }
  return index;
}

function commonArraySuffix(before: string[], after: string[], prefix: number): number {
  let suffix = 0;
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) {
    suffix += 1;
  }
  return suffix;
}

function removeIgnorableNodes(container: HTMLElement) {
  Array.from(container.childNodes).forEach((node) => {
    if (node.nodeType === Node.COMMENT_NODE) {
      container.removeChild(node);
      return;
    }
    if (node.nodeType === Node.TEXT_NODE && !(node.textContent ?? "").trim()) {
      container.removeChild(node);
    }
  });
}

function serializeNode(node: ChildNode): string {
  const wrapper = document.createElement("div");
  wrapper.appendChild(node.cloneNode(true));
  return wrapper.innerHTML;
}

function createSafeInlineHtmlPatch(beforeBlock: string, afterBlock: string): { start: number; deleteText: string; insertText: string } | null {
  if (!hasSameRootTag(beforeBlock, afterBlock)) {
    return null;
  }
  const textPatch = diffStrings(beforeBlock, afterBlock);
  if (!textPatch) {
    return null;
  }
  if (containsMarkup(textPatch.deleteText) || containsMarkup(textPatch.insertText)) {
    return null;
  }
  return textPatch;
}

function diffStrings(before: string, after: string): { start: number; deleteText: string; insertText: string } | null {
  if (before === after) return null;
  const beforeRunes = toRunes(before);
  const afterRunes = toRunes(after);
  let start = 0;
  const maxPrefix = Math.min(beforeRunes.length, afterRunes.length);
  while (start < maxPrefix && beforeRunes[start] === afterRunes[start]) {
    start += 1;
  }
  let suffix = 0;
  const maxSuffix = Math.min(beforeRunes.length - start, afterRunes.length - start);
  while (
    suffix < maxSuffix &&
    beforeRunes[beforeRunes.length - 1 - suffix] === afterRunes[afterRunes.length - 1 - suffix]
  ) {
    suffix += 1;
  }
  return {
    start,
    deleteText: beforeRunes.slice(start, beforeRunes.length - suffix || undefined).join(''),
    insertText: afterRunes.slice(start, afterRunes.length - suffix || undefined).join(''),
  };
}

function hasSameRootTag(beforeBlock: string, afterBlock: string): boolean {
  const beforeName = getRootTagName(beforeBlock);
  const afterName = getRootTagName(afterBlock);
  return !!beforeName && beforeName === afterName;
}

function getRootTagName(block: string): string | null {
  const container = document.createElement("div");
  container.innerHTML = block;
  const firstElement = container.firstElementChild;
  return firstElement?.tagName.toLowerCase() ?? null;
}

function containsMarkup(value: string): boolean {
  return value.includes("<") || value.includes(">");
}

/**
 * Transform a remote text patch to apply correctly on top of a locally-applied
 * pending patch (client-side OT, mirrors the server's transformTextPatch).
 * Returns the adjusted patch, or null if there is an irrecoverable conflict.
 */
export function transformRemoteTextPatch(
  remote: TextCollabPatch,
  pending: TextCollabPatch
): TextCollabPatch | null {
  if (remote.field !== pending.field) return remote;

  const pendingDeleteLen = toRunes(pending.deleteText).length;
  const pendingInsertLen = toRunes(pending.insertText).length;
  const remoteDeleteLen = toRunes(remote.deleteText).length;
  const pendingEnd = pending.start + pendingDeleteLen;
  const remoteEnd = remote.start + remoteDeleteLen;
  const delta = pendingInsertLen - pendingDeleteLen;

  // Both are pure inserts at the same position – tie-break by patch ID
  if (pending.deleteText === "" && remote.deleteText === "" && pending.start === remote.start) {
    if (pending.id < remote.id) {
      return { ...remote, start: remote.start + pendingInsertLen };
    }
    return { ...remote };
  }

  // Pending is entirely before remote – shift remote right by the net change
  if (pendingEnd <= remote.start) {
    return { ...remote, start: remote.start + delta };
  }

  // Remote is entirely before pending – no position adjustment needed
  if (remoteEnd <= pending.start) {
    return { ...remote };
  }

  // Overlapping edits – irrecoverable conflict
  return null;
}

/**
 * Transform a remote HTML-block patch to apply correctly on top of a
 * locally-applied pending HTML patch. Returns null on conflict.
 */
export function transformRemoteHtmlPatch(
  remote: HtmlCollabPatch,
  pending: HtmlCollabPatch
): HtmlCollabPatch | null {
  const pendingEnd = pending.blockIndex + pending.beforeBlocks.length;
  const remoteEnd = remote.blockIndex + remote.beforeBlocks.length;
  const delta = pending.afterBlocks.length - pending.beforeBlocks.length;

  // Both are pure inserts at the same block position – tie-break by patch ID
  if (
    pending.beforeBlocks.length === 0 &&
    remote.beforeBlocks.length === 0 &&
    pending.blockIndex === remote.blockIndex
  ) {
    if (pending.id < remote.id) {
      return { ...remote, blockIndex: remote.blockIndex + pending.afterBlocks.length };
    }
    return { ...remote };
  }

  // Pending entirely before remote – shift remote block index right
  if (pendingEnd <= remote.blockIndex) {
    return { ...remote, blockIndex: remote.blockIndex + delta };
  }

  // Remote entirely before pending – no adjustment needed
  if (remoteEnd <= pending.blockIndex) {
    return { ...remote };
  }

  // Overlapping block ranges – conflict
  return null;
}

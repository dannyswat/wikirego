import * as Y from "yjs";

import { base64, fromBase64 } from "../../common/base64";
import { baseApiUrl } from "../../common/baseApi";
import type { PageRequest } from "./pageApi";
import type {
  CollabCursorPosition,
  CollabDocumentMessage,
  CollabPageChangeSource,
  CollabParticipant,
  CollabRemoteCursor,
  CollabServerEnvelope,
  CollabSnapshot,
  CollabStatus,
} from "./pageCollabTypes";

const TEXT_FIELDS = ["title", "url", "shortDesc", "content"] as const;
const SCALAR_FIELDS = ["parentId", "isProtected", "isPinned", "isCategoryPage", "sortChildrenDesc"] as const;

const INIT_ORIGIN = "collab-init";
const LOCAL_ORIGIN = "collab-local";
const REMOTE_ORIGIN = "collab-remote";

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

export function normalizeHtmlFragment(fragment: string): string {
  const container = document.createElement("div");
  container.innerHTML = fragment;
  removeIgnorableNodes(container);
  return container.innerHTML;
}

export function isCollaborationEnabled(setting?: { enable_collaboration?: boolean } | null): boolean {
  return setting?.enable_collaboration === true;
}

export function shouldRestoreAutoSaveDraft(
  page: Partial<PageRequest> | undefined | null,
  expectedPage?: Partial<PageRequest> | null,
): boolean {
  if (!page) return false;

  const contentText = stripHtml(page.content ?? "");
  const hasMeaningfulContent = [page.title, page.url, page.shortDesc, contentText]
    .some((value) => (value ?? "").trim() !== "")
    || page.parentId != null
    || Boolean(page.isProtected)
    || Boolean(page.isPinned)
    || Boolean(page.isCategoryPage)
    || Boolean(page.sortChildrenDesc);

  if (!hasMeaningfulContent) {
    return false;
  }

  if ((expectedPage?.id ?? 0) > 0 && page.id !== expectedPage?.id) {
    return false;
  }

  if (expectedPage?.url && page.url && page.url !== expectedPage.url) {
    return false;
  }

  const expectedContentText = stripHtml(expectedPage?.content ?? "");
  const sameMetadata = (page.title ?? "") === (expectedPage?.title ?? "")
    && (page.url ?? "") === (expectedPage?.url ?? "")
    && (page.shortDesc ?? "") === (expectedPage?.shortDesc ?? "")
    && (page.parentId ?? null) === (expectedPage?.parentId ?? null)
    && Boolean(page.isProtected) === Boolean(expectedPage?.isProtected)
    && Boolean(page.isPinned) === Boolean(expectedPage?.isPinned)
    && Boolean(page.isCategoryPage) === Boolean(expectedPage?.isCategoryPage)
    && Boolean(page.sortChildrenDesc) === Boolean(expectedPage?.sortChildrenDesc);

  if (sameMetadata && expectedContentText !== "" && contentText === "") {
    return false;
  }

  return true;
}

export class PageCollabClient {
  private socket: WebSocket | null = null;
  private closedByUser = false;
  private reconnectTimer: number | null = null;
  private clientId = "";
  private docInitialized = false;
  private pendingLocalUpdate: Uint8Array | null = null;
  private pendingPage: PageRequest;
  private pendingRemoteDocuments: CollabDocumentMessage[] = [];

  private readonly doc = new Y.Doc();
  private readonly meta = this.doc.getMap<number | boolean | null>("page-meta");
  private readonly textFields: Record<TextField, Y.Text> = {
    title: this.doc.getText("title"),
    url: this.doc.getText("url"),
    shortDesc: this.doc.getText("shortDesc"),
    content: this.doc.getText("content"),
  };

  constructor(
    private readonly pageId: number,
    initialPage: PageRequest,
    private readonly handlers: {
      onSnapshot: (snapshot: CollabSnapshot) => void;
      onPageChange: (page: PageRequest, source: CollabPageChangeSource) => void;
      onPresence: (participants: CollabParticipant[]) => void;
      onCursor: (cursor: CollabRemoteCursor) => void;
      onError: (message: string) => void;
      onStatus: (status: CollabStatus) => void;
    }
  ) {
    this.pendingPage = buildCollabPage(initialPage);
    this.doc.on("update", this.handleDocUpdate);
  }

  connect() {
    this.closedByUser = false;
    this.handlers.onStatus(this.socket ? "reconnecting" : "connecting");
    this.socket = new WebSocket(buildCollabUrl(this.pageId));

    this.socket.addEventListener("open", () => {
      this.handlers.onStatus("connected");
      this.flushPendingUpdate();
    });

    this.socket.addEventListener("message", (event) => {
      const envelope = JSON.parse(event.data) as CollabServerEnvelope;
      switch (envelope.type) {
        case "snapshot":
          if (envelope.snapshot) {
            this.clientId = envelope.snapshot.clientId ?? this.clientId;
            if (envelope.snapshot.page && !this.docInitialized) {
              this.pendingPage = buildCollabPage(envelope.snapshot.page);
              this.handlers.onPageChange(this.pendingPage, "remote");
            }
            this.handlers.onSnapshot(envelope.snapshot);
            if (envelope.snapshot.shouldSeed && !this.docInitialized) {
              this.seedDocumentFromPendingPage();
            }
          }
          break;
        case "document":
          if (envelope.document) {
            this.applyRemoteDocument(envelope.document);
          }
          break;
        case "presence":
          this.handlers.onPresence(envelope.participants ?? []);
          break;
        case "cursor":
          if (envelope.cursor) {
            this.handlers.onCursor(envelope.cursor);
          }
          break;
        case "sync-request":
          if (envelope.requesterClientId && envelope.requesterClientId !== this.clientId) {
            if (!this.docInitialized) {
              this.seedDocumentFromPendingPage();
            }
            this.sendDocument({
              update: this.encodeStateAsBase64(),
              fullState: true,
              targetClientId: envelope.requesterClientId,
            });
          }
          break;
        case "error":
          this.handlers.onError(envelope.message ?? "Collaboration error");
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

  replacePage(page: PageRequest, origin: string = LOCAL_ORIGIN) {
    const normalized = buildCollabPage(page);
    this.pendingPage = normalized;
    if (!this.docInitialized) {
      this.handlers.onPageChange(normalized, origin === REMOTE_ORIGIN ? "remote" : "local");
      return;
    }
    this.applyPageToDoc(normalized, origin);
  }

  private applyPageToDoc(page: PageRequest, origin: string) {
    this.doc.transact(() => {
      for (const field of TEXT_FIELDS) {
        const nextValue = field === "content" ? normalizeHtmlFragment(page[field]) : page[field];
        replaceText(this.textFields[field], nextValue);
      }
      this.meta.set("parentId", page.parentId);
      this.meta.set("isProtected", page.isProtected);
      this.meta.set("isPinned", page.isPinned);
      this.meta.set("isCategoryPage", page.isCategoryPage);
      this.meta.set("sortChildrenDesc", page.sortChildrenDesc);
    }, origin);
  }

  updateTextField(field: Exclude<TextField, "content">, value: string) {
    if (!this.docInitialized) {
      const nextPage = { ...this.pendingPage, [field]: value } as PageRequest;
      this.pendingPage = nextPage;
      this.handlers.onPageChange(nextPage, "local");
      return;
    }
    if (this.textFields[field].toString() === value) return;
    this.doc.transact(() => {
      replaceText(this.textFields[field], value);
    }, LOCAL_ORIGIN);
  }

  updateContent(value: string) {
    const normalized = normalizeHtmlFragment(value);
    if (!this.docInitialized) {
      const nextPage = { ...this.pendingPage, content: normalized };
      this.pendingPage = nextPage;
      this.handlers.onPageChange(nextPage, "local");
      return;
    }
    if (this.textFields.content.toString() === normalized) return;
    this.doc.transact(() => {
      replaceText(this.textFields.content, normalized);
    }, LOCAL_ORIGIN);
  }

  updateScalarField(field: ScalarField, value: number | boolean | null) {
    if (!this.docInitialized) {
      const nextPage = { ...this.pendingPage, [field]: value } as PageRequest;
      this.pendingPage = nextPage;
      this.handlers.onPageChange(nextPage, "local");
      return;
    }
    const current = this.meta.get(field) ?? null;
    if (current === value) return;
    this.doc.transact(() => {
      this.meta.set(field, value);
    }, LOCAL_ORIGIN);
  }

  getPage(): PageRequest {
    if (!this.docInitialized) {
      return this.pendingPage;
    }
    return {
      id: this.pageId,
      parentId: toNullableNumber(this.meta.get("parentId")),
      title: this.textFields.title.toString(),
      url: this.textFields.url.toString(),
      shortDesc: this.textFields.shortDesc.toString(),
      content: normalizeHtmlFragment(this.textFields.content.toString()),
      isProtected: Boolean(this.meta.get("isProtected")),
      isPinned: Boolean(this.meta.get("isPinned")),
      isCategoryPage: Boolean(this.meta.get("isCategoryPage")),
      sortChildrenDesc: Boolean(this.meta.get("sortChildrenDesc")),
    };
  }

  getClientId() {
    return this.clientId;
  }

  sendCursor(cursor: CollabCursorPosition): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify({ type: "cursor", cursor }));
  }

  private readonly handleDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin !== INIT_ORIGIN) {
      this.handlers.onPageChange(this.getPage(), origin === REMOTE_ORIGIN ? "remote" : "local");
    }
    if (origin !== LOCAL_ORIGIN) {
      return;
    }

    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.pendingLocalUpdate = this.pendingLocalUpdate
        ? Y.mergeUpdates([this.pendingLocalUpdate, update])
        : update;
      return;
    }

    this.sendDocument({ update: encodeUpdate(update) });
  };

  private applyRemoteDocument(document: CollabDocumentMessage) {
    if (document.targetClientId && document.targetClientId !== this.clientId) {
      return;
    }
    if (!document.fullState && !this.docInitialized) {
      this.pendingRemoteDocuments.push(document);
      return;
    }
    if (!this.docInitialized) {
      this.docInitialized = true;
    }
    const update = new Uint8Array(fromBase64(document.update));
    Y.applyUpdate(this.doc, update, REMOTE_ORIGIN);
    this.pendingPage = this.getPage();
    if (document.fullState && this.pendingRemoteDocuments.length > 0) {
      const queuedDocuments = [...this.pendingRemoteDocuments];
      this.pendingRemoteDocuments = [];
      for (const queued of queuedDocuments) {
        this.applyRemoteDocument(queued);
      }
    }
  }

  private encodeStateAsBase64(): string {
    return encodeUpdate(Y.encodeStateAsUpdate(this.doc));
  }

  private flushPendingUpdate() {
    if (!this.pendingLocalUpdate) return;
    const pending = this.pendingLocalUpdate;
    this.pendingLocalUpdate = null;
    this.sendDocument({ update: encodeUpdate(pending) });
  }

  private sendDocument(document: CollabDocumentMessage) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }
    this.socket.send(JSON.stringify({ type: "document", document }));
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

  private seedDocumentFromPendingPage() {
    if (this.docInitialized) {
      return;
    }
    this.docInitialized = true;
    this.applyPageToDoc(this.pendingPage, INIT_ORIGIN);
    this.sendDocument({
      update: this.encodeStateAsBase64(),
      fullState: true,
    });
  }
}

function buildCollabUrl(pageId: number): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${baseApiUrl}/editor/collab/pages/${pageId}/ws`;
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

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .trim();
}

function replaceText(text: Y.Text, nextValue: string) {
  const current = text.toString();
  if (current === nextValue) {
    return;
  }
  if (current.length > 0) {
    text.delete(0, current.length);
  }
  if (nextValue.length > 0) {
    text.insert(0, nextValue);
  }
}

function encodeUpdate(update: Uint8Array): string {
  return base64(new Uint8Array(update).buffer);
}

function toNullableNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

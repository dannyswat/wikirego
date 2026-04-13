import type { PageRequest } from "./pageApi";

export type CollabStatus = "connecting" | "connected" | "reconnecting" | "disconnected";

export interface CollabParticipant {
  clientId: string;
  userId: string;
}

export interface CollabSnapshot {
  page: Partial<PageRequest> & { id: number };
  version: number;
  clientId?: string;
  participants?: CollabParticipant[];
  generatedAt: string;
}

export interface TextCollabPatch {
  id: string;
  kind: "text";
  field: "title" | "url" | "shortDesc";
  baseVersion: number;
  start: number;
  deleteText: string;
  insertText: string;
}

export interface ScalarCollabPatch {
  id: string;
  kind: "set";
  field:
    | "parentId"
    | "isProtected"
    | "isPinned"
    | "isCategoryPage"
    | "sortChildrenDesc";
  baseVersion: number;
  value: number | boolean | null;
}

export interface HtmlCollabPatch {
  id: string;
  kind: "html";
  field: "content";
  baseVersion: number;
  blockIndex: number;
  beforeBlocks: string[];
  afterBlocks: string[];
  htmlStart?: number;
  htmlDeleteText?: string;
  htmlInsertText?: string;
}

export type CollabPatch = TextCollabPatch | ScalarCollabPatch | HtmlCollabPatch;

export type AppliedCollabPatch = CollabPatch & {
  version: number;
  clientId: string;
  userId: string;
  appliedAt: string;
};

export interface CollabClientEnvelope {
  type: "patch" | "pong" | "cursor";
  patch?: CollabPatch;
  cursor?: CollabCursorPosition;
}

export interface CollabServerEnvelope {
  type: "snapshot" | "patch" | "presence" | "error" | "cursor";
  snapshot?: CollabSnapshot;
  patch?: AppliedCollabPatch;
  participants?: CollabParticipant[];
  message?: string;
  cursor?: CollabRemoteCursor;
}

export interface CollabCursorPosition {
  /** "title", "url", "shortDesc", or "content" */
  field: string;
  /** Character offset for plain-text fields */
  position?: number;
  /** Top-level block index for the content field */
  blockIndex?: number;
}

export interface CollabRemoteCursor extends CollabCursorPosition {
  clientId: string;
  userId: string;
}

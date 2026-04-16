import type { PageRequest } from "./pageApi";

export type CollabStatus = "connecting" | "connected" | "reconnecting" | "disconnected";

export type CollabPageChangeSource = "local" | "remote";

export interface CollabParticipant {
  clientId: string;
  userId: string;
}

export interface CollabSnapshot {
  page: Partial<PageRequest> & { id: number };
  clientId?: string;
  participants?: CollabParticipant[];
  shouldSeed?: boolean;
  generatedAt: string;
}

export interface CollabDocumentMessage {
  update: string;
  targetClientId?: string;
  fullState?: boolean;
}

export interface CollabClientEnvelope {
  type: "document" | "pong" | "cursor";
  document?: CollabDocumentMessage;
  cursor?: CollabCursorPosition;
}

export interface CollabServerEnvelope {
  type: "snapshot" | "document" | "presence" | "error" | "cursor" | "sync-request";
  snapshot?: CollabSnapshot;
  document?: CollabDocumentMessage;
  participants?: CollabParticipant[];
  message?: string;
  cursor?: CollabRemoteCursor;
  requesterClientId?: string;
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

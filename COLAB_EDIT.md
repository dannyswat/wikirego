# Real-Time Collaboration Plan

## Goal

Add real-time collaborative page editing over WebSocket using operational transformation for text fields, while keeping the existing explicit Save flow, page revision history, and editor/auth model intact.

## Scope

- Support live collaboration on existing pages in the edit screen.
- Use WebSocket for bidirectional updates.
- Use text OT for plain string fields: `title`, `url`, and `shortDesc`.
- Use HTML-aware OT for the `content` field so collaboration respects the structure produced by the rich-text editor.
- Keep non-text fields (`parentId`, `isProtected`, `isPinned`, `isCategoryPage`, `sortChildrenDesc`) in sync with last-writer-wins field updates.
- Preserve the existing HTTP save endpoint as the persistence boundary.

## Constraints In The Current Codebase

- The editor currently emits HTML snapshots via `HtmlEditor` and the page form is managed in `EditPage.tsx`.
- The server persists whole-page updates through `PageService.UpdatePage` and stores prior snapshots in the revision service.
- There is no existing WebSocket transport or collaboration state.
- The app already authenticates editor access through JWT cookies and `EditorMiddleware`, so the collaboration route should reuse that path.

## Proposed Architecture

### 1. Collaboration Session Layer

Create an in-memory collaboration hub on the server keyed by page ID.

Each session owns:

- the latest shared page snapshot
- a monotonically increasing collaboration version
- a bounded history of applied text patches for OT rebasing
- connected clients and their user identities

The session is transient. Persisting the page remains the responsibility of the existing `PUT /api/editor/pages/:id` path.

### 2. Transport

Add a WebSocket endpoint under the editor route group:

- `GET /api/editor/collab/pages/:id/ws`

Route behavior:

- require editor authorization before upgrade
- load the current page snapshot from `PageService`
- join or create the page session
- send the client an initial snapshot message with collaboration version and active participants

### 3. Client/Server Protocol

Use JSON messages with these types:

- `snapshot`: initial page state, version, client ID, participants
- `patch`: client text patch or scalar field update
- `patch`: authoritative patch broadcast from server with new version
- `presence`: participant join/leave updates
- `error`: invalid patch, page missing, unauthorized, or session failure

Plain text patch shape:

- `field`: one of `title`, `url`, `shortDesc`
- `baseVersion`: client version when the patch was created
- `start`: start offset
- `deleteText`: removed text
- `insertText`: inserted text

HTML patch shape for `content`:

- `field`: `content`
- `baseVersion`: client version when the patch was created
- `blockIndex`: starting index within the normalized top-level HTML block list
- `beforeBlocks`: normalized block slice expected at that index
- `afterBlocks`: normalized block slice that replaces it

Scalar update shape:

- `field`: non-text page field
- `value`: new value

### 4. Operational Transformation Model

Use field-specific OT strategies.

Plain text fields (`title`, `url`, `shortDesc`):

- use contiguous replace patches
- compute the longest common prefix and suffix between the previous and next values
- emit one replace patch represented by `start`, `deleteText`, and `insertText`

HTML content field (`content`):

- do not treat the entire HTML string as one flat text buffer
- normalize HTML before diffing so semantically equivalent markup produces stable patches
- split the document into top-level normalized HTML blocks such as paragraphs, headings, lists, quotes, tables, images, and code blocks
- generate one range-replace patch over the smallest changed block window
- allow concurrent edits in different block ranges to merge by rebasing block indexes
- reject overlapping block-range edits and resync from a snapshot rather than risking malformed HTML

HTML normalization rules:

- parse editor HTML into a DOM fragment before diffing
- normalize attribute order and insignificant whitespace
- collapse Lexical serialization noise that does not affect rendered meaning
- preserve meaningful inline tags and data attributes needed by diagrams, images, tables, and code blocks
- sanitize only on server persistence, not inside the live OT transform path, to avoid destructive rewrites during collaboration

Client patch generation for `content`:

- keep the previous normalized HTML snapshot and the next normalized HTML snapshot
- identify the longest common prefix and suffix in the top-level block arrays
- emit one range patch with `blockIndex`, `beforeBlocks`, and `afterBlocks`
- use the same mechanism for inline edits, structure edits, list toggles, pasted content, and media blocks

Server OT handling:

- when `baseVersion` is behind the current session version, rebase the incoming patch against later patches on the same field stored in the session history
- for plain text fields, use standard offset transformation
- for `content`, transform only by top-level block range
- shift incoming `blockIndex` for earlier inserts and deletes in non-overlapping ranges
- reject overlapping content ranges and instruct the client to resync from a fresh snapshot
- apply the transformed patch to the session snapshot
- increment the collaboration version
- append the applied patch to bounded history
- broadcast the authoritative patch to all clients

Client reconciliation:

- maintain a collaboration shadow document from the latest server-authoritative snapshot
- when authoritative patches arrive, update the shadow document and reconcile local view state
- for `content`, apply authoritative block patches to the normalized HTML shadow first, then push the resulting HTML back into the Lexical editor
- reconnect by requesting a fresh snapshot if the socket drops or the client detects a bad patch state

### 5. HTML-Specific Collaboration Rules For `content`

The `content` field needs different behavior from plain inputs because the editor serializes rich structure, not just text.

Rules:

- optimize for preserving valid HTML and editor structure over maximizing patch acceptance
- keep transformations local to the smallest block possible
- avoid rebasing across unrelated blocks; concurrent edits in different blocks should merge cleanly
- treat image, table, diagram, code block, and list structure changes as block-level operations, not character-level edits against the full document HTML
- prefer snapshot resync over applying a risky transform that could corrupt HTML structure

Editor integration notes:

- derive normalized HTML from Lexical output before diffing
- suppress echo loops when applying remote `content` patches back into the editor
- keep cursor position best-effort only for this pass; correctness of merged HTML takes priority over cursor fidelity
- leave collaborative undo/redo out of scope for this iteration

## Implementation Phases

### Phase 1. Plan And Shared Types

- add `COLAB_EDIT.md`
- define shared TypeScript collaboration message/patch types on the client
- define Go collaboration message/patch/session types on the server

Status: completed

### Phase 2. Server Collaboration Backend

- add a collaboration package for session management and OT utilities
- add a WebSocket handler for page collaboration
- register the new route in startup under the editor API group
- reuse current auth middleware and editor role checks before upgrade

Status: completed

### Phase 3. Client Collaboration Service

- add a WebSocket collaboration client for connect, reconnect, send, receive, and heartbeat handling
- add plain-text diff helpers for `title`, `url`, and `shortDesc`
- add HTML normalization, block extraction, and block-scoped diff helpers for `content`
- add patch application helpers for plain text, HTML block patches, and scalar fields

Status: completed

### Phase 4. Edit Screen Integration

- integrate the collaboration client into `EditPage.tsx`
- join collaboration when editing an existing page
- emit plain-text patches from title, URL, and short description edits
- emit HTML-aware patches for content edits using normalized Lexical HTML snapshots
- emit scalar updates for toggles and parent page changes
- keep explicit Save mapped to the existing HTTP update API using the latest local page state
- show lightweight collaboration status and participant count in the edit UI

Status: completed

### Phase 5. Validation And Failure Handling

- reject invalid plain-text patches on the server if the delete segment does not match the session snapshot
- reject invalid HTML content patches when the target block range no longer matches the normalized session snapshot
- fall back to a fresh `snapshot` message after desync or reconnect
- keep local autosave in place as a safety net, but do not let it override active collaborative state on load

Status: partially completed
: server OT tests and full client build are passing; multi-browser behavior still needs manual verification

## Server File Plan

- add `server/internal/collab/types.go`
- add `server/internal/collab/text_ot.go`
- add `server/internal/collab/session.go`
- add `server/internal/collab/hub.go`
- add `server/internal/app/handlers/page_collab_handler.go`
- update `server/internal/app/startup.go`
- update `server/go.mod` to include a WebSocket dependency

## Client File Plan

- add `client/src/features/pages/pageCollab.ts`
- add `client/src/features/pages/pageCollabTypes.ts`
- update `client/src/features/pages/EditPage.tsx`
- update `client/src/features/pages/pageApi.ts` only if collaboration-specific helpers are needed
- update `client/src/features/htmleditors/HtmlEditor.tsx` only if an extra hook or imperative reset path is required beyond the current ref API

## Testing Plan

### Server

- unit test plain-text OT transform and apply behavior
- unit test HTML block patch validation, transform eligibility, and apply behavior
- unit test session patch validation
- run `go test ./...` in `server`

### Client

- verify TypeScript build for the client
- verify collaborative editing on two browser sessions against the same page
- verify concurrent edits in different HTML blocks merge without snapshot resets
- verify structure-changing edits such as paste, list toggles, image insertion, and table edits fall back to block-level patching correctly
- verify reconnect restores the latest shared snapshot
- verify explicit Save still writes revisions and redirects as before

## Acceptance Criteria

- two authenticated editors can open the same page edit screen and see each other’s updates in near real time
- content updates propagate over WebSocket without a page refresh
- concurrent edits on plain text fields are rebased through OT instead of blindly replacing the entire field
- concurrent content edits preserve valid HTML and merge safely at block scope when structure permits
- final page persistence still occurs through the existing Save action and server page update path
- losing the socket connection does not corrupt the page state; reconnect produces a fresh synchronized snapshot

## Non-Goals For This Pass

- new-page collaboration before the page has an ID
- cursor/selection presence rendering
- collaborative undo/redo across clients
- persistent collaboration sessions across server restarts
- collaborative editing of tags
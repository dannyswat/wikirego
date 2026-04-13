import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import {
  deletePage,
  getLatestPageRevisionByUrl,
  getPageByUrl,
  PageRequest,
  updatePage,
} from "./pageApi";
import HtmlEditor from "../htmleditors/HtmlEditor";
import type { HtmlEditorRef } from "../htmleditors/HtmlEditor";
import DiagramModal from "../editors/DiagramModal";
import DataModelModal from "../editors/DataModelModal";
import ImageBrowserModal from "../editors/ImageBrowserModal";
import { queryClient } from "../../common/query";
import { useEffect, useState, useRef, MouseEvent, useMemo, useCallback } from "react";
import { clearCache, PageDropDown } from "../editors/PageDropDown";
import { IconFidgetSpinner } from "@tabler/icons-react";
import ToggleButton from "../../components/ToggleButton";
import MenuButton from "../layout/MenuButton";
import { useAutoSaveStore } from "../editors/AutoSaveStore";
import { useTranslation } from "react-i18next";
import {
  applyPatchToPage,
  buildCollabPage,
  createHtmlPatch,
  createScalarPatch,
  createTextPatch,
  normalizeHtmlFragment,
  PageCollabClient,
  transformRemoteHtmlPatch,
  transformRemoteTextPatch,
} from "./pageCollab";
import type { AppliedCollabPatch, CollabCursorPosition, CollabParticipant, CollabPatch, CollabRemoteCursor, CollabStatus, HtmlCollabPatch, TextCollabPatch } from "./pageCollabTypes";

export default function EditPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const pageId = id ? window.location.pathname.substring(6) : "home";
  const { isAutoSaveEnabled } = useAutoSaveStore();
  const editorRef = useRef<HtmlEditorRef>(null);
  const [data, setData] = useState<PageRequest>(() => ({
    id: 0,
    parentId: null,
    url: "",
    title: "",
    shortDesc: "",
    content: "",
    isProtected: false,
    isPinned: false,
    isCategoryPage: false,
    sortChildrenDesc: false,
  }));
  const collabClientRef = useRef<PageCollabClient | null>(null);
  const currentVersionRef = useRef(0);
  const currentClientIdRef = useRef("");
  const sharedPageRef = useRef<PageRequest | null>(null);
  const dataRef = useRef<PageRequest>(data);
  const pendingPatchIdRef = useRef<string | null>(null);
  const flushTimerRef = useRef<number>(0);
  const pendingPatchObjectRef = useRef<CollabPatch | null>(null);
  const needsResyncRef = useRef(false);
  const cursorThrottleRef = useRef<number>(0);
  const lastEditorHtmlRef = useRef<string>("");
  const [isDiagramModalOpen, setIsDiagramModalOpen] = useState(false);
  const [isDataModelModalOpen, setIsDataModelModalOpen] = useState(false);
  const [isImageBrowserModalOpen, setIsImageBrowserModalOpen] = useState(false);
  const [collabStatus, setCollabStatus] = useState<CollabStatus>("disconnected");
  const [participants, setParticipants] = useState<CollabParticipant[]>([]);
  const [currentClientId, setCurrentClientId] = useState("");
  const [remoteCursors, setRemoteCursors] = useState<CollabRemoteCursor[]>([]);
  const [diagramUrl, setDiagramUrl] = useState<string>();
  const [dataModelUrl, setDataModelUrl] = useState<string>();
  const localStorageKey = `editPageData_${pageId}`;
  const navigate = useNavigate();
  const presenceSummary = useMemo(() => summarizeParticipants(participants, currentClientId), [participants, currentClientId]);

  const participantLookup = useMemo(() => {
    const map = new Map<string, { label: string; cssColor: string }>();
    for (const entry of presenceSummary.entries) {
      map.set(entry.clientId, { label: entry.label, cssColor: entry.cssColor });
    }
    return map;
  }, [presenceSummary]);

  const editorRemoteCursors = useMemo(() =>
    remoteCursors
      .filter((c) => c.field === "content" && c.clientId !== currentClientId && c.blockIndex != null)
      .map((c) => ({
        clientId: c.clientId,
        label: participantLookup.get(c.clientId)?.label ?? c.userId,
        color: participantLookup.get(c.clientId)?.cssColor ?? "#6366f1",
        blockIndex: c.blockIndex!,
      })),
  [remoteCursors, currentClientId, participantLookup]);

  const sendCursorUpdate = useCallback((field: string, position?: number, blockIndex?: number) => {
    window.clearTimeout(cursorThrottleRef.current);
    cursorThrottleRef.current = window.setTimeout(() => {
      const cursor: CollabCursorPosition = { field, position, blockIndex };
      collabClientRef.current?.sendCursor(cursor);
    }, 80);
  }, []);

  function fieldCursorBadges(field: string) {
    return remoteCursors
      .filter((c) => c.field === field && c.clientId !== currentClientId)
      .map((c) => {
        const info = participantLookup.get(c.clientId);
        if (!info) return null;
        return (
          <span
            key={c.clientId}
            className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
            style={{ borderColor: info.cssColor, color: info.cssColor, background: info.cssColor + "18" }}
          >
            {info.label}
          </span>
        );
      })
      .filter(Boolean);
  }

  const autoSaveData = useMemo<PageRequest | undefined>(() => {
    const saved = isAutoSaveEnabled
      ? localStorage.getItem(localStorageKey)
      : undefined;
    try {
      if (saved) {
        const { page, expire } = JSON.parse(saved) as AutoSavePageRequest;
        if (expire > Date.now()) {
          return page;
        }
      }
    } catch {
      // ignore parse error
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localStorageKey]);

  const {
    data: initialData,
    isLoading,
    isError,
  } = useQuery({
    enabled: !!pageId,
    queryKey: ["page", pageId],
    queryFn: async () => {
      return await getPageByUrl(pageId);
    },
    staleTime: 0,
  });

  const updatePageApi = useMutation({
    mutationFn: (page: PageRequest) => updatePage(page),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["page", pageId] });
      clearCache();
      localStorage.removeItem(localStorageKey);
      navigate("/p" + data.url);
    },
    onError: (err) => {
      alert(err.message);
    }
  });

  const deletePageApi = useMutation({
    mutationFn: (page: PageRequest) => deletePage(page.id),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["page", pageId] });
      clearCache();
      localStorage.removeItem(localStorageKey);
      navigate("/");
    },
    onError: (err) => {
      alert(err.message);
    }
  });

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const flushLocalChanges = useCallback(() => {
    const client = collabClientRef.current;
    const shared = sharedPageRef.current;
    const local = dataRef.current;
    if (!client || !shared || pendingPatchIdRef.current) return;

    const nextPatch = buildNextPatch(shared, local, currentVersionRef.current);
    if (!nextPatch) return;

    pendingPatchIdRef.current = nextPatch.id;
    pendingPatchObjectRef.current = nextPatch;
    if (!client.sendPatch(nextPatch)) {
      pendingPatchIdRef.current = null;
      pendingPatchObjectRef.current = null;
    }
  }, []);

  const replaceEditorContent = useCallback((content: string) => {
    const normalizedIncoming = normalizeHtmlFragment(content);
    if (normalizeHtmlFragment(lastEditorHtmlRef.current) === normalizedIncoming) return;
    lastEditorHtmlRef.current = content;
    editorRef.current?.resetContent(content);
  }, []);

  const updateEditorContent = useCallback((content: string) => {
    const normalizedIncoming = normalizeHtmlFragment(content);
    if (normalizeHtmlFragment(lastEditorHtmlRef.current) === normalizedIncoming) return;
    lastEditorHtmlRef.current = content;
    editorRef.current?.updateHtml(content);
  }, []);

  const applySnapshot = useCallback((page: PageRequest, version: number, nextParticipants: CollabParticipant[], clientId?: string) => {
    currentVersionRef.current = version;
    currentClientIdRef.current = clientId ?? currentClientIdRef.current;
    if (clientId) setCurrentClientId(clientId);
    sharedPageRef.current = page;
    pendingPatchIdRef.current = null;
    pendingPatchObjectRef.current = null;
    needsResyncRef.current = false;
    dataRef.current = page;
    setParticipants(nextParticipants);
    setData(page);
    replaceEditorContent(page.content);
  }, [replaceEditorContent]);

  const handleAppliedPatch = useCallback((patch: AppliedCollabPatch) => {
    const shared = sharedPageRef.current ?? dataRef.current;
    let nextShared: PageRequest;
    try {
      nextShared = applyPatchToPage(shared, patch);
    } catch {
      return;
    }

    sharedPageRef.current = nextShared;
    currentVersionRef.current = patch.version;

    const isOwnPatch =
      patch.clientId === currentClientIdRef.current ||
      pendingPatchIdRef.current === patch.id;

    if (isOwnPatch) {
      if (pendingPatchIdRef.current === patch.id) {
        pendingPatchIdRef.current = null;
        pendingPatchObjectRef.current = null;
        if (needsResyncRef.current) {
          // A prior conflict was deferred — reconnect now to get a clean snapshot.
          needsResyncRef.current = false;
          const client = collabClientRef.current;
          if (client) {
            client.disconnect();
            window.setTimeout(() => client.connect(), 100);
          }
          return;
        }
      }
      flushLocalChanges();
      return;
    }

    // Transform the incoming remote patch so it applies correctly on top of
    // our locally-applied pending patch (client-side OT).
    let patchForLocal: AppliedCollabPatch = patch;
    const pending = pendingPatchObjectRef.current;
    if (pending) {
      if (patch.kind === "text" && pending.kind === "text") {
        const transformed = transformRemoteTextPatch(
          patch as unknown as TextCollabPatch,
          pending as TextCollabPatch
        );
        if (transformed === null) {
          // Irrecoverable overlap — resync after our pending patch is acknowledged.
          needsResyncRef.current = true;
          return;
        }
        patchForLocal = { ...patch, ...transformed } as AppliedCollabPatch;
      } else if (patch.kind === "html" && pending.kind === "html") {
        const transformed = transformRemoteHtmlPatch(
          patch as unknown as HtmlCollabPatch,
          pending as HtmlCollabPatch
        );
        if (transformed === null) {
          needsResyncRef.current = true;
          return;
        }
        patchForLocal = { ...patch, ...transformed } as AppliedCollabPatch;
      }
    }

    try {
      const nextLocal = applyPatchToPage(dataRef.current, patchForLocal);
      dataRef.current = nextLocal;
      setData(nextLocal);
      if (patch.field === "content") {
        updateEditorContent(nextLocal.content);
      }
    } catch {
      if (pendingPatchObjectRef.current) {
        // Can't safely merge while we have unacknowledged changes — defer resync.
        needsResyncRef.current = true;
      } else {
        dataRef.current = nextShared;
        setData(nextShared);
        if (patch.field === "content") {
          updateEditorContent(nextShared.content);
        }
      }
    }

    flushLocalChanges();
  }, [flushLocalChanges, replaceEditorContent, updateEditorContent]);

  useEffect(() => {
    if (initialData && !autoSaveData) {
      const page = buildCollabPage(initialData);
      sharedPageRef.current = page;
      dataRef.current = page;
      lastEditorHtmlRef.current = page.content;
      setData(page);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData]);

  useEffect(() => {
    if (autoSaveData) {
      dataRef.current = autoSaveData;
      lastEditorHtmlRef.current = autoSaveData.content;
      setData(autoSaveData);
    }
  }, [autoSaveData]);

  useEffect(() => {
    if (!initialData?.id) return;

    const client = new PageCollabClient(initialData.id, {
      onSnapshot: (snapshot) => {
        applySnapshot(buildCollabPage(snapshot.page), snapshot.version, snapshot.participants ?? [], snapshot.clientId);
      },
      onPatch: handleAppliedPatch,
      onPresence: (nextParticipants) => {
        setParticipants(nextParticipants);
        const activeIds = new Set(nextParticipants.map((p) => p.clientId));
        setRemoteCursors((prev) => prev.filter((c) => activeIds.has(c.clientId)));
      },
      onCursor: (cursor) => {
        setRemoteCursors((prev) => [
          ...prev.filter((c) => c.clientId !== cursor.clientId),
          cursor,
        ]);
      },
      onError: (_message, snapshot) => {
        if (snapshot) {
          applySnapshot(buildCollabPage(snapshot.page), snapshot.version, snapshot.participants ?? [], snapshot.clientId);
        }
      },
      onStatus: setCollabStatus,
    });

    collabClientRef.current = client;
    client.connect();

    return () => {
      window.clearTimeout(flushTimerRef.current);
      window.clearTimeout(cursorThrottleRef.current);
      collabClientRef.current = null;
      pendingPatchIdRef.current = null;
      pendingPatchObjectRef.current = null;
      needsResyncRef.current = false;
      currentClientIdRef.current = "";
      setCurrentClientId("");
      setParticipants([]);
      setRemoteCursors([]);
      client.disconnect();
    };
  }, [applySnapshot, handleAppliedPatch, initialData?.id]);

  useEffect(() => {
    if (!isAutoSaveEnabled) {
      localStorage.removeItem(localStorageKey);
      return;
    }
    const saveData: AutoSavePageRequest = {
      page: data,
      expire: Date.now() + 1000 * 60 * 60 * 24, // 24 hours
    };
    localStorage.setItem(localStorageKey, JSON.stringify(saveData));
  }, [data, localStorageKey, isAutoSaveEnabled]);

  const handleContentChange = useCallback((content: string) => {
    // Track the latest HTML seen from the editor so the guard in
    // replaceEditorContent can detect real changes on the next remote patch.
    lastEditorHtmlRef.current = content;
    if (content === dataRef.current.content) return;
    const nextPage = { ...dataRef.current, content };
    dataRef.current = nextPage;
    setData(nextPage);
    window.clearTimeout(flushTimerRef.current);
    flushTimerRef.current = window.setTimeout(flushLocalChanges, 300);
  }, [flushLocalChanges]);

  if (isLoading) return <div>{t('Loading...')}</div>;
  if (isError) return <div>{t('Page not found')}</div>;

  function updateLocalPage(nextPage: PageRequest) {
    dataRef.current = nextPage;
    setData(nextPage);
    window.clearTimeout(flushTimerRef.current);
    flushTimerRef.current = window.setTimeout(flushLocalChanges, 300);
  }

  function updateTextField(field: "title" | "url" | "shortDesc", value: string) {
    updateLocalPage({ ...dataRef.current, [field]: value });
  }

  function updateScalarField(field: "parentId" | "isProtected" | "isPinned" | "isCategoryPage" | "sortChildrenDesc", value: number | boolean | null) {
    updateLocalPage({ ...dataRef.current, [field]: value } as PageRequest);
  }

  function handleSubmitClick(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    updatePageApi.mutate(dataRef.current);
  }

  async function loadLastRevision() {
    const revision = await getLatestPageRevisionByUrl(data.id);
    if (revision) setData(revision.record);
    else alert(t('No revision available'));
  }

  function handleInsertImage(imageUrl: string) {
    editorRef.current?.insertImage(imageUrl + "?t=" + Date.now());
  }

  return (
    <>
    <div className="w-full flex flex-col gap-4">
      <section className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${collabStatus === "connected" ? "bg-emerald-500" : collabStatus === "connecting" ? "bg-amber-500" : collabStatus === "reconnecting" ? "bg-orange-500" : "bg-slate-400"}`} />
            <span className="font-medium">Collaboration {collabStatus}</span>
            <span>{presenceSummary.totalEditors} active editor{presenceSummary.totalEditors === 1 ? "" : "s"}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {presenceSummary.entries.map((entry) => (
              <span
                key={entry.clientId}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${entry.colorClass}`}
                title={entry.isSelf ? "You" : entry.userId}
              >
                <span className="font-bold">{entry.initial}</span>
                <span>{entry.label}</span>
              </span>
            ))}
          </div>
        </div>
      </section>
      <section className="flex flex-row items-center">
        <label className="basis-1/4">{t('Title')}</label>
        <div className="basis-3/4 flex flex-col gap-1">
          <input
            className="border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md p-2"
            type="text"
            placeholder={t('Title')}
            value={data.title}
            onChange={(e) => updateTextField("title", e.target.value)}
            onSelect={(e) => sendCursorUpdate("title", (e.target as HTMLInputElement).selectionStart ?? 0)}
          />
          {fieldCursorBadges("title").length > 0 && (
            <div className="flex gap-1">{fieldCursorBadges("title")}</div>
          )}
        </div>
      </section>
      <section className="flex flex-row items-center">
        <label className="basis-1/4">{t('Parent Page')}</label>
        <PageDropDown
          className="basis-3/4 border-2 border-gray-300 dark:border-gray-600 rounded-md p-2 w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          value={data.parentId || undefined}
          onChange={(value) => updateScalarField("parentId", value || null)}
        />
      </section>
      <section className="flex flex-row items-center">
        <label className="basis-1/4">{t('URL')}</label>
        <div className="basis-3/4 flex flex-col gap-1">
          <input
            className="border-2 border-gray-300 dark:border-gray-600 rounded-md p-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            type="text"
            placeholder={t('URL')}
            value={data.url}
            onChange={(e) => updateTextField("url", e.target.value)}
            onSelect={(e) => sendCursorUpdate("url", (e.target as HTMLInputElement).selectionStart ?? 0)}
          />
          {fieldCursorBadges("url").length > 0 && (
            <div className="flex gap-1">{fieldCursorBadges("url")}</div>
          )}
        </div>
      </section>
      <section className="flex flex-row items-center">
        <label className="basis-1/4">{t('Short Description')}</label>
        <div className="basis-3/4 flex flex-col gap-1">
          <input
            className="border-2 border-gray-300 dark:border-gray-600 rounded-md p-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            type="text"
            placeholder={t('Short Description')}
            value={data.shortDesc}
            onChange={(e) => updateTextField("shortDesc", e.target.value)}
            onSelect={(e) => sendCursorUpdate("shortDesc", (e.target as HTMLInputElement).selectionStart ?? 0)}
          />
          {fieldCursorBadges("shortDesc").length > 0 && (
            <div className="flex gap-1">{fieldCursorBadges("shortDesc")}</div>
          )}
        </div>
      </section>
      <section className="flex flex-row items-center">
        <label className="basis-1/4">{t('Category')}</label>
        <ToggleButton
          label={t('Category Page')}
          checked={data.isCategoryPage}
          className="ms-4"
          onChange={(value) => updateScalarField("isCategoryPage", value)}
        />
        <ToggleButton
          label={t('Reverse Order')}
          checked={data.sortChildrenDesc}
          className="ms-4"
          onChange={(value) => updateScalarField("sortChildrenDesc", value)}
        />
      </section>
      <section>
        <HtmlEditor
          ref={editorRef}
          value={data.content}
          onChange={handleContentChange}
          remoteCursors={editorRemoteCursors}
          onCursorBlockChange={(blockIndex) => sendCursorUpdate("content", undefined, blockIndex ?? undefined)}
          onOpenImageBrowser={() => setIsImageBrowserModalOpen(true)}
          onOpenDiagram={(imageUrl?: string) => {
            setDiagramUrl(imageUrl);
            setIsDiagramModalOpen(true);
          }}
          onOpenDataModel={(imageUrl?: string) => {
            setDataModelUrl(imageUrl);
            setIsDataModelModalOpen(true);
          }}
        />
      </section>
      <section>
        <ToggleButton
          label={t('Protected')}
          checked={data.isProtected}
          onChange={(value) => updateScalarField("isProtected", value)}
        />
        <ToggleButton
          label={t('Pinned')}
          checked={data.isPinned}
          className="ms-4"
          onChange={(value) => updateScalarField("isPinned", value)}
        />
      </section>
      <section className="flex flex-row justify-items-end items-center">
        <button
          onClick={handleSubmitClick}
          className="basis-1/2 sm:basis-1/6 bg-lime-700 hover:bg-lime-800 dark:bg-lime-600 dark:hover:bg-lime-700 text-white rounded-md py-2 px-5"
        >
          {updatePageApi.isPending ? (
            <IconFidgetSpinner className="animate-spin mx-auto" />
          ) : (
            t('Save')
          )}
        </button>
        <button
          onClick={() => {
            if (
              data.content === initialData?.content ||
              confirm(t('Are you sure to leave? Unsaved content will be lost.'))
            ) {
              localStorage.removeItem(localStorageKey);
              navigate(initialData ? "/p" + initialData.url : "/");
            }
          }}
          className="basis-1/2 sm:basis-1/6 bg-gray-700 hover:bg-gray-800 dark:bg-gray-600 dark:hover:bg-gray-700 text-white rounded-md py-2 px-5 ms-4"
        >
          {t('Cancel')}
        </button>
        <MenuButton className="basis-1/4 sm:basis-1/12 ms-4">
          <div className="p-2">
            <button
              onClick={loadLastRevision}
              className="bg-blue-950 hover:bg-blue-900 dark:bg-blue-800 dark:hover:bg-blue-700 w-full box-border text-white rounded-md py-2 px-5 my-2"
            >
              {t('Revert')}
            </button>
            <button
              onClick={() => {
                if (confirm(t('Are you sure to delete this page?')))
                  deletePageApi.mutate(data);
              }}
              className="bg-red-700 hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-700 text-white w-full box-border rounded-md py-2 px-5 mb-2"
            >
              {t('Delete')}
            </button>
          </div>
        </MenuButton>
      </section>
    </div>
      {isDiagramModalOpen && (
        <DiagramModal
          diagramUrl={diagramUrl ?? ""}
          onClose={(imageUrl: string | undefined, shouldInsert?: boolean) => {
            setIsDiagramModalOpen(false);
            if (!imageUrl) return;
            if (!shouldInsert && diagramUrl) {
              editorRef.current?.replaceImageSrc(diagramUrl, imageUrl + "?t=" + Date.now());
            } else {
              handleInsertImage(imageUrl);
            }
          }}
        />
      )}
      {isDataModelModalOpen && (
        <DataModelModal
          dataModelUrl={dataModelUrl ?? ""}
          onClose={(imageUrl: string | undefined, shouldInsert?: boolean) => {
            setIsDataModelModalOpen(false);
            if (!imageUrl) return;
            if (!shouldInsert && dataModelUrl) {
              editorRef.current?.replaceImageSrc(dataModelUrl, imageUrl + "?t=" + Date.now());
            } else {
              handleInsertImage(imageUrl);
            }
          }}
        />
      )}
      {isImageBrowserModalOpen && (
        <ImageBrowserModal
          onClose={(selectedImageUrl?: string) => {
            setIsImageBrowserModalOpen(false);
            if (!selectedImageUrl) return;
            handleInsertImage(selectedImageUrl);
          }}
        />
      )}
    </>
  );
}

type PresenceEntry = {
  clientId: string;
  userId: string;
  label: string;
  initial: string;
  isSelf: boolean;
  colorClass: string;
  cssColor: string;
};

const PARTICIPANT_COLOR_CLASSES = [
  "border-violet-300 bg-violet-100 text-violet-900 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-100",
  "border-rose-300 bg-rose-100 text-rose-900 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-100",
  "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100",
  "border-teal-300 bg-teal-100 text-teal-900 dark:border-teal-800 dark:bg-teal-950/50 dark:text-teal-100",
  "border-fuchsia-300 bg-fuchsia-100 text-fuchsia-900 dark:border-fuchsia-800 dark:bg-fuchsia-950/50 dark:text-fuchsia-100",
  "border-cyan-300 bg-cyan-100 text-cyan-900 dark:border-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-100",
  "border-orange-300 bg-orange-100 text-orange-900 dark:border-orange-800 dark:bg-orange-950/50 dark:text-orange-100",
  "border-indigo-300 bg-indigo-100 text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-100",
];

const PARTICIPANT_CSS_COLORS = [
  "#8b5cf6", // violet
  "#f43f5e", // rose
  "#f59e0b", // amber
  "#14b8a6", // teal
  "#a855f7", // fuchsia
  "#06b6d4", // cyan
  "#f97316", // orange
  "#6366f1", // indigo
];

const SELF_CSS_COLOR = "#10b981"; // emerald

function clientIdColorIndex(clientId: string): number {
  let hash = 0;
  for (let i = 0; i < clientId.length; i++) {
    hash = ((hash << 5) - hash + clientId.charCodeAt(i)) >>> 0;
  }
  return hash % PARTICIPANT_COLOR_CLASSES.length;
}

function summarizeParticipants(participants: CollabParticipant[], currentClientId: string) {
  const entries: PresenceEntry[] = [];
  for (const participant of participants) {
    const isSelf = !!currentClientId && participant.clientId === currentClientId;
    const initial = (participant.userId.charAt(0) || "?").toUpperCase();
    const colorIdx = clientIdColorIndex(participant.clientId);
    entries.push({
      clientId: participant.clientId,
      userId: participant.userId,
      label: isSelf ? "You" : participant.userId,
      initial,
      isSelf,
      colorClass: isSelf
        ? "border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100"
        : PARTICIPANT_COLOR_CLASSES[colorIdx],
      cssColor: isSelf ? SELF_CSS_COLOR : PARTICIPANT_CSS_COLORS[colorIdx],
    });
  }
  entries.sort((a, b) => {
    if (a.isSelf !== b.isSelf) return a.isSelf ? -1 : 1;
    return a.userId.localeCompare(b.userId);
  });
  return {
    entries,
    totalEditors: entries.length,
  };
}

interface AutoSavePageRequest {
  page: PageRequest;
  expire: number;
}

function buildNextPatch(shared: PageRequest, local: PageRequest, baseVersion: number): CollabPatch | null {
  const titlePatch = createTextPatch("title", shared.title, local.title, baseVersion);
  if (titlePatch) return titlePatch;

  const urlPatch = createTextPatch("url", shared.url, local.url, baseVersion);
  if (urlPatch) return urlPatch;

  const shortDescPatch = createTextPatch("shortDesc", shared.shortDesc, local.shortDesc, baseVersion);
  if (shortDescPatch) return shortDescPatch;

  const contentPatch = createHtmlPatch(shared.content, local.content, baseVersion);
  if (contentPatch) return contentPatch;

  if (shared.parentId !== local.parentId) {
    return createScalarPatch("parentId", local.parentId, baseVersion);
  }
  if (shared.isProtected !== local.isProtected) {
    return createScalarPatch("isProtected", local.isProtected, baseVersion);
  }
  if (shared.isPinned !== local.isPinned) {
    return createScalarPatch("isPinned", local.isPinned, baseVersion);
  }
  if (shared.isCategoryPage !== local.isCategoryPage) {
    return createScalarPatch("isCategoryPage", local.isCategoryPage, baseVersion);
  }
  if (shared.sortChildrenDesc !== local.sortChildrenDesc) {
    return createScalarPatch("sortChildrenDesc", local.sortChildrenDesc, baseVersion);
  }

  return null;
}

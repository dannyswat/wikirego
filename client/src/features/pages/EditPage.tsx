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
import { useEffect, useState, useRef, MouseEvent, useMemo, useCallback, useContext } from "react";
import { clearCache, PageDropDown } from "../editors/PageDropDown";
import { IconFidgetSpinner } from "@tabler/icons-react";
import ToggleButton from "../../components/ToggleButton";
import MenuButton from "../layout/MenuButton";
import { useAutoSaveStore } from "../editors/AutoSaveStore";
import { useTranslation } from "react-i18next";
import {
  buildCollabPage,
  isCollaborationEnabled,
  normalizeHtmlFragment,
  PageCollabClient,
  shouldRestoreAutoSaveDraft,
} from "./pageCollab";
import type { CollabCursorPosition, CollabParticipant, CollabRemoteCursor, CollabSnapshot, CollabStatus } from "./pageCollabTypes";
import { SettingContext } from "../setup/SettingProvider";

export default function EditPage() {
  const { t } = useTranslation();
  const { setting } = useContext(SettingContext);
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
  const dataRef = useRef<PageRequest>(data);
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
  const collaborationEnabled = isCollaborationEnabled(setting);
  const presenceSummary = useMemo(() => summarizeParticipants(participants, currentClientId), [participants, currentClientId]);
  const collaborationStatusLabel = collabStatus === "disabled"
    ? t('Collaboration disabled in site settings')
    : t(`Collaboration ${collabStatus}`);
  const activeEditorsLabel = presenceSummary.totalEditors === 1 ? t('active editor') : t('active editors');

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
        if (expire > Date.now() && shouldRestoreAutoSaveDraft(page)) {
          return page;
        }
        localStorage.removeItem(localStorageKey);
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

  const updateEditorContent = useCallback((content: string) => {
    const normalizedIncoming = normalizeHtmlFragment(content);
    if (normalizeHtmlFragment(lastEditorHtmlRef.current) === normalizedIncoming) return;
    lastEditorHtmlRef.current = content;
    editorRef.current?.updateHtml(content);
  }, []);

  const applyPageState = useCallback((page: PageRequest, source: "local" | "remote" = "local") => {
    dataRef.current = page;
    setData(page);
    if (source === "remote") {
      updateEditorContent(page.content);
    }
  }, [updateEditorContent]);

  useEffect(() => {
    const page = initialData
      ? buildCollabPage(initialData)
      : (autoSaveData && shouldRestoreAutoSaveDraft(autoSaveData) ? buildCollabPage(autoSaveData) : undefined);
    if (!page) return;
    dataRef.current = page;
    lastEditorHtmlRef.current = page.content;
    setData(page);
  }, [autoSaveData, initialData]);

  useEffect(() => {
    if (!initialData?.id) return;

    const startingPage = buildCollabPage(initialData);
    applyPageState(startingPage);
    lastEditorHtmlRef.current = startingPage.content;

    if (!collaborationEnabled) {
      collabClientRef.current = null;
      setCollabStatus("disabled");
      setCurrentClientId("");
      setParticipants([]);
      setRemoteCursors([]);
      return;
    }

    const client = new PageCollabClient(initialData.id, startingPage, {
      onSnapshot: (snapshot: CollabSnapshot) => {
        if (snapshot.clientId) {
          setCurrentClientId(snapshot.clientId);
        }
        setParticipants(snapshot.participants ?? []);
      },
      onPageChange: (page: PageRequest, source: "local" | "remote") => {
        applyPageState(page, source);
      },
      onPresence: (nextParticipants: CollabParticipant[]) => {
        setParticipants(nextParticipants);
        const activeIds = new Set(nextParticipants.map((p) => p.clientId));
        setRemoteCursors((prev) => prev.filter((c) => activeIds.has(c.clientId)));
      },
      onCursor: (cursor: CollabRemoteCursor) => {
        setRemoteCursors((prev) => [
          ...prev.filter((c) => c.clientId !== cursor.clientId),
          cursor,
        ]);
      },
      onError: (message: string) => {
        console.error(message);
      },
      onStatus: setCollabStatus,
    });

    collabClientRef.current = client;
    client.connect();

    return () => {
      window.clearTimeout(cursorThrottleRef.current);
      collabClientRef.current = null;
      setCurrentClientId("");
      setParticipants([]);
      setRemoteCursors([]);
      client.disconnect();
    };
  }, [applyPageState, collaborationEnabled, initialData]);

  useEffect(() => {
    if (!isAutoSaveEnabled) {
      localStorage.removeItem(localStorageKey);
      return;
    }
    if (!shouldRestoreAutoSaveDraft(data, initialData)) {
      localStorage.removeItem(localStorageKey);
      return;
    }
    const saveData: AutoSavePageRequest = {
      page: data,
      expire: Date.now() + 1000 * 60 * 60 * 24, // 24 hours
    };
    localStorage.setItem(localStorageKey, JSON.stringify(saveData));
  }, [data, initialData, localStorageKey, isAutoSaveEnabled]);

  const handleContentChange = useCallback((content: string) => {
    lastEditorHtmlRef.current = content;
    if (content === dataRef.current.content) return;
    const client = collabClientRef.current;
    if (!client) {
      applyPageState({ ...dataRef.current, content });
      return;
    }
    client.updateContent(content);
  }, [applyPageState]);

  if (isLoading) return <div>{t('Loading...')}</div>;
  if (isError) return <div>{t('Page not found')}</div>;

  function updateTextField(field: "title" | "url" | "shortDesc", value: string) {
    const client = collabClientRef.current;
    if (!client) {
      applyPageState({ ...dataRef.current, [field]: value } as PageRequest);
      return;
    }
    client.updateTextField(field, value);
  }

  function updateScalarField(field: "parentId" | "isProtected" | "isPinned" | "isCategoryPage" | "sortChildrenDesc", value: number | boolean | null) {
    const client = collabClientRef.current;
    if (!client) {
      applyPageState({ ...dataRef.current, [field]: value } as PageRequest);
      return;
    }
    client.updateScalarField(field, value);
  }

  function handleSubmitClick(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    updatePageApi.mutate(dataRef.current);
  }

  async function loadLastRevision() {
    const revision = await getLatestPageRevisionByUrl(data.id);
    if (!revision) {
      alert(t('No revision available'));
      return;
    }
    const page = buildCollabPage(revision.record);
    lastEditorHtmlRef.current = page.content;
    const client = collabClientRef.current;
    if (!client) {
      applyPageState(page);
      editorRef.current?.resetContent(page.content);
      return;
    }
    client.replacePage(page);
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
            <span className="font-medium">{collaborationStatusLabel}</span>
            {collabStatus !== "disabled" && (
              <span>{presenceSummary.totalEditors} {activeEditorsLabel}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {collabStatus !== "disabled" && presenceSummary.entries.map((entry) => (
              <span
                key={entry.clientId}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${entry.colorClass}`}
                title={entry.isSelf ? t('You') : entry.userId}
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

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
import { useContext, useEffect, useState, useRef, MouseEvent, useMemo, useCallback } from "react";
import { clearCache, PageDropDown } from "../editors/PageDropDown";
import { IconFidgetSpinner } from "@tabler/icons-react";
import ToggleButton from "../../components/ToggleButton";
import MenuButton from "../layout/MenuButton";
import { useAutoSaveStore } from "../editors/AutoSaveStore";
import { useTranslation } from "react-i18next";
import { UserContext } from "../auth/UserProvider";
import {
  applyPatchToPage,
  buildCollabPage,
  createHtmlPatch,
  createScalarPatch,
  createTextPatch,
  PageCollabClient,
} from "./pageCollab";
import type { AppliedCollabPatch, CollabParticipant, CollabPatch, CollabStatus } from "./pageCollabTypes";

export default function EditPage() {
  const { t } = useTranslation();
  const { username } = useContext(UserContext);
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
  const suppressEditorChangeRef = useRef(false);
  const [isDiagramModalOpen, setIsDiagramModalOpen] = useState(false);
  const [isDataModelModalOpen, setIsDataModelModalOpen] = useState(false);
  const [isImageBrowserModalOpen, setIsImageBrowserModalOpen] = useState(false);
  const [collabStatus, setCollabStatus] = useState<CollabStatus>("disconnected");
  const [participants, setParticipants] = useState<CollabParticipant[]>([]);
  const [diagramUrl, setDiagramUrl] = useState<string>();
  const [dataModelUrl, setDataModelUrl] = useState<string>();
  const localStorageKey = `editPageData_${pageId}`;
  const navigate = useNavigate();
  const presenceSummary = useMemo(() => summarizeParticipants(participants, username), [participants, username]);

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
    if (!client.sendPatch(nextPatch)) {
      pendingPatchIdRef.current = null;
    }
  }, []);

  const replaceEditorContent = useCallback((content: string) => {
    suppressEditorChangeRef.current = true;
    editorRef.current?.resetContent(content);
  }, []);

  const applySnapshot = useCallback((page: PageRequest, version: number, nextParticipants: CollabParticipant[], clientId?: string) => {
    currentVersionRef.current = version;
    currentClientIdRef.current = clientId ?? currentClientIdRef.current;
    sharedPageRef.current = page;
    pendingPatchIdRef.current = null;
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

    if (patch.clientId === currentClientIdRef.current) {
      if (pendingPatchIdRef.current === patch.id) {
        pendingPatchIdRef.current = null;
      }
      flushLocalChanges();
      return;
    }

    try {
      const nextLocal = applyPatchToPage(dataRef.current, patch);
      dataRef.current = nextLocal;
      setData(nextLocal);
      if (patch.field === "content") {
        replaceEditorContent(nextLocal.content);
      }
    } catch {
      dataRef.current = nextShared;
      setData(nextShared);
      if (patch.field === "content") {
        replaceEditorContent(nextShared.content);
      }
    }

    flushLocalChanges();
  }, [flushLocalChanges, replaceEditorContent]);

  useEffect(() => {
    if (initialData && !autoSaveData) {
      const page = buildCollabPage(initialData);
      sharedPageRef.current = page;
      dataRef.current = page;
      setData(page);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData]);

  useEffect(() => {
    if (autoSaveData) {
      dataRef.current = autoSaveData;
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
      onPresence: (nextParticipants) => setParticipants(nextParticipants),
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
      collabClientRef.current = null;
      pendingPatchIdRef.current = null;
      currentClientIdRef.current = "";
      setParticipants([]);
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

  if (isLoading) return <div>{t('Loading...')}</div>;
  if (isError) return <div>{t('Page not found')}</div>;

  function updateLocalPage(nextPage: PageRequest) {
    dataRef.current = nextPage;
    setData(nextPage);
    flushLocalChanges();
  }

  function updateTextField(field: "title" | "url" | "shortDesc", value: string) {
    updateLocalPage({ ...dataRef.current, [field]: value });
  }

  function updateScalarField(field: "parentId" | "isProtected" | "isPinned" | "isCategoryPage" | "sortChildrenDesc", value: number | boolean | null) {
    updateLocalPage({ ...dataRef.current, [field]: value } as PageRequest);
  }

  function handleContentChange(content: string) {
    if (suppressEditorChangeRef.current) {
      suppressEditorChangeRef.current = false;
      return;
    }
    updateLocalPage({ ...dataRef.current, content });
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
                key={entry.userId}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${entry.isSelf ? "border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100" : "border-sky-200 bg-white/80 text-sky-900 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-100"}`}
                title={entry.tabCount > 1 ? `${entry.tabCount} tabs` : "1 tab"}
              >
                {entry.label}
                {entry.tabCount > 1 ? ` (${entry.tabCount} tabs)` : ""}
              </span>
            ))}
          </div>
        </div>
      </section>
      <section className="flex flex-row items-center">
        <label className="basis-1/4">{t('Title')}</label>
        <input
          className="basis-3/4 border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md p-2"
          type="text"
          placeholder={t('Title')}
          value={data.title}
          onChange={(e) => updateTextField("title", e.target.value)}
        />
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
        <input
          className="basis-3/4 border-2 border-gray-300 dark:border-gray-600 rounded-md p-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          type="text"
          placeholder={t('URL')}
          value={data.url}
          onChange={(e) => updateTextField("url", e.target.value)}
        />
      </section>
      <section className="flex flex-row items-center">
        <label className="basis-1/4">{t('Short Description')}</label>
        <input
          className="basis-3/4 border-2 border-gray-300 dark:border-gray-600 rounded-md p-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          type="text"
          placeholder={t('Short Description')}
          value={data.shortDesc}
          onChange={(e) => updateTextField("shortDesc", e.target.value)}
        />
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
  userId: string;
  label: string;
  tabCount: number;
  isSelf: boolean;
};

function summarizeParticipants(participants: CollabParticipant[], currentUsername?: string) {
  const grouped = new Map<string, PresenceEntry>();
  for (const participant of participants) {
    const key = participant.userId || participant.clientId;
    const existing = grouped.get(key);
    if (existing) {
      existing.tabCount += 1;
      continue;
    }
    const isSelf = !!currentUsername && participant.userId === currentUsername;
    grouped.set(key, {
      userId: key,
      label: isSelf ? `${participant.userId} (you)` : participant.userId,
      tabCount: 1,
      isSelf,
    });
  }
  const entries = Array.from(grouped.values()).sort((left, right) => {
    if (left.isSelf !== right.isSelf) return left.isSelf ? -1 : 1;
    return left.label.localeCompare(right.label);
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

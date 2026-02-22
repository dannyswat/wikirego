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
import { useEffect, useState, useRef, MouseEvent, useMemo } from "react";
import { clearCache, PageDropDown } from "../editors/PageDropDown";
import { IconFidgetSpinner } from "@tabler/icons-react";
import ToggleButton from "../../components/ToggleButton";
import MenuButton from "../layout/MenuButton";
import { useAutoSaveStore } from "../editors/AutoSaveStore";
import { useTranslation } from "react-i18next";

export default function EditPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const pageId = id ? window.location.pathname.substring(6) : "home";
  const { isAutoSaveEnabled } = useAutoSaveStore();
  const editorRef = useRef<HtmlEditorRef>(null);
  const [isDiagramModalOpen, setIsDiagramModalOpen] = useState(false);
  const [isDataModelModalOpen, setIsDataModelModalOpen] = useState(false);
  const [isImageBrowserModalOpen, setIsImageBrowserModalOpen] = useState(false);
  const [diagramUrl, setDiagramUrl] = useState<string>();
  const [dataModelUrl, setDataModelUrl] = useState<string>();
  const localStorageKey = `editPageData_${pageId}`;
  const navigate = useNavigate();
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
    if (initialData && !autoSaveData) {
      setData(initialData);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData]);

  useEffect(() => {
    if (autoSaveData) {
      setData(autoSaveData);
    }
  }, [autoSaveData]);

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

  function handleSubmitClick(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    updatePageApi.mutate(data);
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
      <section className="flex flex-row items-center">
        <label className="basis-1/4">{t('Title')}</label>
        <input
          className="basis-3/4 border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md p-2"
          type="text"
          placeholder={t('Title')}
          value={data.title}
          onChange={(e) =>
            setData((prev) => ({ ...prev, title: e.target.value }))
          }
        />
      </section>
      <section className="flex flex-row items-center">
        <label className="basis-1/4">{t('Parent Page')}</label>
        <PageDropDown
          className="basis-3/4 border-2 border-gray-300 dark:border-gray-600 rounded-md p-2 w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          value={data.parentId || undefined}
          onChange={(value) =>
            setData((prev) => ({ ...prev, parentId: value || null }))
          }
        />
      </section>
      <section className="flex flex-row items-center">
        <label className="basis-1/4">{t('URL')}</label>
        <input
          className="basis-3/4 border-2 border-gray-300 dark:border-gray-600 rounded-md p-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          type="text"
          placeholder={t('URL')}
          value={data.url}
          onChange={(e) =>
            setData((prev) => ({ ...prev, url: e.target.value }))
          }
        />
      </section>
      <section className="flex flex-row items-center">
        <label className="basis-1/4">{t('Short Description')}</label>
        <input
          className="basis-3/4 border-2 border-gray-300 dark:border-gray-600 rounded-md p-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          type="text"
          placeholder={t('Short Description')}
          value={data.shortDesc}
          onChange={(e) =>
            setData((prev) => ({ ...prev, shortDesc: e.target.value }))
          }
        />
      </section>
      <section className="flex flex-row items-center">
        <label className="basis-1/4">{t('Category')}</label>
        <ToggleButton
          label={t('Category Page')}
          checked={data.isCategoryPage}
          className="ms-4"
          onChange={(value) =>
            setData((prev) => ({ ...prev, isCategoryPage: value }))
          }
        />
        <ToggleButton
          label={t('Reverse Order')}
          checked={data.sortChildrenDesc}
          className="ms-4"
          onChange={(value) =>
            setData((prev) => ({ ...prev, sortChildrenDesc: value }))
          }
        />
      </section>
      <section>
        <HtmlEditor
          ref={editorRef}
          value={data.content}
          onChange={(content) => setData((prev) => ({ ...prev, content }))}
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
          onChange={(value) =>
            setData((prev) => ({ ...prev, isProtected: value }))
          }
        />
        <ToggleButton
          label={t('Pinned')}
          checked={data.isPinned}
          className="ms-4"
          onChange={(value) =>
            setData((prev) => ({ ...prev, isPinned: value }))
          }
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
          onClose={(imageUrl: string | undefined) => {
            setIsDiagramModalOpen(false);
            if (!imageUrl) return;
            handleInsertImage(imageUrl);
          }}
        />
      )}
      {isDataModelModalOpen && (
        <DataModelModal
          dataModelUrl={dataModelUrl ?? ""}
          onClose={(imageUrl: string | undefined) => {
            setIsDataModelModalOpen(false);
            if (!imageUrl) return;
            handleInsertImage(imageUrl);
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

interface AutoSavePageRequest {
  page: PageRequest;
  expire: number;
}

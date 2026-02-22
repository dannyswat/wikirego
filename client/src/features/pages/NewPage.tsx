import { MouseEvent, useEffect, useRef, useState } from "react";
import { createPage, getAllPages, PageRequest } from "./pageApi";
import HtmlEditor from "../htmleditors/HtmlEditor";
import type { HtmlEditorRef } from "../htmleditors/HtmlEditor";
import DiagramModal from "../editors/DiagramModal";
import DataModelModal from "../editors/DataModelModal";
import ImageBrowserModal from "../editors/ImageBrowserModal";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { queryClient } from "../../common/query";
import { clearCache, PageDropDown } from "../editors/PageDropDown";
import { IconFidgetSpinner } from "@tabler/icons-react";
import ToggleButton from "../../components/ToggleButton";
import { useTranslation } from "react-i18next";

export default function NewPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const editorRef = useRef<HtmlEditorRef>(null);
  const [isDiagramModalOpen, setIsDiagramModalOpen] = useState(false);
  const [isDataModelModalOpen, setIsDataModelModalOpen] = useState(false);
  const [isImageBrowserModalOpen, setIsImageBrowserModalOpen] = useState(false);
  const [diagramUrl, setDiagramUrl] = useState<string>();
  const [dataModelUrl, setDataModelUrl] = useState<string>();
  const urlParams = new URLSearchParams(window.location.search);
  const parentUrl = urlParams.get("parent");
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
  const { data: pageList } = useQuery({
    queryKey: ["pages", true],
    queryFn: getAllPages,
  });
  const createPageApi = useMutation({
    mutationFn: (page: PageRequest) => createPage(page),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["page", data.url] });
      clearCache();
      navigate("/p" + data.url);
    },
    onError: (err) => {
      console.log(JSON.stringify(err.message));
      alert(err.message);
    },
  });

  useEffect(() => {
    if (!parentUrl) return;
    const page = pageList?.find((p) => p.url === parentUrl);
    if (page) {
      setData((prev) => ({
        ...prev,
        parentId: page.id,
        url: _generateUrl(page.id, ""),
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageList]);

  function handleParentChange(parentId: number | undefined) {
    setData((prev) => {
      const state = { ...prev, parentId: parentId ?? null };
      if (parentId) state.url = _generateUrl(parentId, state.title);
      return state;
    });
  }

  function handleTitleChange(title: string) {
    setData((prev) => ({
      ...prev,
      title: title,
      url: _generateUrl(prev.parentId, title),
    }));
  }

  function _generateUrl(parentId: number | null, title: string) {
    if (parentId) {
      const parentUrl = pageList?.find((p) => p.id === parentId)?.url;
      return parentUrl
        ? `${parentUrl}/${generateUrl(title)}`
        : '/' + generateUrl(title);
    }
    return '/' + generateUrl(title);
  }

  function handleSubmitClick(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    createPageApi.mutate({ ...data, id: 0 });
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
          className="basis-3/4 border-2 border-gray-300 dark:border-gray-600 rounded-md p-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          type="text"
          placeholder={t('Title')}
          value={data.title}
          onChange={(e) => handleTitleChange(e.target.value)}
        />
      </section>
      <section className="flex flex-row items-center">
        <label className="basis-1/4">{t('Parent Page')}</label>
        <PageDropDown
          className="basis-3/4 border-2 border-gray-300 dark:border-gray-600 rounded-md p-2 w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          value={data.parentId ?? undefined}
          onChange={handleParentChange}
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
          checked={data.isCategoryPage ?? false}
          className="ms-4"
          onChange={(value) =>
            setData((prev) => ({
              ...prev,
              isCategoryPage: value,
            }))
          }
        />
        <ToggleButton
          label={t('Reverse Order')}
          checked={data.sortChildrenDesc ?? false}
          className="ms-4"
          onChange={(value) =>
            setData((prev) => ({
              ...prev,
              sortChildrenDesc: value,
            }))
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
      <section className="flex flex-row items-center">
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
      <section className="flex flex-row justify-items-end">
        <button
          disabled={createPageApi.isPending}
          onClick={handleSubmitClick}
          className="basis-1/2 sm:basis-1/6 bg-lime-700 hover:bg-lime-800 dark:bg-lime-600 dark:hover:bg-lime-700 text-white rounded-md py-2 px-5"
        >
          {createPageApi.isPending ? (
            <IconFidgetSpinner className="animate-spin mx-auto" />
          ) : (
            t('Create')
          )}
        </button>
        <button
          onClick={() => {
            if (!data.content || confirm(t('Are you sure to leave')))
              navigate("/");
          }}
          className="basis-1/2 sm:basis-1/6 bg-gray-700 hover:bg-gray-800 dark:bg-gray-600 dark:hover:bg-gray-700 text-white rounded-md py-2 px-5 ms-4"
        >
          {t('Cancel')}
        </button>
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

function generateUrl(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-");
}

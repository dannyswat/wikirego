import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { getAllPages, getPageByUrl } from "./pageApi";
import { useContext, useEffect, useMemo } from "react";
import TableOfContent from "./TableOfContent";
import { UserContext } from "../auth/UserProvider";
import { buildTree, findItemInTree } from "./pageTree";
import { IconFidgetSpinner } from "@tabler/icons-react";
import PageList from "./PageList";
import { SettingContext } from "../setup/SettingProvider";

export default function Page() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const pageId = id ? window.location.pathname.substring(3) : "home";
  const { isLoggedIn } = useContext(UserContext);
  const { setting } = useContext(SettingContext);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["page", pageId],
    queryFn: () => getPageByUrl(pageId),
  });
  const { data: allPages, isLoading: isLoadingAllPages } = useQuery({
    queryKey: ["pages", isLoggedIn],
    queryFn: getAllPages,
    enabled: data?.isCategoryPage,
  });
  const pageMeta = useMemo(() => (allPages && data ?
    findItemInTree(buildTree(allPages), data.url) : null), [allPages, data]);

  useEffect(() => {
    const siteName = setting?.site_name || "wiki rego";
    if (data?.title) document.title = data.title + " - " + siteName;
    else document.title = siteName;
  }, [data?.title, setting?.site_name]);

  if (isLoading) return <div>{t("Loading")}</div>;
  if (isError) return <div>{t("Error loading page")}</div>;
  if (!data) return <div>{t("Page not found")}</div>;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_280px] xl:gap-6">
      <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 sm:p-7 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {data.url}
            </p>
            <h1 className="mb-1 mt-1 text-3xl font-semibold tracking-tight text-[#1e5770] dark:text-[#92A7B4]">
              {data.title}
            </h1>
            {data.shortDesc && (
              <p className="text-sm text-slate-500 dark:text-slate-400">{data.shortDesc}</p>
            )}
          </div>
        </div>

        <div
          className="ck-content overflow-x-auto break-words"
          dangerouslySetInnerHTML={{ __html: data.content || "" }}
        ></div>

        {isLoadingAllPages && (
          <div className="mt-4 flex justify-center">
            <IconFidgetSpinner className="animate-spin text-slate-500" />
          </div>
        )}

        {data.isCategoryPage && pageMeta && pageMeta.children.length > 0 && (
          <div className="mt-8 border-t border-slate-200 pt-5 dark:border-slate-800">
            <PageList
              pages={pageMeta.children}
              onPageClick={(page) => {
                navigate("/p" + page.url);
              }}
            />
          </div>
        )}
      </div>

      {data.content && (
        <TableOfContent title={data.title} content={data.content} />
      )}
    </div>
  );
}

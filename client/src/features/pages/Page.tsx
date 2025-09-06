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
  }, [data?.title]);

  if (isLoading) return <div>{t("Loading")}</div>;
  if (isError) return <div>{t("Error loading page")}</div>;
  if (!data) return <div>{t("Page not found")}</div>;

  return (
    <div className="flex gap-6">
      <div className="flex-1 min-w-0">
        <h1 className="text-3xl font-bold font-serif mb-2 border-b-2 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">
          {data.title}
        </h1>
        <p className="text-sm font-serif px-1 mb-4 text-gray-700 dark:text-gray-300">{data.shortDesc}</p>
        <div
          className="ck-content overflow-x-auto break-words"
          dangerouslySetInnerHTML={{ __html: data.content || "" }}
        ></div>
        {isLoadingAllPages && (
          <div className="flex justify-center mt-4">
            <IconFidgetSpinner className="animate-spin text-gray-500" />
          </div>
        )}
        {data.isCategoryPage && pageMeta && pageMeta.children.length > 0 && (
          <div className="mt-4">
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

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { getAllPages } from "../pages/pageApi";
import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { UserContext } from "../auth/UserProvider";
import { buildTree, findItemHierarchyInTree, PageMetaObject } from "../pages/pageTree";

interface SideNavProps extends React.HTMLAttributes<HTMLDivElement> {
  headerComponent?: React.ReactNode;
  footerComponent?: React.ReactNode;
  navigate: (url: string) => void;
}

export default function SideNav({
  className,
  headerComponent,
  footerComponent,
  navigate,
  ...props
}: SideNavProps) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { isLoggedIn } = useContext(UserContext);
  const justNavigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["pages", isLoggedIn],
    queryFn: getAllPages,
  });
  const menu = useMemo(() => (data ? buildTree(data) : []), [data]);
  const currentPageUrl = useMemo(() => {
    if (pathname === "/") return "/home";
    if (!pathname.startsWith("/p/")) return "/home";
    try {
      return decodeURIComponent(pathname.substring(2));
    } catch {
      return pathname.substring(2);
    }
  }, [pathname]);
  const [root, setRoot] = useState<PageMetaObject>();
  const lastRoot = useRef<PageMetaObject[]>([]);
  const initialized = useRef(false);

  useEffect(() => {
    if (menu.length === 0) return;
    const hierarchy = findItemHierarchyInTree(menu, currentPageUrl);

    if (hierarchy.length >= 2) {
      lastRoot.current = [];
      for (let i = 0; i < hierarchy.length - 2; i++) {
        lastRoot.current.push(hierarchy[i]);
      }
      if (!initialized.current) {
        const page = hierarchy[hierarchy.length - 1];
        const newRoot = hierarchy[hierarchy.length - 2];
        setRoot(page.children?.length ? page : newRoot);
        initialized.current = true;
      }
    }
    else if (!initialized.current) {
      const currPage = hierarchy[hierarchy.length - 1];
      setRoot(currPage.children?.length ? currPage : undefined);
      initialized.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu, currentPageUrl]);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        {t("Loading")}...
      </div>
    );
  }

  function handleMenuItemClick(page: PageMetaObject) {
    if (!page.children?.length) {
      navigate("/p" + page.url);
      return;
    }
    if (root) lastRoot.current.push(root);
    setRoot(page);
    justNavigate("/p" + page.url);
  }

  function handleMenuBackClick() {
    setRoot(lastRoot.current.length ? lastRoot.current.pop() : undefined);
  }

  return (
    <nav
      className={
        "overflow-y-auto" +
        (className ? " " + className : "")
      }
      {...props}
    >
      {headerComponent}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-[#1e5770] dark:text-[#92A7B4]">{t("Pages")}</h2>
        {isLoggedIn && (
          <button
            onClick={() => navigate(
                  "/create" +
                  (root ? "?parent=" + encodeURIComponent(root.url) : "")
                )}
            className="rounded-md px-2 py-1 text-xs text-[#2d6880] hover:bg-slate-100 dark:text-[#92A7B4] dark:hover:bg-slate-800"
          >
            {t("Create")}
          </button>
        )}
      </div>

      {root && (
        <ul className="mt-2 space-y-1">
          <li>
            <button
              onClick={handleMenuBackClick}
              className="w-full rounded-md px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <i className="mr-2">&larr;</i>
              {t("Back")}
            </button>
          </li>
          <li>
            <button
              onClick={() => navigate("/p" + root.url)}
              className="w-full rounded-md bg-slate-100 px-3 py-2 text-left text-sm font-medium text-[#1e5770] dark:bg-slate-800 dark:text-[#92A7B4]"
            >
              {root.title}
            </button>
          </li>
        </ul>
      )}

      <ul className={"space-y-1" + (root ? " mt-2" : " mt-1") }>
        {(root ? root.children : menu).map((page) => (
          <li key={page.id}>
            <button
              onClick={() => handleMenuItemClick(page)}
              className="w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {page.title}
              {page.children && page.children.length > 0 && (
                <i className="ml-2">&rarr;</i>
              )}
            </button>
          </li>
        ))}
        {isLoggedIn && (
          <li>
            <button
              onClick={() =>
                navigate(
                  "/create" +
                  (root ? "?parent=" + encodeURIComponent(root.url) : "")
                )
              }
              className="w-full rounded-md px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              {t("Create New Page")}
            </button>
          </li>
        )}
      </ul>
      {footerComponent}
    </nav>
  );
}

import { useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import SideNav from "./SideNav";
import { NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import { UserContext } from "../auth/UserProvider";
import { IconClearAll, IconMenu2, IconSearch } from "@tabler/icons-react";
import { Footer } from "./Footer";
import { SettingMenu } from "./SettingMenu";
import SiteLogo from "../../components/SiteLogo";
import { SettingContext } from "../setup/SettingProvider";
import { useTheme } from "../../contexts/ThemeProvider";

interface LayoutProps {
  isPage?: boolean;
}

export default function LayoutMain({ isPage }: LayoutProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { isLoggedIn, canEdit } = useContext(UserContext);
  const { setting } = useContext(SettingContext);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { id } = useParams();

  useEffect(() => {
    if (setting && setting.is_site_protected && !isLoggedIn) {
      navigate(`/login`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pageId = isPage
    ? id
      ? window.location.pathname.substring(3)
      : "home"
    : "";
  const returnUrlQuery = isPage
    ? `?returnUrl=${encodeURIComponent(window.location.pathname)}`
    : "";
  function navigateTo(path: string) {
    setIsMenuOpen(false);
    navigate(path);
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 text-slate-800 dark:bg-slate-950 dark:text-slate-200">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <button
              className="rounded-md p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden"
              onClick={() => setIsMenuOpen((p) => !p)}
            >
              <IconMenu2 size={22} />
            </button>
            <NavLink className="inline-flex" to="/">
              <SiteLogo isLight={theme === "light"} />
            </NavLink>
          </div>

          <button
            className="hidden w-full max-w-xl items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-slate-200 md:flex"
            onClick={() => navigate("/search")}
          >
            <IconSearch size={16} />
            <span>{t("Search")}</span>
          </button>

          <div className="flex items-center gap-2 sm:gap-3">
            <NavLink
              to="/search"
              className="rounded-md p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 md:hidden"
            >
              <IconSearch size={20} />
            </NavLink>
            {!isLoggedIn && (
              <NavLink
                to={"/login" + returnUrlQuery}
                className="rounded-lg bg-[#2d6880] px-3 py-2 text-sm font-medium text-white hover:bg-[#1e5770]"
              >
                {t("Login")}
              </NavLink>
            )}
            {isLoggedIn && canEdit && (
              <NavLink
                to="/create"
                className="rounded-lg bg-[#2d6880] px-3 py-2 text-sm font-medium text-white hover:bg-[#1e5770]"
              >
                {t("Create")}
              </NavLink>
            )}
            {isLoggedIn && isPage && pageId && canEdit && (
              <NavLink
                to={`/edit/${pageId}`}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                {t("Edit")}
              </NavLink>
            )}
            {isLoggedIn && (
              <SettingMenu
                returnUrl={isPage ? window.location.pathname : undefined}
              />
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1600px] flex-1 px-4 sm:px-6 lg:px-8">
        <div
          className={`${isMenuOpen ? "block" : "hidden"
            } fixed inset-0 z-20 bg-black/50 dark:bg-black/70 lg:hidden`}
          onClick={() => setIsMenuOpen(false)}
        ></div>

        <div className="grid w-full grid-cols-1 gap-4 py-4 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-6 lg:py-6">
          <SideNav
            navigate={navigateTo}
            className={`fixed inset-y-0 left-0 z-30 w-[85%] max-w-sm rounded-r-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 ${isMenuOpen ? "block" : "hidden"
              } lg:sticky lg:top-24 lg:block lg:h-[calc(100vh-7rem)] lg:w-auto lg:max-w-none lg:rounded-xl`}
            headerComponent={
              <>
                <SiteLogo isLight={theme === "light"} className="mb-3 lg:hidden" />
                <button
                  className="absolute right-4 top-4 rounded-md p-1 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <IconClearAll height={22} />
                </button>
              </>
            }
          />

          <div className="min-w-0">
            <Outlet />
          </div>
        </div>
      </div>

      <Footer />
      <button
        className="fixed bottom-3 right-3 rounded-xl bg-slate-700/60 p-2 text-white hover:bg-slate-700 dark:bg-slate-700/70 dark:hover:bg-slate-600 lg:hidden"
        onClick={() => setIsMenuOpen((p) => !p)}
      >
        <IconMenu2 size={22} />
      </button>
    </div>
  );
}

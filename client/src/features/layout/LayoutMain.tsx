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

interface LayoutProps {
  isPage?: boolean;
}

export default function LayoutMain({ isPage }: LayoutProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isLoggedIn, canEdit } = useContext(UserContext);
  const { setting } = useContext(SettingContext);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { id } = useParams();

  useEffect(() => {
    if (setting && setting.is_site_protected && !isLoggedIn) {
      navigate(`/login`);
    }
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
    <div className="flex flex-col min-h-screen bg-white dark:bg-gray-900">
      <header className="flex justify-between items-center p-2 bg-[#332F2F] text-white">
        <div className="text-xl font-bold">
          <button
            className="p-2 sm:hidden"
            onClick={() => setIsMenuOpen((p) => !p)}
          >
            <IconMenu2 className="hover:text-gray-200 dark:hover:text-gray-300" size={24} />
          </button>
          <NavLink className="hidden sm:inline" to="/">
            <SiteLogo />
          </NavLink>
        </div>
        <div className="space-x-4 text-right flex items-center">
          <NavLink to="/search" className="text-white hover:text-gray-200 dark:hover:text-gray-300">
            <IconSearch className="inline-block mr-1" size={20} />
          </NavLink>
          {!isLoggedIn && (
            <NavLink
              to={"/login" + returnUrlQuery}
              className="bg-blue-500 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-800 text-white font-bold py-2 px-4 rounded"
            >
              {t("Login")}
            </NavLink>
          )}
          {isLoggedIn && canEdit && (
            <NavLink
              to="/create"
              className="bg-green-500 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-800 text-white font-bold py-2 px-4 rounded"
            >
              {t("Create")}
            </NavLink>
          )}
          {isLoggedIn && isPage && pageId && canEdit && (
            <NavLink
              to={`/edit/${pageId}`}
              className="bg-yellow-500 hover:bg-yellow-700 dark:bg-yellow-600 dark:hover:bg-yellow-800 text-white font-bold py-2 px-4 rounded"
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
      </header>
      <div className="flex flex-1">
        <div
          className={`${isMenuOpen ? "block" : "hidden"
            } sm:hidden fixed inset-0 bg-black dark:bg-black bg-opacity-50 dark:bg-opacity-70 z-10`}
          onClick={() => setIsMenuOpen(false)}
        ></div>
        <SideNav
          navigate={navigateTo}
          className={`fixed inset-0 w-full ${isMenuOpen ? "block" : "hidden"
            } sm:block sm:relative sm:w-1/4 z-20`}
          headerComponent={
            <button
              className="absolute right-4 top-4 sm:hidden hover:text-gray-700 dark:hover:text-gray-300"
              onClick={() => setIsMenuOpen(false)}
            >
              <IconClearAll height={24} />
            </button>
          }
        />
        <div className="flex-1 p-4 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
          <Outlet />
        </div>
      </div>
      <Footer />
      <button
        className="p-2 fixed right-3 bottom-3 bg-gray-600/30 hover:bg-gray-600 dark:bg-gray-700/40 dark:hover:bg-gray-700 rounded-xl sm:hidden"
        onClick={() => setIsMenuOpen((p) => !p)}
      >
        <IconMenu2 className="text-gray-200 hover:text-white dark:text-gray-300 dark:hover:text-white" size={24} />
      </button>
    </div>
  );
}

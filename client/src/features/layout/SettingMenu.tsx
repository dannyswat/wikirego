import { IconSettings } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { useContext, useEffect, useState } from "react";
import { logoutApi } from "../auth/authApi";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../auth/UserProvider";
import { useTranslation } from "react-i18next";

export function SettingMenu({ returnUrl }: { returnUrl?: string }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isAdmin } = useContext(UserContext);
  const [isOpen, setIsOpen] = useState(false);
  const logout = useMutation({
    mutationFn: logoutApi,
    onSuccess: () => {
      window.location.href = returnUrl || "/";
    },
  });

  useEffect(() => {
    if (isOpen) {
      const closeMenu = () => setIsOpen(false);
      setTimeout(() => document.addEventListener("click", closeMenu), 0);
      return () => document.removeEventListener("click", closeMenu);
    }
  }, [isOpen]);

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setIsOpen((p) => !p)}
        className="rounded-md p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <IconSettings
          size={22}
          className="inline transition hover:rotate-180"
        />
      </button>
      <div
        className={
          "absolute right-0 z-10 mt-2 w-56 rounded-lg border border-slate-200 bg-white py-2 text-left shadow-lg dark:border-slate-700 dark:bg-slate-900 " +
          (isOpen ? "block" : "hidden")
        }
      >
        {isAdmin && (
          <>
            <button
              onClick={() => navigate("/users")}
              className="box-border w-full px-4 py-2 text-left text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {t('Users')}
            </button>
            <button onClick={() => navigate("/site-setting")}
              className="box-border w-full px-4 py-2 text-left text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {t('Site Setting')}
            </button>
            <button
              onClick={() => navigate("/security-setting")}
              className="box-border w-full px-4 py-2 text-left text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {t('Security Setting')}
            </button>
            <button onClick={() => navigate("/filebrowser")}
              className="box-border w-full px-4 py-2 text-left text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {t('File Browser')}
            </button>
            <button onClick={() => navigate('/page-admin')}
              className="box-border w-full px-4 py-2 text-left text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {t('Admin Operations')}
            </button>
            <div className="my-1 border-t border-slate-200 dark:border-slate-700" />
          </>
        )}
        <button
          onClick={() => navigate("/change-password")}
          className="box-border w-full px-4 py-2 text-left text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          {t('Change Password')}
        </button>
        <button
          onClick={() => logout.mutate()}
          className="box-border w-full px-4 py-2 text-left text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
        >
          {t('Logout')}
        </button>
      </div>
    </div>
  );
}

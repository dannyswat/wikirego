import { IconSettings } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useAutoSaveStore } from "./AutoSaveStore";
import ToggleButton from "../../components/ToggleButton";
import { useTranslation } from "react-i18next";

export default function EditorMenu() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const { isAutoSaveEnabled, setAutoSave } = useAutoSaveStore();

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
        <div className="flex items-center justify-between px-4 py-2 text-slate-700 dark:text-slate-200">
          <ToggleButton
            label={t('Auto Save')}
            checked={isAutoSaveEnabled}
            className="ms-4"
            onChange={() => setAutoSave(!isAutoSaveEnabled)}
          />
        </div>
      </div>
    </div>
  );
}

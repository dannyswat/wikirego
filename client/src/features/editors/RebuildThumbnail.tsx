import { useState } from "react";
import { rebuildThumbnails } from "./uploadApi";
import { useTranslation } from "react-i18next";

export default function RebuildThumbnail() {
    const { t } = useTranslation();
    const [message, setMessage] = useState<string>("");
    const [isLoading, setIsLoading] = useState<boolean>(false);

    async function handleClick() {
        try {
            setIsLoading(true);
            await rebuildThumbnails();
            setIsLoading(false);
            setMessage(t('Thumbnails rebuilt successfully.'));
        }
        catch (error) {
            console.error("Error rebuilding thumbnails:", error);
            setMessage(t("Failed to rebuild thumbnails. Please try again later."));
        }
    }

    return (
        <div className="flex w-full flex-col gap-4">
            <h2 className="text-xl font-semibold tracking-tight text-[#1e5770] dark:text-[#92A7B4]">{t('Rebuild Thumbnails')}</h2>
            <p className="text-slate-600 dark:text-slate-300">
                {t('This will rebuild the thumbnails for all images. It may take some time depending on the number of images.')}
            </p>
            <button disabled={isLoading}
                onClick={handleClick}
                className="w-fit rounded-lg bg-[#2d6880] px-4 py-2.5 font-medium text-white transition hover:bg-[#1e5770] disabled:opacity-60"
            >
                {isLoading ? t("Rebuilding...") : t("Rebuild Thumbnails")}
            </button>
            {message && message === t('Thumbnails rebuilt successfully.') && (
                <div className="mt-2 rounded-md border border-emerald-300 bg-emerald-50 p-2 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                    {message}
                </div>
            )}
            {message && !message.includes('successfully') && (
                <div className="mt-2 rounded-md border border-red-300 bg-red-50 p-2 text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300">
                    {message}
                </div>
            )}
        </div>
    );
}
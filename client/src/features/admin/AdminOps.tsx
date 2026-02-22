import RebuildThumbnail from "../editors/RebuildThumbnail";
import RebuildSearch from "../pages/RebuildSearch";
import { useTranslation } from "react-i18next";

export default function AdminOps() {
    const { t } = useTranslation();
    return <div className="w-full rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <h1 className="mb-5 text-2xl font-semibold tracking-tight text-[#1e5770] dark:text-[#92A7B4]">{t('Admin Operations')}</h1>
        <section className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
            <RebuildSearch />
        </section>
        <section className="mt-4 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
            <RebuildThumbnail />
        </section>
    </div>;
}
import { ChangeEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { PageMeta, searchPages } from "./pageApi";
import { IconFidgetSpinner } from "@tabler/icons-react";

export default function Search() {
    const { t } = useTranslation();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeSearchQuery, setActiveSearchQuery] = useState<string>('');
    const [searchResults, setSearchResults] = useState<PageMeta[]>();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    function handleSearchQueryChange(e: ChangeEvent<HTMLInputElement>) {
        setSearchQuery(e.target.value);
    }

    const handleSearch = async () => {
        if (!searchQuery.trim()) {
            setSearchResults(undefined);
            setActiveSearchQuery('');
            setError(null);
            return;
        }
        if (searchQuery === activeSearchQuery && searchResults) {
            return;
        }
        setLoading(true);
        setError(null);
        setActiveSearchQuery(searchQuery);
        try {
            const results = await searchPages(searchQuery);
            setSearchResults(results);
        } catch (err) {
            setError(t('Failed to fetch search results'));
            setSearchResults([]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-[#1e5770] dark:text-[#92A7B4]">
                    {t("Search")}
                </h1>
            </div>

            <section className="flex flex-col items-center gap-3 sm:flex-row">
                <input
                    type="text"
                    value={searchQuery}
                    onChange={handleSearchQueryChange}
                    placeholder={t("Enter search query")}
                    className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:flex-1"
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <div className="w-full sm:w-auto">
                    <button
                        onClick={handleSearch}
                        disabled={loading}
                        className="w-full rounded-lg bg-[#2d6880] px-5 py-2.5 text-white hover:bg-[#1e5770] disabled:opacity-70 sm:w-auto"
                    >
                        {loading ? (
                            <IconFidgetSpinner className="mx-auto animate-spin" />
                        ) : (
                            t("Search")
                        )}
                    </button>
                </div>
            </section>

            {error && (
                <section className="mt-4 flex flex-row">
                    <div className="w-full rounded-md border border-red-300 bg-red-50 p-3 text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300">
                        {error}
                    </div>
                </section>
            )}

            {searchResults && searchResults.length > 0 && (
                <section className="mt-5">
                    <h2 className="mb-4 text-lg font-medium text-slate-700 dark:text-slate-200">
                        {t("Search Results for")} "{activeSearchQuery}" ({searchResults.length})
                    </h2>
                    <div className="space-y-3">
                        {searchResults.map((page) => (
                            <div key={page.id} className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40 dark:hover:bg-slate-800/60">
                                <a
                                    href={`/p${page.url}`}
                                    className="text-lg font-medium text-[#2d6880] hover:text-[#1e5770] dark:text-[#92A7B4] dark:hover:text-[#c0d4dd]"
                                >
                                    {page.title}
                                </a>
                                {page.url && (
                                    <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                        {page.url}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {searchQuery && !loading && searchResults?.length === 0 && !error && (
                <section className="mt-4 flex flex-row">
                    <div className="w-full rounded-md border border-slate-200 py-8 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
                        {t("No pages found for")} "{activeSearchQuery}"
                    </div>
                </section>
            )}
        </div>
    );
}
import React, { useState } from "react";
import { createSetting } from "./setupApi";
import { useTranslation } from "react-i18next";

export default function CreateSetting() {
    const { t } = useTranslation();
    const [form, setForm] = useState({
        site_name: "wiki rego",
        logo: "",
        theme: "default",
        footer: "All rights reserved © wiki rego",
        language: "en",
        is_site_protected: false,
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(null);
        try {
            await createSetting(form);
            setSuccess("Setting created successfully.");
            setForm({ site_name: "", logo: "", theme: "", footer: "", language: "", is_site_protected: false });
            await new Promise(resolve => setTimeout(resolve, 2000));
            window.location.replace('/');
        } catch (err: any) {
            setError(err.message || "Failed to create setting.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-[#eef4f7] dark:from-slate-950 dark:via-slate-900 dark:to-[#0f1d24]">
            <div className="mx-auto flex min-h-screen max-w-[1200px] items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
                <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:shadow-slate-950/30 sm:p-8">
                    <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">Setup</p>
                    <h2 className="mb-5 mt-2 text-2xl font-semibold tracking-tight text-[#1e5770] dark:text-[#92A7B4]">{t('Setup Site Settings')}</h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{t('Site Name')}</label>
                            <input
                                type="text"
                                name="site_name"
                                value={form.site_name}
                                onChange={handleChange}
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-[#2d6880] focus:ring-2 focus:ring-[#92A7B4]/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                                required
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{t('Logo URL')}</label>
                            <input
                                type="text"
                                name="logo"
                                value={form.logo}
                                onChange={handleChange}
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-[#2d6880] focus:ring-2 focus:ring-[#92A7B4]/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{t('Theme')}</label>
                            <input
                                type="text"
                                name="theme"
                                value={form.theme}
                                onChange={handleChange}
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-[#2d6880] focus:ring-2 focus:ring-[#92A7B4]/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                                required
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{t('Footer')}</label>
                            <input
                                type="text"
                                name="footer"
                                value={form.footer}
                                onChange={handleChange}
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-[#2d6880] focus:ring-2 focus:ring-[#92A7B4]/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                                required
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{t('Language')}</label>
                            <input
                                type="text"
                                name="language"
                                value={form.language}
                                onChange={handleChange}
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-[#2d6880] focus:ring-2 focus:ring-[#92A7B4]/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                                required
                            />
                        </div>
                        <div className="flex items-center">
                            <input
                                type="checkbox"
                                name="is_site_protected"
                                checked={form.is_site_protected}
                                onChange={(e) => setForm({ ...form, is_site_protected: e.target.checked })}
                                className="mr-2 h-4 w-4 rounded border-slate-300 text-[#2d6880] focus:ring-[#92A7B4]/40 dark:border-slate-600"
                            />
                            <label className="text-sm text-slate-600 dark:text-slate-300">{t('Protect Site')}</label>
                        </div>
                        {error && <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300">{error}</div>}
                        {success && <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">{success}</div>}
                        <button
                            type="submit"
                            className="w-full rounded-lg bg-[#2d6880] py-2.5 font-medium text-white transition hover:bg-[#1e5770] disabled:opacity-60"
                            disabled={loading}
                        >
                            {loading ? t('Saving...') : t('Save Settings')}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
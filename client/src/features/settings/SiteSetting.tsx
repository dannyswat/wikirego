import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import ImageInput from "../../components/ImageInput";
import { useTranslation } from "react-i18next";
import LanguageDropDown from "../../i18n/LanguageDropDown";
import ThemeDropDown from "../../components/ThemeDropDown";

export default function SiteSetting() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { data: siteSetting, isLoading, error } = useQuery({
        queryKey: ['site-setting'],
        queryFn: async () => {
            const response = await fetch('/api/setting');
            if (!response.ok) {
                throw new Error('Failed to fetch site setting');
            }
            return response.json();
        },
        refetchOnWindowFocus: false,
    });

    const [form, setForm] = useState<any | null>(null);
    React.useEffect(() => {
        if (siteSetting) setForm(siteSetting);
    }, [siteSetting]);

    const mutation = useMutation({
        mutationFn: async (data: any) => {
            const response = await fetch('/api/admin/setting', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!response.ok) {
                throw new Error(t('Failed to update site setting'));
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['site-setting'] });
        },
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (form) mutation.mutate(form);
    };

    if (isLoading) return <div className="text-slate-600 dark:text-slate-300">{t('Loading...')}</div>;
    if (error) return <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300">{(error as Error).message}</div>;
    if (!form) return null;

    return (
        <div className="mx-auto mt-2 w-full max-w-3xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <h2 className="mb-5 text-2xl font-semibold tracking-tight text-[#1e5770] dark:text-[#92A7B4]">{t('Site Settings')}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{t('Site Name')}</label>
                    <input
                        type="text"
                        name="site_name"
                        value={form.site_name || ''}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-[#2d6880] focus:ring-2 focus:ring-[#92A7B4]/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                        required
                    />
                </div>
                <div>
                    <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{t('Site URL')}</label>
                    <input
                        type="text"
                        name="site_url"
                        value={form.site_url || ''}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-[#2d6880] focus:ring-2 focus:ring-[#92A7B4]/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                        required
                    />
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('Site URL description')}</p>
                </div>
                <div>
                    <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{t('Logo URL')}</label>
                    <ImageInput value={form.logo || ''} onChange={(value) => setForm({ ...form, logo: value })} />
                </div>
                <div>
                    <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{t('Theme')}</label>
                    <ThemeDropDown className="w-full" value={form.theme || ''} onChange={(theme) => setForm({ ...form, theme })} />
                </div>
                <div>
                    <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{t('Footer')}</label>
                    <input
                        type="text"
                        name="footer"
                        value={form.footer || ''}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-[#2d6880] focus:ring-2 focus:ring-[#92A7B4]/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                        required
                    />
                </div>
                <div>
                    <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{t('Language')}</label>
                    <LanguageDropDown
                        className="w-full"
                        value={form.language || ''}
                        onChange={(lang) => setForm({ ...form, language: lang })}
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
                    <label className="text-sm text-slate-600 dark:text-slate-300">{t('Protect Site (Enable this to restrict access to authorized users only)')}</label>
                </div>
                {mutation.isError && <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300">{(mutation.error as Error).message}</div>}
                {mutation.isSuccess && <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">{t('Settings updated!')}</div>}
                <button
                    type="submit"
                    className="w-full rounded-lg bg-[#2d6880] py-2.5 font-medium text-white transition hover:bg-[#1e5770] disabled:opacity-60"
                    disabled={mutation.status === 'pending'}
                >
                    {mutation.status === 'pending' ? t('Saving...') : t('Save Settings')}
                </button>
            </form>
        </div>
    );
}
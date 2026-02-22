import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";

interface SecuritySetting {
    allow_cors: boolean;
    allowed_cors_origins?: string[];
    allowed_cors_methods: string;
    frame_options: string;
    referrer_policy: string;
    strict_transport_security: string;
    content_security_policy: string;
    x_content_type_options: string;
    x_xss_protection: string;
    x_robots_tag: string;
}

export default function SecuritySetting() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { data: securitySetting, isLoading, error } = useQuery({
        queryKey: ['security-setting'],
        queryFn: async () => {
            const response = await fetch('/api/securitysetting');
            if (!response.ok) {
                throw new Error(t('Failed to fetch security setting'));
            }
            return response.json();
        },
        refetchOnWindowFocus: false,
    });

    const [form, setForm] = useState<SecuritySetting | null>(null);
    React.useEffect(() => {
        if (securitySetting) setForm(securitySetting);
    }, [securitySetting]);

    const mutation = useMutation({
        mutationFn: async (data: SecuritySetting) => {
            const response = await fetch('/api/admin/securitysetting', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!response.ok) {
                throw new Error(t('Failed to update security setting'));
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['security-setting'] });
        },
    });

    const mutationReset = useMutation({
        mutationFn: async () => {
            const response = await fetch('/api/admin/securitysetting?defaults=true', {
                method: 'POST',
            });
            if (!response.ok) {
                throw new Error(t('Failed to reset security setting'));
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['security-setting'] });
        },
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const checked = (e.target as HTMLInputElement).checked;
        setForm((prev) => prev ? {
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        } : prev);
    };

    const handleOriginsChange = (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
        if (!form) return;
        const newOrigins = [...form.allowed_cors_origins ?? []];
        newOrigins[idx] = e.target.value;
        setForm({ ...form, allowed_cors_origins: newOrigins });
    };

    const addOrigin = () => {
        if (!form) return;
        setForm({ ...form, allowed_cors_origins: [...form.allowed_cors_origins ?? [], ""] });
    };
    const removeOrigin = (idx: number) => {
        if (!form) return;
        const newOrigins = (form.allowed_cors_origins ?? []).filter((_, i) => i !== idx);
        setForm({ ...form, allowed_cors_origins: newOrigins });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (form) mutation.mutate(form);
    };

    const handleReset = () => {
        mutationReset.mutate();
        setForm(null);
    };

    if (isLoading) return <div className="text-slate-600 dark:text-slate-300">{t('Loading')}</div>;
    if (error) return <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300">{(error as Error).message}</div>;
    if (!form) return null;

    return (
        <div className="mx-auto mt-2 w-full max-w-3xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <h2 className="mb-5 text-2xl font-semibold tracking-tight text-[#1e5770] dark:text-[#92A7B4]">{t('Security Settings')}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{t('Allow CORS')}</label>
                    <input
                        type="checkbox"
                        name="allow_cors"
                        checked={form.allow_cors}
                        onChange={handleChange}
                        className="mr-2 h-4 w-4 rounded border-slate-300 text-[#2d6880] focus:ring-[#92A7B4]/40 dark:border-slate-600"
                    />
                </div>
                <div>
                    <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{t('Allowed CORS Origins')}</label>
                    {(form.allowed_cors_origins ?? []).map((origin, idx) => (
                        <div key={idx} className="flex mb-1">
                            <input
                                type="text"
                                value={origin}
                                onChange={e => handleOriginsChange(e, idx)}
                                className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-[#2d6880] focus:ring-2 focus:ring-[#92A7B4]/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                            />
                            <button type="button" onClick={() => removeOrigin(idx)} className="ml-2 rounded-md bg-red-50 px-2 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30">{t('Remove')}</button>
                        </div>
                    ))}
                    <button type="button" onClick={addOrigin} className="mt-1 text-sm font-medium text-[#2d6880] hover:text-[#1e5770] dark:text-[#92A7B4] dark:hover:text-[#c0d4dd]">{t('Add Origin')}</button>
                </div>
                <div>
                    <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{t('Allowed CORS Methods')}</label>
                    <input
                        type="text"
                        name="allowed_cors_methods"
                        value={form.allowed_cors_methods}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-[#2d6880] focus:ring-2 focus:ring-[#92A7B4]/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    />
                </div>
                <div>
                    <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{t('X-Frame-Options')}</label>
                    <input
                        type="text"
                        name="frame_options"
                        value={form.frame_options}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-[#2d6880] focus:ring-2 focus:ring-[#92A7B4]/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    />
                </div>
                <div>
                    <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{t('Referrer-Policy')}</label>
                    <input
                        type="text"
                        name="referrer_policy"
                        value={form.referrer_policy}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-[#2d6880] focus:ring-2 focus:ring-[#92A7B4]/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    />
                </div>
                <div>
                    <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{t('Strict-Transport-Security')}</label>
                    <input
                        type="text"
                        name="strict_transport_security"
                        value={form.strict_transport_security}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-[#2d6880] focus:ring-2 focus:ring-[#92A7B4]/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    />
                </div>
                <div>
                    <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{t('Content-Security-Policy')}</label>
                    <input
                        type="text"
                        name="content_security_policy"
                        value={form.content_security_policy}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-[#2d6880] focus:ring-2 focus:ring-[#92A7B4]/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    />
                </div>
                <div>
                    <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{t('X-Content-Type-Options')}</label>
                    <input
                        type="text"
                        name="x_content_type_options"
                        value={form.x_content_type_options}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-[#2d6880] focus:ring-2 focus:ring-[#92A7B4]/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    />
                </div>
                <div>
                    <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{t('X-XSS-Protection')}</label>
                    <input
                        type="text"
                        name="x_xss_protection"
                        value={form.x_xss_protection}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-[#2d6880] focus:ring-2 focus:ring-[#92A7B4]/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    />
                </div>
                <div>
                    <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">X-Robots-Tag</label>
                    <input
                        type="text"
                        name="x_robots_tag"
                        value={form.x_robots_tag}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-[#2d6880] focus:ring-2 focus:ring-[#92A7B4]/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    />
                </div>
                {mutation.isError && <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300">{(mutation.error as Error).message}</div>}
                {mutation.isSuccess && <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">{t('Settings updated!')}</div>}
                <button
                    type="submit"
                    className="w-full rounded-lg bg-[#2d6880] py-2.5 font-medium text-white transition hover:bg-[#1e5770] disabled:opacity-60"
                    disabled={mutation.status === 'pending'}
                >
                    {mutation.status === 'pending' ? t("Saving...") : t("Save Settings")}
                </button>
                <button
                    type="button"
                    className="w-full rounded-lg bg-slate-600 py-2.5 font-medium text-white transition hover:bg-slate-700 disabled:opacity-60 dark:bg-slate-700 dark:hover:bg-slate-600"
                    onClick={handleReset}
                    disabled={mutation.status === 'pending'}
                >
                    {t('Reset')}
                </button>
            </form>
        </div>
    );
}
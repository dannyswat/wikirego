import React, { useContext, useState } from "react";
import { createAdmin } from "./setupApi";
import { SettingContext } from "./SettingProvider";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

export default function CreateAdmin() {
    const { t } = useTranslation();
    const setting = useContext(SettingContext);
    const [form, setForm] = useState({
        user_name: "admin",
        email: "",
        password: "",
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
            await createAdmin(form);
            setSuccess(t('messages.adminCreated'));
            setForm({ user_name: "", email: "", password: "" });
            setting.updateAdminCreated();
        } catch (err: any) {
            setError(err.message || t('messages.adminCreationFailed'));
        } finally {
            setLoading(false);
        }
    };

    if (setting && setting.isAdminCreated) {
        return <Navigate to="/setup-site" replace />;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-[#eef4f7] dark:from-slate-950 dark:via-slate-900 dark:to-[#0f1d24]">
            <div className="mx-auto flex min-h-screen max-w-[1200px] items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
                <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:shadow-slate-950/30 sm:p-8">
                    <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">{t('Setup')}</p>
                    <h2 className="mb-5 mt-2 text-2xl font-semibold tracking-tight text-[#1e5770] dark:text-[#92A7B4]">{t('setup.createAdminAccount')}</h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{t('forms.username')}</label>
                            <input
                                type="text"
                                name="user_name"
                                value={form.user_name}
                                onChange={handleChange}
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-[#2d6880] focus:ring-2 focus:ring-[#92A7B4]/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                                required
                                minLength={3}
                                maxLength={50}
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{t('forms.email')}</label>
                            <input
                                type="email"
                                name="email"
                                value={form.email}
                                onChange={handleChange}
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-[#2d6880] focus:ring-2 focus:ring-[#92A7B4]/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                                required
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{t('forms.password')}</label>
                            <input
                                type="password"
                                name="password"
                                value={form.password}
                                onChange={handleChange}
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-[#2d6880] focus:ring-2 focus:ring-[#92A7B4]/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                                required
                                minLength={6}
                                maxLength={100}
                            />
                        </div>
                        {error && <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300">{error}</div>}
                        {success && <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">{success}</div>}
                        <button
                            type="submit"
                            className="w-full rounded-lg bg-[#2d6880] py-2.5 font-medium text-white transition hover:bg-[#1e5770] disabled:opacity-60"
                            disabled={loading}
                        >
                            {loading ? t('setup.creating') : t('setup.createAdmin')}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { changePasswordApi, ChangePasswordRequest, getPublicKeyApi } from "../auth/authApi";
import { useTheme } from "../../contexts/ThemeProvider";
import PassKeyConnect from "./PassKeyConnect";
import { useTranslation } from "react-i18next";

export default function ChangePasswordPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { theme } = useTheme();
    const [data, setData] = useState({
        oldPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [error, setError] = useState('');

    const { data: cpkey, isLoading: cpLoading } = useQuery({
        queryKey: ['public-key', 'changepassword'],
        queryFn: () => getPublicKeyApi('changepassword'),
    });
    const { data: authKey, isLoading: authLoading } = useQuery({
        queryKey: ['public-key', 'login'],
        queryFn: () => getPublicKeyApi('login'),
    });

    const changePassword = useMutation({
        mutationFn: (request: ChangePasswordRequest) => changePasswordApi(request),
        onSuccess: () => {
            navigate('/');
        }
    });
    const isLoading = cpLoading || authLoading;

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        setData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    }

    function handleSubmit() {
        if (!cpkey || !authKey) {
            setError(t('errors.publicKeyMissing'));
            return;
        }

        if (!data.oldPassword || !data.newPassword || !data.confirmPassword) {
            setError(t('errors.allFieldsRequired'));
            return;
        }
        if (data.newPassword !== data.confirmPassword) {
            setError(t('errors.passwordsDoNotMatch'));
            return;
        }
        changePassword.mutate({
            oldPassword: data.oldPassword,
            newPassword: data.newPassword,
            publicKey: cpkey.key,
            timestamp: cpkey.timestamp,
            newPublicKey: authKey.key
        });
        setError('');
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-[#eef4f7] text-slate-800 dark:from-slate-950 dark:via-slate-900 dark:to-[#0f1d24] dark:text-slate-200">
            <div className="mx-auto flex min-h-screen max-w-[1200px] items-center px-4 py-8 sm:px-6 lg:px-8">
                <div className="grid w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-900 dark:shadow-slate-950/40 lg:grid-cols-2">
                    <section className="relative hidden bg-[#1e5770] p-8 text-white lg:block">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.16),transparent_35%),radial-gradient(circle_at_85%_60%,rgba(146,167,180,0.35),transparent_45%)]" />
                        <div className="relative z-10">
                            <p className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs uppercase tracking-wider text-slate-100">
                                Security
                            </p>
                            <h1 className="mt-5 text-3xl font-semibold tracking-tight">
                                Protect your
                                <br />
                                Wiki Rego account.
                            </h1>
                            <p className="mt-4 max-w-sm text-sm text-slate-200/90">
                                Update your password regularly and manage passkeys for stronger authentication.
                            </p>
                        </div>
                    </section>

                    <section className="p-6 sm:p-8 lg:p-10">
                        <div className="mx-auto w-full max-w-md">
                            <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">Account settings</p>
                            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#1e5770] dark:text-[#92A7B4]">{t('Change Password')}</h2>

                            <div className="mt-6 space-y-4">
                                <input className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-slate-900 outline-none transition focus:border-[#2d6880] focus:ring-2 focus:ring-[#92A7B4]/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100" placeholder={t('Your password')} name="oldPassword" type="password" onChange={handleChange} />
                                <input className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-slate-900 outline-none transition focus:border-[#2d6880] focus:ring-2 focus:ring-[#92A7B4]/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100" placeholder={t('New Password')} name="newPassword" type="password" onChange={handleChange} />
                                <input className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-slate-900 outline-none transition focus:border-[#2d6880] focus:ring-2 focus:ring-[#92A7B4]/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100" placeholder={t('Confirm your new password')} name="confirmPassword" type="password" onChange={handleChange} />

                                <button disabled={isLoading} className="w-full rounded-lg bg-[#2d6880] p-2.5 font-medium text-white transition hover:bg-[#1e5770] disabled:opacity-70" onClick={handleSubmit}>{t('Change Password')}</button>

                                {error && (
                                    <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300">{error}</p>
                                )}
                            </div>

                            <PassKeyConnect className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-700" />

                            <button className="mt-5 w-full rounded-lg bg-slate-600 p-2.5 font-medium text-white transition hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600" onClick={() => navigate('/')}>{t('Back')}</button>

                            <p className="mt-5 text-center text-xs text-slate-500 dark:text-slate-400">
                                {theme === 'dark' ? 'Dark mode enabled' : 'Light mode enabled'}
                            </p>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
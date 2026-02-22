import { MouseEvent, useEffect, useState } from "react";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { queryClient } from "../../common/query";
import { IconFidgetSpinner } from "@tabler/icons-react";
import { getRolesApi, getUserApi, updateUserApi, UpdateUserRequest } from "./userApi";
import { useTranslation } from "react-i18next";

export default function UsersEdit() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { id } = useParams();
    const userId = parseInt(id || '');
    const [data, setData] = useState<UpdateUserRequest>({
        id: 0,
        username: '',
        email: '',
        newPassword: '',
        role: 'reader',
    });
    const { data: user } = useQuery({
        queryKey: ['user', userId],
        queryFn: async () => {
            return await getUserApi(userId);
        }
    })
    const { data: roles } = useQuery({
        queryKey: ['roles'],
        queryFn: getRolesApi,
    });
    const updateUser = useMutation({
        mutationFn: (data: UpdateUserRequest) => updateUserApi(data),
        onSuccess: () => {
            queryClient.removeQueries({ queryKey: ['users'] });
            navigate('/users');
        },
        onError: (err) => {
            alert(err.message);
        }
    });

    useEffect(() => {
        if (user) {
            setData({ ...user, newPassword: '' });
        }
    }, [user]);

    function handleSubmitClick(e: MouseEvent<HTMLButtonElement>) {
        e.preventDefault();
        updateUser.mutate(data);
    }
    if (!id) {
        navigate('/users');
        return null;
    }

    return <div className="w-full rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <h1 className="mb-5 text-2xl font-semibold tracking-tight text-[#1e5770] dark:text-[#92A7B4]">{t('Edit')} {data.username || t('User')}</h1>

        <div className="flex flex-col gap-4">
            <section className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <label className="text-sm text-slate-600 dark:text-slate-300 sm:basis-1/4">{t('Login Name')}</label>
                <input className="rounded-lg border border-slate-300 bg-white p-2.5 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 sm:basis-3/4" autoComplete="secret" type="text" value={data.username}
                    onChange={(e) => setData((prev) => ({ ...prev, username: e.target.value }))} />
            </section>
            <section className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <label className="text-sm text-slate-600 dark:text-slate-300 sm:basis-1/4">{t('Email')}</label>
                <input className="rounded-lg border border-slate-300 bg-white p-2.5 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 sm:basis-3/4" autoComplete="secret" type="text" value={data.email}
                    onChange={(e) => setData((prev) => ({ ...prev, email: e.target.value }))} />
            </section>
            <section className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <label className="text-sm text-slate-600 dark:text-slate-300 sm:basis-1/4">{t('New Password')}</label>
                <input className="rounded-lg border border-slate-300 bg-white p-2.5 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 sm:basis-3/4" autoComplete="secret" type="password" value={data.newPassword}
                    onChange={(e) => setData((prev) => ({ ...prev, newPassword: e.target.value }))} />
            </section>
            <section className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <label className="text-sm text-slate-600 dark:text-slate-300 sm:basis-1/4">{t('Role')}</label>
                <select className="rounded-lg border border-slate-300 bg-white p-2.5 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 sm:basis-3/4" value={data.role}
                    onChange={(e) => setData((prev) => ({ ...prev, role: e.target.value }))}>
                    {roles?.map((role) => <option key={role.role} value={role.role}>{t(role.name)}</option>)}
                </select>
            </section>
            <section className="mt-2 flex flex-row gap-3">
                <button disabled={updateUser.isPending} onClick={handleSubmitClick}
                    className="rounded-lg bg-[#2d6880] px-5 py-2.5 text-white hover:bg-[#1e5770] disabled:opacity-70">
                    {updateUser.isPending ? <IconFidgetSpinner className="mx-auto animate-spin" /> : t('Save')}
                </button>
                <button onClick={() => {
                    if (confirm(t('Are you sure to leave'))) {
                        navigate('/users')
                    }
                }} className="rounded-lg bg-slate-600 px-5 py-2.5 text-white hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600">{t('Cancel')}</button>
            </section>
        </div>
    </div>;
}
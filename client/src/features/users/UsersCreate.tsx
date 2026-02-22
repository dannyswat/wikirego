import { MouseEvent, useState } from "react";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { queryClient } from "../../common/query";
import { IconFidgetSpinner } from "@tabler/icons-react";
import { createUserApi, CreateUserRequest, getRolesApi } from "./userApi";
import { useTranslation } from "react-i18next";

export default function UsersCreate() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [data, setData] = useState<CreateUserRequest>({
        username: '',
        email: '',
        password: '',
        role: 'reader',
    });
    const { data: roles } = useQuery({
        queryKey: ['roles'],
        queryFn: getRolesApi,
    });
    const createUser = useMutation({
        mutationFn: (data: CreateUserRequest) => createUserApi(data),
        onSuccess: () => {
            queryClient.removeQueries({ queryKey: ['users'] });
            navigate('/users');
        },
        onError: (err) => {
            alert(err.message);
        }
    })

    function handleSubmitClick(e: MouseEvent<HTMLButtonElement>) {
        e.preventDefault();
        createUser.mutate(data);
    }

    return <div className="w-full rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <h1 className="mb-5 text-2xl font-semibold tracking-tight text-[#1e5770] dark:text-[#92A7B4]">{t('Add User')}</h1>

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
                <input className="rounded-lg border border-slate-300 bg-white p-2.5 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 sm:basis-3/4" autoComplete="secret" type="password" value={data.password}
                    onChange={(e) => setData((prev) => ({ ...prev, password: e.target.value }))} />
            </section>
            <section className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <label className="text-sm text-slate-600 dark:text-slate-300 sm:basis-1/4">{t('Role')}</label>
                <select className="rounded-lg border border-slate-300 bg-white p-2.5 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 sm:basis-3/4" value={data.role}
                    onChange={(e) => setData((prev) => ({ ...prev, role: e.target.value }))}>
                    {roles?.map((role) => <option key={role.role} value={role.role}>{t(role.name)}</option>)}
                </select>
            </section>
            <section className="mt-2 flex flex-row gap-3">
                <button disabled={createUser.isPending} onClick={handleSubmitClick}
                    className="rounded-lg bg-[#2d6880] px-5 py-2.5 text-white hover:bg-[#1e5770] disabled:opacity-70">
                    {createUser.isPending ? <IconFidgetSpinner className="mx-auto animate-spin" /> : t('Create')}
                </button>
                <button onClick={() => {
                    if (!data.username || confirm(t('Are you sure to leave')))
                        navigate('/users')
                }} className="rounded-lg bg-slate-600 px-5 py-2.5 text-white hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600">
                    {t('Cancel')}
                </button>
            </section>
        </div>
    </div>;
}
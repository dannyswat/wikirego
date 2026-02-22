import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { getUsersApi } from "./userApi";
import { IconLock } from "@tabler/icons-react";
import { NavLink } from "react-router-dom";

export default function Users() {
    const { t } = useTranslation();
    const { data: users, isLoading, isError } = useQuery({
        queryKey: ['users'],
        queryFn: async () => {
            return await getUsersApi();
        }
    });

    if (isLoading) return <div>{t("Loading")}</div>;
    if (isError) return <div>{t("Error loading users")}</div>;

    return <div className="w-full rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
            <h1 className="text-2xl font-semibold tracking-tight text-[#1e5770] dark:text-[#92A7B4]">{t("Users")}</h1>
            <NavLink to="/users/create" className="rounded-lg bg-[#2d6880] px-4 py-2 text-sm font-medium text-white hover:bg-[#1e5770]">{t("Add User")}</NavLink>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="min-w-full border-collapse">
                <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50">
                        <th className="border-b border-slate-200 px-4 py-2 text-left text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200">{t("Username")}</th>
                        <th className="hidden border-b border-slate-200 px-4 py-2 text-left text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200 sm:table-cell">{t("Email")}</th>
                        <th className="border-b border-slate-200 px-4 py-2 text-left text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200">{t("Role")}</th>
                        <th className="border-b border-slate-200 px-4 py-2 text-center text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200">{t("Status")}</th>
                        <th className="border-b border-slate-200 px-4 py-2 text-center text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"></th>
                    </tr>
                </thead>
                <tbody>
                    {users?.map((user) => (
                        <tr key={user.id} className="odd:bg-white even:bg-slate-50/70 dark:odd:bg-slate-900 dark:even:bg-slate-800/40">
                            <td className="border-b border-slate-200 px-4 py-2 text-sm dark:border-slate-700">{user.username}</td>
                            <td className="hidden border-b border-slate-200 px-4 py-2 text-sm dark:border-slate-700 sm:table-cell">{user.email}</td>
                            <td className="border-b border-slate-200 px-4 py-2 text-sm dark:border-slate-700">{user.role}</td>
                            <td className="border-b border-slate-200 px-4 py-2 text-center dark:border-slate-700">{user.isLockedOut && <IconLock size={18} className="mx-auto text-amber-500" />}</td>
                            <td className="border-b border-slate-200 px-4 py-2 text-center text-sm dark:border-slate-700">
                                <NavLink to={`/users/${user.id}`} className="font-medium text-[#2d6880] hover:text-[#1e5770] dark:text-[#92A7B4] dark:hover:text-[#c0d4dd]">{t("Edit")}</NavLink>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
}
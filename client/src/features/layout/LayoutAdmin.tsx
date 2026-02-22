import { useState } from 'react';
import SideNav from './SideNav';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { IconClearAll, IconMenu2 } from '@tabler/icons-react';
import { Footer } from './Footer';
import { SettingMenu } from './SettingMenu';
import SiteLogo from '../../components/SiteLogo';
import { useTheme } from '../../contexts/ThemeProvider';

export default function LayoutAdmin() {
    const navigate = useNavigate();
    const { theme } = useTheme();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    function navigateTo(path: string) {
        setIsMenuOpen(false);
        navigate(path);
    }

    return (
        <div className="flex min-h-screen flex-col bg-slate-100 text-slate-800 dark:bg-slate-950 dark:text-slate-200">
            <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
                <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center gap-2">
                        <button
                            className="rounded-md p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden"
                            onClick={() => setIsMenuOpen((p) => !p)}
                        >
                            <IconMenu2 size={22} />
                        </button>
                        <NavLink className="inline-flex" to="/">
                            <SiteLogo isLight={theme === 'light'} />
                        </NavLink>
                    </div>
                    <div className="space-x-4 text-right">
                        <SettingMenu />
                    </div>
                </div>
            </header>

            <div className="mx-auto flex w-full max-w-[1600px] flex-1 px-4 sm:px-6 lg:px-8">
                <div
                    className={`${isMenuOpen ? 'block' : 'hidden'} fixed inset-0 z-20 bg-black/50 dark:bg-black/70 lg:hidden`}
                    onClick={() => setIsMenuOpen(false)}
                ></div>

                <div className="grid w-full grid-cols-1 gap-4 py-4 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-6 lg:py-6">
                    <SideNav
                        navigate={navigateTo}
                        className={`fixed inset-y-0 left-0 z-30 w-[85%] max-w-sm rounded-r-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 ${isMenuOpen ? 'block' : 'hidden'} lg:sticky lg:top-24 lg:block lg:h-[calc(100vh-7rem)] lg:w-auto lg:max-w-none lg:rounded-xl`}
                        headerComponent={<button className="absolute right-4 top-4 rounded-md p-1 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden" onClick={() => setIsMenuOpen(false)}><IconClearAll height={22} /></button>}
                    />

                    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
                        <Outlet />
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    );
}
import { ReactNode, useContext } from 'react';
import { Outlet } from 'react-router-dom';
import { IconSettings } from '@tabler/icons-react';

import { UserContext } from '../auth/UserProvider';
import { Footer } from './Footer';
import SiteLogo from '../../components/SiteLogo';
import { useTheme } from '../../contexts/ThemeProvider';

interface LayoutProps {
    customMenu?: ReactNode;
}

export default function LayoutEdit({ customMenu }: LayoutProps) {
    const { isLoggedIn } = useContext(UserContext);
        const { theme } = useTheme();
    

    return (
        <div className="flex min-h-screen flex-col bg-slate-100 text-slate-800 dark:bg-slate-950 dark:text-slate-200">
            <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
                <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
                    <div className="inline-flex">
                        <SiteLogo isLight={theme === 'light'} />
                    </div>
                    <div className="space-x-4 text-right text-slate-600 dark:text-slate-300">
                        {isLoggedIn && (customMenu ?? <IconSettings size={22} className="inline" />)}
                    </div>
                </div>
            </header>

            <div className="mx-auto box-border w-full max-w-[1600px] flex-1 px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
                <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
                    <Outlet />
                </div>
            </div>

            <Footer />
        </div>
    );
}
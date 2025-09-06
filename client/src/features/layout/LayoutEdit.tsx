import { ReactNode, useContext } from 'react';
import { Outlet } from 'react-router-dom';
import { IconSettings } from '@tabler/icons-react';

import { UserContext } from '../auth/UserProvider';
import { Footer } from './Footer';
import SiteLogo from '../../components/SiteLogo';

interface LayoutProps {
    customMenu?: ReactNode;
}

export default function LayoutEdit({ customMenu }: LayoutProps) {
    const { isLoggedIn } = useContext(UserContext);

    return (
        <div className="flex flex-col min-h-screen bg-white dark:bg-gray-900">
            <header className="flex justify-between items-center p-2 bg-[#332F2F] text-white">
                <div className="text-xl font-bold">
                    <SiteLogo />
                </div>
                <div className="space-x-4 text-right">
                    {isLoggedIn && (customMenu ?? <IconSettings size={24} className="inline" />)}
                </div>
            </header>
            <div className="flex-1 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
                <div className="box-border p-4">
                    <Outlet />
                </div>
            </div>
            <Footer />
        </div>
    );
}
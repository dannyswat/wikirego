import { useState } from 'react';
import SideNav from './SideNav';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { IconClearAll, IconMenu2 } from '@tabler/icons-react';
import { Footer } from './Footer';
import { SettingMenu } from './SettingMenu';
import SiteLogo from '../../components/SiteLogo';

export default function LayoutAdmin() {
    const navigate = useNavigate();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    function navigateTo(path: string) {
        setIsMenuOpen(false);
        navigate(path);
    }

    return (
        <div className="flex flex-col min-h-screen bg-white dark:bg-gray-900">
            <header className="flex justify-between items-center p-2 bg-[#332F2F] text-white">
                <div className="text-xl font-bold">
                    <button className="p-2 sm:hidden" onClick={() => setIsMenuOpen((p) => !p)}>
                        <IconMenu2 className="hover:text-gray-200 dark:hover:text-gray-300" size={24} />
                    </button>
                    <NavLink className="hidden sm:inline" to="/">
                        <SiteLogo />
                    </NavLink>
                </div>
                <div className="space-x-4 text-right">
                    <SettingMenu />
                </div>
            </header>
            <div className="flex flex-1">
                <div className={`${isMenuOpen ? 'block' : 'hidden'} sm:hidden fixed inset-0 bg-black dark:bg-black bg-opacity-50 dark:bg-opacity-70 z-10`} onClick={() => setIsMenuOpen(false)}></div>
                <SideNav
                    navigate={navigateTo}
                    className={`fixed inset-0 w-full ${isMenuOpen ? 'block' : 'hidden'} sm:block sm:relative sm:w-1/4 z-20`}
                    headerComponent={<button className="absolute right-4 top-4 sm:hidden hover:text-gray-700 dark:hover:text-gray-300" onClick={() => setIsMenuOpen(false)}><IconClearAll height={24} /></button>}
                />
                <div className="flex-1 p-4 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
                    <Outlet />
                </div>
            </div>
            <Footer />
        </div>
    );
}
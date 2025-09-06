import { createContext, ReactNode, useEffect, useState } from "react";
import { getSetting, Setting } from "./setupApi";
import Loading from "../layout/Loading";
import { useTranslation } from "react-i18next";

interface SettingContextValues {
    setting: Setting | undefined;
    isAdminCreated?: boolean;
    updateSetting: (value: Setting) => void;
    updateAdminCreated: () => void;
}

export const SettingContext = createContext<SettingContextValues>({ updateSetting: () => { }, setting: undefined, updateAdminCreated: () => { } });

interface SettingProviderProps {
    children: ReactNode;
    setup: ReactNode;
}

export default function SettingProvider({ children, setup }: SettingProviderProps) {
    const { i18n } = useTranslation();
    const [setting, setSetting] = useState(getSettingFromLocalStorage);
    const [isAdminCreated, setIsAdminCreated] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!isLoading) return;
        getSetting().then((res) => {
            if (res.is_admin_created && res.is_setup_complete) {
                updateSetting(res.setting);
                document.title = res.setting.site_name || "wiki rego";
                document.documentElement.lang = res.setting.language || "en";
                i18n.changeLanguage(res.setting.language || "en");

            } else {
                setIsAdminCreated(res.is_admin_created);
                setSetting(undefined);
            }
            setIsLoading(false);
        })
    }, []);

    function updateSetting(value: Setting) {
        localStorage.setItem('wikicfg', JSON.stringify(value));
        setSetting(value);
    }

    function updateAdminCreated() {
        setIsAdminCreated(true);
    }

    if (isLoading) return <Loading />;

    return <SettingContext.Provider value={{ setting, updateSetting, isAdminCreated, updateAdminCreated }}>{!!setting ? children : setup}</SettingContext.Provider>
}

function getSettingFromLocalStorage(): Setting | undefined {
    const wikicfg = localStorage.getItem('wikicfg');
    if (!wikicfg) return undefined;

    return JSON.parse(wikicfg);
}
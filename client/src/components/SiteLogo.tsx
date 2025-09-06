import { useContext } from "react";
import { SettingContext } from "../features/setup/SettingProvider";

const DEFAULT_LOGO_URL = "/wiki-rego-dark.svg";
const DEFAULT_SITE_NAME = "wiki rego";

export default function SiteLogo() {
    const { setting } = useContext(SettingContext);
    return <img src={setting?.logo || DEFAULT_LOGO_URL} alt={setting?.site_name || DEFAULT_SITE_NAME} className="h-10" />;
}
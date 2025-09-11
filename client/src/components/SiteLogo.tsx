import { useContext } from "react";
import { SettingContext } from "../features/setup/SettingProvider";

const DEFAULT_LOGO_URL = "/wiki-rego-dark.svg";
const DEFAULT_LIGHT_LOGO_URL = "/wiki-rego.svg";
const DEFAULT_SITE_NAME = "wiki rego";

interface SiteLogoProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    isLight?: boolean;
}

export default function SiteLogo({ isLight, className, ...props }: SiteLogoProps) {
    const { setting } = useContext(SettingContext);
    return <img src={setting?.logo || (isLight ? DEFAULT_LIGHT_LOGO_URL : DEFAULT_LOGO_URL)} alt={setting?.site_name || DEFAULT_SITE_NAME} className={`h-10 ${className}`} {...props} />;
}
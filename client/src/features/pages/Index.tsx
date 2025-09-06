import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { getPageByUrl } from "./pageApi";
import { useEffect } from "react";

export default function Index() {
    const { t } = useTranslation();
    const pageId = 'home';
    const { data, isLoading, isError } = useQuery({ queryKey: ['page', pageId], queryFn: () => getPageByUrl(pageId) });

    useEffect(() => {
        if (data?.title)
            document.title = data.title + ' - wiki rego';
    }, [data?.title]);

    if (isLoading) return <div>{t("Loading")}</div>;
    if (isError) return <div>{t("Error loading page")}</div>;
    return <div className="ck-content" dangerouslySetInnerHTML={{ __html: data || '' }}></div>;
}
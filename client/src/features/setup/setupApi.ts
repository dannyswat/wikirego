import { baseApiUrl } from "../../common/baseApi";

export interface Setting {
    site_name: string;
    logo: string;
    theme: string;
    footer: string;
    language: string;
    is_site_protected: boolean;
    enable_collaboration: boolean;
}

interface SettingResponse {
    is_setup_complete: boolean;
    is_admin_created: boolean;
    setting: Setting;
}

export async function getSetting(): Promise<SettingResponse> {
    const response = await fetch(`${baseApiUrl}/setup/setting`);
    if (!response.ok) {
        throw new Error(`Error fetching settings: ${response.statusText}`);
    }
    return response.json();
}

export async function createAdmin(data: { user_name: string; email: string; password: string }): Promise<{ message: string }> {
    const response = await fetch(`${baseApiUrl}/setup/admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        throw new Error(`Error creating admin: ${response.statusText}`);
    }
    return response.json();
}

export async function createSetting(data: Setting): Promise<{ message: string }> {
    const response = await fetch(`${baseApiUrl}/setup/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        throw new Error(`Error creating setting: ${response.statusText}`);
    }
    return response.json();
}

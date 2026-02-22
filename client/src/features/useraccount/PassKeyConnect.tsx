import { useMutation, useQuery } from "@tanstack/react-query";
import { useContext, useState } from "react";
import { UserContext } from "../auth/UserProvider";
import { beginPasskeyRegistration, finishPasskeyRegistration, getUserPasskeyDevices, deletePasskeyDevice } from "../auth/fido2Api";
import { base64urlToBuffer } from "../../common/base64";
import { useTranslation } from "react-i18next";

interface PassKeyConnectProps {
    className?: string;
}

export default function PassKeyConnect({ className }: PassKeyConnectProps) {
    const { t } = useTranslation();
    const { username } = useContext(UserContext);
    const [deviceName, setDeviceName] = useState('');

    const { data: devices, refetch: refetchDevices } = useQuery({
        queryKey: ['user-passkey-devices', username],
        queryFn: getUserPasskeyDevices,
        refetchOnWindowFocus: false,
    });

    const registerPasskey = useMutation({
        mutationFn: async () => {
            if (!deviceName.trim()) {
                throw new Error(t("Please enter a device name"));
            }

            const { options, sessionKey } = await beginPasskeyRegistration(deviceName.trim());
            const key = options.publicKey || options;

            // Ensure the response has the expected structure
            if (!key || !key.challenge || !key.user || !key.user.id) {
                console.error('Invalid options structure:', key);
                throw new Error(t("Invalid registration options received from server"));
            }

            // Convert base64url strings to ArrayBuffers for the browser API
            const credentialCreationOptions: CredentialCreationOptions = {
                publicKey: {
                    ...key,
                    challenge: base64urlToBuffer(key.challenge),
                    user: {
                        ...key.user,
                        id: base64urlToBuffer(key.user.id)
                    },
                    // Handle excludeCredentials if present
                    excludeCredentials: key.excludeCredentials?.map((cred: any) => ({
                        ...cred,
                        id: base64urlToBuffer(cred.id)
                    }))
                }
            };

            const credential = await navigator.credentials.create(credentialCreationOptions) as PublicKeyCredential;
            if (!credential) {
                throw new Error(t("No credential received"));
            }

            await finishPasskeyRegistration(credential, deviceName.trim(), sessionKey);
        },
        onSuccess: () => {
            setDeviceName('');
            refetchDevices();
        }
    });

    const deleteDevice = useMutation({
        mutationFn: (deviceId: string) => deletePasskeyDevice(deviceId),
        onSuccess: () => {
            refetchDevices();
        }
    });

    // Helper function to convert base64url to ArrayBuffer

    return (
        <div className={className}>
            <h2 className="mb-4 text-lg font-semibold tracking-tight text-[#1e5770] dark:text-[#92A7B4]">{t('PassKey Management')}</h2>

            <div className="mb-4">
                <input
                    className="mb-2 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-slate-900 outline-none transition focus:border-[#2d6880] focus:ring-2 focus:ring-[#92A7B4]/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    placeholder={t('Device name')}
                    value={deviceName}
                    onChange={(e) => setDeviceName(e.target.value)}
                />
                <button
                    className="w-full rounded-lg bg-emerald-600 p-2.5 font-medium text-white transition hover:bg-emerald-700 disabled:opacity-70"
                    onClick={() => registerPasskey.mutate()}
                    disabled={registerPasskey.isPending || !deviceName.trim()}
                >
                    {registerPasskey.isPending ? t("Registering...") : t("Connect with PassKey")}
                </button>
            </div>

            {devices && devices.length > 0 && (
                <div className="mb-4">
                    <h3 className="mb-2 text-sm font-medium text-slate-600 dark:text-slate-300">{t('Your PassKeys')}:</h3>
                    {devices.map((device) => (
                        <div key={device.id} className="mb-2 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-800/40">
                            <div>
                                <div className="font-medium text-slate-800 dark:text-slate-100">{device.name}</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                    {t('Added')}: {new Date(device.createdAt).toLocaleDateString()}
                                    {device.lastUsedAt && ` • ${t('Last used')}: ${new Date(device.lastUsedAt).toLocaleDateString()}`}
                                </div>
                            </div>
                            <button
                                className="rounded-md bg-red-600 px-2.5 py-1 text-xs text-white transition hover:bg-red-700"
                                onClick={() => deleteDevice.mutate(device.id)}
                                disabled={deleteDevice.isPending}
                            >
                                {t('Delete')}
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {(registerPasskey.error || deleteDevice.error) && (
                <p className="mt-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300">{registerPasskey.error?.message || deleteDevice.error?.message}</p>
            )}
        </div>
    );
}

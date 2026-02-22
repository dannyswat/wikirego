import { useMutation, useQuery } from "@tanstack/react-query";
import { MouseEvent, useContext, useState } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getPublicKeyApi, loginApi, LoginRequest } from "./authApi";
import { beginPasskeyLogin, finishPasskeyLogin } from "./fido2Api";
import { UserContext } from "./UserProvider";
import { useTheme } from "../../contexts/ThemeProvider";

export default function LoginPage() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { isLoggedIn } = useContext(UserContext);
  const urlParams = new URLSearchParams(window.location.search);
  const returnUrl = urlParams.get("returnUrl");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const keyQuery = useQuery({
    queryKey: ["publicKey"],
    queryFn: async () => await getPublicKeyApi("login"),
  });
  const login = useMutation({
    mutationFn: async (request: LoginRequest) => await loginApi(request),
    onSuccess: () => {
      window.location.href = returnUrl || "/";
    }
  });

  const passkeyLogin = useMutation({
    mutationFn: async () => {
      const { options, sessionKey } = await beginPasskeyLogin();

      // Extract the publicKey options from the response (handle both formats)
      const requestOptions = options.publicKey || options;

      // Convert base64url strings back to ArrayBuffers for the browser API
      const credentialRequestOptions: CredentialRequestOptions = {
        publicKey: {
          ...requestOptions,
          challenge: base64urlToBuffer(requestOptions.challenge as any),
          allowCredentials: requestOptions.allowCredentials?.map((cred: any) => ({
            ...cred,
            id: base64urlToBuffer(cred.id as any)
          }))
        }
      };

      const credential = await navigator.credentials.get(credentialRequestOptions) as PublicKeyCredential;
      if (!credential) {
        throw new Error("No credential received");
      }

      return await finishPasskeyLogin(credential, sessionKey);
    },
    onSuccess: () => {
      window.location.href = returnUrl || "/";
    }
  });

  // Helper function to convert base64url to ArrayBuffer
  function base64urlToBuffer(base64url: string): ArrayBuffer {
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const padding = base64.length % 4;
    const padded = base64 + '='.repeat(padding === 0 ? 0 : 4 - padding);
    const binary = atob(padded);
    const buffer = new ArrayBuffer(binary.length);
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return buffer;
  }

  if (isLoggedIn) {
    return <Navigate to={returnUrl ?? "/"} />;
  }

  function handleLoginClick(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    login.mutate({
      username,
      password,
      publicKey: keyQuery.data?.key || "",
      timestamp: keyQuery.data?.timestamp || "",
    });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-[#eef4f7] text-slate-800 dark:from-slate-950 dark:via-slate-900 dark:to-[#0f1d24] dark:text-slate-200">
      <div className="mx-auto flex min-h-screen max-w-[1200px] items-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-900 dark:shadow-slate-950/40 lg:grid-cols-2">
          <section className="relative hidden bg-[#1e5770] p-8 text-white lg:block">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.16),transparent_35%),radial-gradient(circle_at_85%_60%,rgba(146,167,180,0.35),transparent_45%)]" />
            <div className="relative z-10">
              <p className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs uppercase tracking-wider text-slate-100">
                Wiki Rego
              </p>
              <h1 className="mt-5 text-3xl font-semibold tracking-tight">
                Team knowledge,
                <br />
                always in sync.
              </h1>
              <p className="mt-4 max-w-sm text-sm text-slate-200/90">
                Organize documentation, architecture notes, and internal playbooks in one secure space.
              </p>
              <ul className="mt-8 space-y-3 text-sm text-slate-100/90">
                <li className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-[#92A7B4]" />
                  Structured pages with nested navigation
                </li>
                <li className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-[#92A7B4]" />
                  Rich editing and revision history
                </li>
                <li className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-[#92A7B4]" />
                  Password and passkey authentication
                </li>
              </ul>
            </div>
          </section>

          <section className="p-6 sm:p-8 lg:p-10">
            <div className="mx-auto w-full max-w-md">
              <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">Welcome back</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#1e5770] dark:text-[#92A7B4]">{t("Login")}</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Sign in to continue to your workspace.</p>

              <div className="mt-6 space-y-4">
                <input
                  type="text"
                  placeholder={t("Username")}
                  className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-slate-900 outline-none transition focus:border-[#2d6880] focus:ring-2 focus:ring-[#92A7B4]/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
                <input
                  type="password"
                  placeholder={t("Password")}
                  className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-slate-900 outline-none transition focus:border-[#2d6880] focus:ring-2 focus:ring-[#92A7B4]/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />

                <button
                  className="w-full rounded-lg bg-[#2d6880] p-2.5 font-medium text-white transition hover:bg-[#1e5770]"
                  onClick={handleLoginClick}
                >
                  {t("Login")}
                </button>

                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                  <span className="text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500">{t("or")}</span>
                  <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                </div>

                <button
                  className="w-full rounded-lg bg-emerald-600 p-2.5 font-medium text-white transition hover:bg-emerald-700 disabled:opacity-70"
                  onClick={() => passkeyLogin.mutate()}
                  disabled={passkeyLogin.isPending}
                >
                  {passkeyLogin.isPending ? t("Authenticating") : t("Login with PassKey")}
                </button>

                {(login.error || passkeyLogin.error) && (
                  <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300">
                    {login.error?.message || passkeyLogin.error?.message}
                  </div>
                )}
              </div>

              <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
                {theme === 'dark' ? 'Dark mode enabled' : 'Light mode enabled'}
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

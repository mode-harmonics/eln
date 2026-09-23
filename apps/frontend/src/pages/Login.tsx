import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "../components/Button";
import { Logo } from "../components/Logo";
import { api, ApiError } from "../lib/api";
import { Surface } from "../components/Surface";

export function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const doLogin = async (user: string, pass: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.post<any>("/api/v1/auth/login", { username: user, password: pass });
      localStorage.setItem("token", data.accessToken);
      localStorage.setItem("auth", "true");
      if (data.permissionList) {
        localStorage.setItem("permissionList", JSON.stringify(data.permissionList));
      } else {
        localStorage.removeItem("permissionList");
      }
      if (data.user?.id) {
        localStorage.setItem("currentUserId", data.user.id);
      }
      window.dispatchEvent(new Event("permissionsChanged"));
      navigate("/projects");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.status === 401 ? t("invalid_credentials") : err.message);
      } else {
        setError(t("network_error"));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError(t("enter_credentials"));
      return;
    }
    await doLogin(username, password);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-subtle px-4">
      <Surface variant="outlined" padding="lg" className="w-full max-w-md sm:p-10">
        <div className="text-center mb-8 flex flex-col items-center">
           <Logo className="text-2xl mb-6 justify-center" />
          <h2 className="text-2xl font-bold text-gray-900">
            {t("app_title")}
          </h2>
        </div>
        <form className="space-y-5" onSubmit={handleLogin}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="username">
                {t("username")}
              </label>
              <input
                id="username"
                type="text"
                required
                className="block w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus/30 sm:text-sm"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="password">
                {t("password")}
              </label>
              <input
                id="password"
                type="password"
                required
                className="block w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus/30 sm:text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
          )}

          <div className="pt-2">
            <Button
              type="submit"
              loading={loading}
              className="w-full justify-center py-2.5"
            >
              {t("sign_in")}
            </Button>
          </div>
        </form>

      </Surface>
    </div>
  );
}

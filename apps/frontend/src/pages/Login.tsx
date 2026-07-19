import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/Button";
import { Logo } from "../components/Logo";
import { api, ApiError } from "../lib/api";

export function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("请输入用户名和密码");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api.post<any>("/api/v1/auth/login", { username, password });
      localStorage.setItem("token", data.accessToken);
      localStorage.setItem("auth", "true");
      if (data.permissionList) {
        localStorage.setItem("permissionList", JSON.stringify(data.permissionList));
      } else {
        localStorage.removeItem("permissionList");
      }
      window.dispatchEvent(new Event("permissionsChanged"));
      navigate("/projects");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.status === 401 ? "用户名或密码不正确" : err.message);
      } else {
        setError("网络错误，请稍后重试");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f8fa] px-4">
      <div className="w-full max-w-md bg-white p-10 border border-gray-200 rounded shadow-sm">
        <div className="text-center mb-8 flex flex-col items-center">
           <Logo className="text-2xl mb-6 justify-center" />
          <h2 className="text-2xl font-bold text-gray-900">
            Electronic Lab Notebook
          </h2>
        </div>
        <form className="space-y-5" onSubmit={handleLogin}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="username">
                Username
              </label>
              <input
                id="username"
                type="text"
                required
                className="block w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-[#1d74f5] focus:outline-none focus:ring-1 focus:ring-[#1d74f5] sm:text-sm"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                className="block w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-[#1d74f5] focus:outline-none focus:ring-1 focus:ring-[#1d74f5] sm:text-sm"
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
              Login
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

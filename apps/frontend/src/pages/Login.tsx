import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../lib/api";

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("pi@eln.local");
  const [password, setPassword] = useState("Password123!");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await api.post<{ accessToken: string }>("/api/v1/auth/login", { email, password });
      localStorage.setItem("token", data.accessToken);
      localStorage.setItem("auth", "true");
      navigate("/projects");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.status === 401 ? "邮箱或密码不正确" : err.message);
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
           <div className="flex items-center gap-2 mb-6">
              <span className="text-red-500 font-bold text-2xl tracking-tight flex items-center gap-1">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M12 2C6.477 2 2 6.477 2 12c0 1.764.455 3.423 1.252 4.88L2 22l5.12-1.252A9.957 9.957 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm-1 13h-2v-2h2v2zm0-4h-2V7h2v4zm4 4h-2v-2h2v2zm0-4h-2V7h2v4z"/></svg>
                eln.chat
              </span>
           </div>
          <h2 className="text-2xl font-bold text-gray-900">
            Sign in to your workspace
          </h2>
        </div>
        <form className="space-y-5" onSubmit={handleLogin}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                className="block w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-[#1d74f5] focus:outline-none focus:ring-1 focus:ring-[#1d74f5] sm:text-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
            <button
              type="submit"
              disabled={loading}
              className="flex w-full justify-center rounded bg-[#1d74f5] px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-[#1d74f5] focus:ring-offset-2 disabled:opacity-70 transition-colors"
            >
              {loading ? "登录中..." : "Login"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { User, Mail, Shield, Key, Loader2, Eye, EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../components/Button";
import { api, ApiError } from "../lib/api";
import { toast } from "../components/Toast";

export function Profile() {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Password change state
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changing, setChanging] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get<any>("/api/v1/users/me")
      .then((data) => { if (!cancelled) setProfile(data); })
      .catch((err) => { if (!cancelled) setError(err instanceof ApiError ? err.message : "加载个人资料失败"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword || !newPassword || !confirmPassword) {
      toast.error("请填写所有密码字段");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("两次输入的新密码不一致");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("新密码至少 6 位");
      return;
    }
    setChanging(true);
    try {
      await api.put("/api/v1/users/me/password", { oldPassword, newPassword });
      toast.success("密码修改成功");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "密码修改失败");
    } finally {
      setChanging(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !profile) {
    return <div className="p-8 text-center text-sm text-red-500">{error || "加载失败"}</div>;
  }

  const initial = profile.fullName ? profile.fullName.charAt(0).toUpperCase() : "U";

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">{t("my_profile")}</h1>

      <div className="bg-white rounded border border-gray-200 overflow-hidden">
        <div className="p-8 flex flex-col md:flex-row gap-8 items-start">
          <div className="flex flex-col items-center gap-4">
            <div className="w-24 h-24 bg-[#f27429] rounded-full flex items-center justify-center text-white text-4xl font-bold shadow-sm">
              {initial}
            </div>
          </div>

          <div className="flex-1 space-y-6 w-full">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded text-gray-900 text-sm">
                  <User className="w-4 h-4 text-gray-400" />
                  {profile.fullName}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded text-gray-900 text-sm">
                  <Mail className="w-4 h-4 text-gray-400" />
                  {profile.email}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded text-gray-900 text-sm">
                  <Shield className="w-4 h-4 text-gray-400" />
                  {profile.roleName || "No Role"}
                </div>
              </div>
            </div>

            {/* Change Password */}
            <div className="pt-6 border-t border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Key className="w-4 h-4" />
                修改密码
              </h3>
              <form onSubmit={handleChangePassword} className="max-w-sm space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">当前密码</label>
                  <div className="relative">
                    <input
                      type={showOld ? "text" : "password"}
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      className="block w-full rounded border border-gray-300 px-3 py-2 pr-10 text-sm text-gray-900 focus:border-[#1d74f5] focus:outline-none"
                      placeholder="输入当前密码"
                    />
                    <button type="button" onClick={() => setShowOld(!showOld)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showOld ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">新密码</label>
                  <div className="relative">
                    <input
                      type={showNew ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="block w-full rounded border border-gray-300 px-3 py-2 pr-10 text-sm text-gray-900 focus:border-[#1d74f5] focus:outline-none"
                      placeholder="至少 6 位"
                    />
                    <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">确认新密码</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="block w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-[#1d74f5] focus:outline-none"
                    placeholder="再次输入新密码"
                  />
                </div>
                <Button type="submit" loading={changing} size="sm">
                  修改密码
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

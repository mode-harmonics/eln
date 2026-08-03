import React, { useEffect, useState } from "react";
import { User, Mail, Shield, Key, Loader2, Eye, EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../components/Button";
import { api, ApiError } from "../lib/api";
import { toast } from "../components/Toast";
import { PageHeader } from "../components/PageHeader";
import { Surface } from "../components/Surface";

// Maps backend RoleName enum values to i18n keys (see i18n.ts *_role).
const ROLE_KEYS: Record<string, string> = {
  Owner: "owner_role",
  Admin: "admin_role",
  Editor: "editor_role",
  Viewer: "viewer_role",
};

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
      .catch((err) => { if (!cancelled) setError(err instanceof ApiError ? err.message : t("load_failed")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword || !newPassword || !confirmPassword) {
      toast.error(t("password_fields_required"));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t("password_mismatch"));
      return;
    }
    if (newPassword.length < 6) {
      toast.error(t("password_too_short"));
      return;
    }
    setChanging(true);
    try {
      await api.put("/api/v1/users/me/password", { oldPassword, newPassword });
      toast.success(t("password_changed"));
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("change_failed"));
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
    return <div className="p-8 text-center text-sm text-red-500">{error || t("load_failed")}</div>;
  }

  const initial = profile.fullName ? profile.fullName.charAt(0).toUpperCase() : "U";
  const roleKey = ROLE_KEYS[profile.roleName];

  return (
    <div className="space-y-6">
      <PageHeader title={t("my_profile")} />

      <Surface variant="outlined" className="overflow-hidden">
        <div className="p-8 flex flex-col md:flex-row gap-8 items-start">
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-action text-4xl font-bold text-white">
              {initial}
            </div>
          </div>

          <div className="flex-1 space-y-6 w-full">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("profile_full_name")}</label>
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded text-gray-900 text-sm">
                  <User className="w-4 h-4 text-gray-400" />
                  {profile.fullName}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("profile_email")}</label>
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded text-gray-900 text-sm">
                  <Mail className="w-4 h-4 text-gray-400" />
                  {profile.email}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("profile_role")}</label>
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded text-gray-900 text-sm">
                  <Shield className="w-4 h-4 text-gray-400" />
                  {roleKey ? t(roleKey) : profile.roleName || t("profile_no_role")}
                </div>
              </div>
            </div>

            {/* Change Password */}
            <div className="pt-6 border-t border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Key className="w-4 h-4" />
                {t("change_password")}
              </h3>
              <form onSubmit={handleChangePassword} className="max-w-sm space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t("current_password")}</label>
                  <div className="relative">
                    <input
                      type={showOld ? "text" : "password"}
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      className="block w-full rounded border border-gray-300 px-3 py-2 pr-10 text-sm text-gray-900 focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus/30"
                      placeholder={t("current_password_placeholder")}
                    />
                    <button type="button" onClick={() => setShowOld(!showOld)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showOld ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t("new_password")}</label>
                  <div className="relative">
                    <input
                      type={showNew ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="block w-full rounded border border-gray-300 px-3 py-2 pr-10 text-sm text-gray-900 focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus/30"
                      placeholder={t("new_password_hint")}
                    />
                    <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t("confirm_new_password")}</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="block w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus/30"
                    placeholder={t("confirm_new_password_placeholder")}
                  />
                </div>
                <Button type="submit" loading={changing} size="sm">
                  {t("change_password")}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </Surface>
    </div>
  );
}

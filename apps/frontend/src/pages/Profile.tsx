import React, { useEffect, useState } from "react";
import { User, Mail, Shield, Key, Loader2 } from "lucide-react";
import { Button } from "../components/Button";
import { api, ApiError } from "../lib/api";

export function Profile() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<any>("/api/v1/users/me")
      .then(setProfile)
      .catch((err) => setError(err instanceof ApiError ? err.message : "加载个人资料失败"))
      .finally(() => setLoading(false));
  }, []);

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
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-800">My Profile</h2>
      </div>

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

            <div className="pt-6 border-t border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Key className="w-4 h-4" />
                Security
              </h3>
              <Button disabled variant="secondary">
                Change Password (Controlled by Identity Service)
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

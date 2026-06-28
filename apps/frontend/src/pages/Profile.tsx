import { User, Mail, Shield, Key } from "lucide-react";

export function Profile() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-800">My Profile</h2>
      </div>

      <div className="bg-white rounded border border-gray-200 overflow-hidden">
        <div className="p-8 flex flex-col md:flex-row gap-8 items-start">
          <div className="flex flex-col items-center gap-4">
            <div className="w-24 h-24 bg-[#f27429] rounded-full flex items-center justify-center text-white text-4xl font-bold shadow-sm">
              A
            </div>
            <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-300 rounded hover:bg-gray-100 transition-colors">
              Change Avatar
            </button>
          </div>

          <div className="flex-1 space-y-6 w-full">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded text-gray-900 text-sm">
                  <User className="w-4 h-4 text-gray-400" />
                  Admin User
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded text-gray-900 text-sm">
                  <Mail className="w-4 h-4 text-gray-400" />
                  admin@example.com
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded text-gray-900 text-sm">
                  <Shield className="w-4 h-4 text-gray-400" />
                  System Administrator
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Key className="w-4 h-4" />
                Security
              </h3>
              <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors">
                Change Password
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

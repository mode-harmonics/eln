import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Database,
  LayoutDashboard,
  Menu,
  Grid,
  LogOut,
  Users,
  Shield,
  FlaskConical,
  User,
  Globe,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../lib/utils";
import { Dropdown } from "./Dropdown";

const NAVIGATION = [
  { nameKey: "projects", href: "/projects", icon: Grid },
  { nameKey: "inventory", href: "/inventory", icon: Database },
];

const SYSTEM_NAVIGATION = [
  { nameKey: "user_management", href: "/users", icon: Users },
  { nameKey: "role_management", href: "/roles", icon: Shield },
];

export function Layout() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem("auth");
    navigate("/login");
  };

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === "en" ? "zh" : "en");
  };

  return (
    <div className="flex h-screen bg-white">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/80 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-[#f7f8fa] border-r border-gray-200 text-gray-600 transition-transform lg:static lg:translate-x-0 lg:flex lg:flex-col",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex flex-col shrink-0 px-6 pt-6 pb-4 border-b border-transparent relative z-10">
          <div className="flex items-center justify-between mb-1">
            <span className="text-red-500 font-bold text-xl tracking-tight flex items-center gap-2">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                <path d="M12 2C6.477 2 2 6.477 2 12c0 1.764.455 3.423 1.252 4.88L2 22l5.12-1.252A9.957 9.957 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm-1 13h-2v-2h2v2zm0-4h-2V7h2v4zm4 4h-2v-2h2v2zm0-4h-2V7h2v4z" />
              </svg>
              eln.chat
            </span>
            <Dropdown
              trigger={
                <button className="bg-[#f27429] text-white px-2.5 h-7 flex items-center justify-center rounded font-semibold text-xs hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-[#f27429] focus:ring-offset-2 relative z-20">
                  {t("admin_user", "Admin User")}
                </button>
              }
            >
              <div className="flex items-center gap-3 px-4 py-3 bg-gray-50">
                <div className="bg-[#f27429] text-white w-8 h-8 flex items-center justify-center rounded font-semibold text-sm shrink-0">
                  A
                </div>
                <span className="text-sm font-medium text-gray-900 truncate">
                  {t("admin_user", "Admin User")}
                </span>
              </div>
              <div className="border-t border-gray-100 my-1"></div>
              <button
                onClick={toggleLanguage}
                className="w-full flex items-center justify-between px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Globe className="w-4 h-4 text-gray-500" />
                  {t("language", "Language")}
                </div>
                <span className="text-xs text-gray-400">
                  {i18n.language === "zh" ? "EN" : "中文"}
                </span>
              </button>
              <Link
                to="/profile"
                className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <User className="w-4 h-4 text-gray-500" />
                {t("my_profile", "My profile")}
              </Link>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <LogOut className="w-4 h-4 text-gray-500" />
                {t("sign_out", "Sign out")}
              </button>
            </Dropdown>
          </div>
        </div>
        <div className="flex flex-1 flex-col overflow-y-auto py-2">
          <nav className="flex-1">
            <div className="px-6 py-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                {t("workspace", "Workspace")}
              </p>
            </div>
            {NAVIGATION.map((item) => {
              const isActive =
                location.pathname.startsWith(item.href) ||
                (item.href === "/projects" &&
                  location.pathname.startsWith("/experiments"));
              return (
                <Link
                  key={item.nameKey}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    isActive
                      ? "bg-[#e1e5e8] text-gray-900"
                      : "text-gray-500 hover:bg-black/5 hover:text-gray-900",
                    "group flex items-center gap-3 px-6 py-2.5 text-[15px] font-medium transition-colors",
                  )}
                >
                  <item.icon
                    className={cn(
                      isActive
                        ? "text-gray-700"
                        : "text-gray-400 group-hover:text-gray-600",
                      "h-[18px] w-[18px] shrink-0 stroke-[2]",
                    )}
                  />
                  {t(item.nameKey)}
                </Link>
              );
            })}

            <div className="px-6 py-2 mt-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                {t("system", "System")}
              </p>
            </div>
            {SYSTEM_NAVIGATION.map((item) => {
              const isActive = location.pathname.startsWith(item.href);
              return (
                <Link
                  key={item.nameKey}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    isActive
                      ? "bg-[#e1e5e8] text-gray-900"
                      : "text-gray-500 hover:bg-black/5 hover:text-gray-900",
                    "group flex items-center gap-3 px-6 py-2.5 text-[15px] font-medium transition-colors",
                  )}
                >
                  <item.icon
                    className={cn(
                      isActive
                        ? "text-gray-700"
                        : "text-gray-400 group-hover:text-gray-600",
                      "h-[18px] w-[18px] shrink-0 stroke-[2]",
                    )}
                  />
                  {t(item.nameKey)}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden bg-white">
        {/* Mobile Header */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 lg:hidden">
          <button
            className="text-gray-500"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-red-500 font-bold tracking-tight">
              eln.chat
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto p-6 md:p-10">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

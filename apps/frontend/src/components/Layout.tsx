import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Database,
  LayoutDashboard,
  Menu,
  Folder,
  LogOut,
  Users,
  Shield,
  Layers,
  FlaskConical,
  User,
  Globe,
  Upload,
  ChevronDown,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../lib/utils";
import { Dropdown } from "./Dropdown";
import { api } from "../lib/api";
import { usePermissions } from "../hooks/usePermissions";
import { Button } from "./Button";
import { Logo } from "./Logo";
import { Breadcrumb } from "./Breadcrumb";
import { NotificationBell } from "./NotificationBell";
import { TempUploadDrawer } from "./TempUploadDrawer";

const NAVIGATION = [
  // { nameKey: "dashboard", href: "/dashboard", icon: LayoutDashboard, requiredPermission: "projects:read" },
  { nameKey: "projects", href: "/projects", icon: Folder, requiredPermission: "projects:read" },
  // { nameKey: "inventory", href: "/inventory", icon: Database, requiredPermission: "data:read" },
];

const SYSTEM_NAVIGATION = [
  { nameKey: "user_management", href: "/users", icon: Users, requiredPermission: "users:read" },
  { nameKey: "role_management", href: "/roles", icon: Shield, requiredPermission: "roles:read" },
  { nameKey: "workflow_config", href: "/workflow-config", icon: Layers, requiredPermission: "roles:write" },
];

export function Layout() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [tempUploadOpen, setTempUploadOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get<any>("/api/v1/users/me")
      .then((data) => {
        if (cancelled) return;
        setCurrentUser(data);
        if (data?.id) {
          localStorage.setItem("currentUserId", data.id);
        }
        if (data?.permissionList) {
          localStorage.setItem("permissionList", JSON.stringify(data.permissionList));
          window.dispatchEvent(new Event("permissionsChanged"));
        }
      })
      .catch(() => { });
    return () => { cancelled = true; };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("auth");
    localStorage.removeItem("permissionList");
    localStorage.removeItem("currentUserId");
    window.dispatchEvent(new Event("permissionsChanged"));
    navigate("/login");
  };

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === "en" ? "zh" : "en");
  };

  const initial = currentUser?.fullName ? currentUser.fullName.charAt(0).toUpperCase() : "U";
  const displayName = currentUser?.fullName || "User";

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
          "fixed inset-y-0 left-0 z-50 w-64 bg-[#f7f8fa] border-r border-gray-200 text-gray-600 transition-transform lg:static lg:!translate-x-0 lg:flex lg:flex-col",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex flex-col shrink-0 px-6 pt-6 pb-4 border-b border-transparent relative z-10">
          <div className="flex items-center justify-between mb-1">
            <Logo />
            <div className="flex items-center gap-1">
              <NotificationBell />
              <Dropdown
                open={userMenuOpen}
                onOpenChange={setUserMenuOpen}
                className="w-64 !p-1"
                trigger={
                  <Button
                    aria-label={`${displayName} menu`}
                    aria-expanded={userMenuOpen}
                    className="!h-8 shrink-0 !gap-1 !rounded-control !bg-transparent !px-1 !py-0 !text-xs !font-semibold !text-gray-700 hover:!bg-gray-100"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-action text-xs font-bold text-white">{initial}</span>
                    <ChevronDown className={cn("h-3.5 w-3.5 text-gray-400 transition-transform", userMenuOpen && "rotate-180")} aria-hidden="true" />
                  </Button>
                }
              >
              <div className="flex items-center gap-3 rounded-control bg-surface-subtle px-3 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-action text-sm font-semibold text-white">
                  {initial}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900">{displayName}</p>
                  <p className="truncate text-xs text-gray-400">{currentUser?.username || currentUser?.email || t("my_profile", "My profile")}</p>
                </div>
              </div>
              <div className="my-1 border-t border-gray-100"></div>
              <Button variant="text" onClick={toggleLanguage} className="w-full !justify-between !rounded-control !px-3 !py-2 !text-sm !text-gray-700 hover:!bg-gray-50 hover:!text-gray-900">
                <div className="flex items-center gap-3">
                  <Globe className="w-4 h-4 text-gray-500" />
                  {t("language", "Language")}
                </div>
                <span className="text-xs text-gray-400">
                  {i18n.language === "zh" ? "EN" : "中文"}
                </span>
              </Button>
              <Link
                to="/profile"
                onClick={() => setUserMenuOpen(false)}
                className="flex items-center gap-3 rounded-control px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50"
              >
                <User className="w-4 h-4 text-gray-500" />
                {t("my_profile", "My profile")}
              </Link>
              <Button variant="text" onClick={handleLogout} className="w-full !justify-start !rounded-control !px-3 !py-2 !text-sm !text-red-600 hover:!bg-red-50 hover:!text-red-700">
                <LogOut className="w-4 h-4" />
                {t("sign_out", "Sign out")}
              </Button>
            </Dropdown>
            </div>
          </div>
        </div>
        <div className="flex flex-1 flex-col overflow-y-auto py-2">
          <nav className="flex-1">
            <div className="px-6 py-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                {t("workspace", "Workspace")}
              </p>
            </div>
            {NAVIGATION.filter(item => hasPermission(item.requiredPermission)).map((item) => {
              const isActive =
                location.pathname.startsWith(item.href) ||
                (item.href === "/projects" &&
                  (location.pathname.startsWith("/experiments") ||
                   location.pathname.includes("/experiments/")));
              return (
                <Link
                  key={item.nameKey}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "group flex items-center gap-3 px-6 py-2.5 text-[15px] font-medium transition-colors",
                    isActive
                      ? "bg-[#e2e8f0] text-gray-900 shadow-[inset_3px_0_0_0_#dc2626]"
                      : "text-gray-500 hover:bg-black/5 hover:text-gray-900",
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

            {SYSTEM_NAVIGATION.some(item => hasPermission(item.requiredPermission)) && (
              <>
                <div className="px-6 py-2 mt-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    {t("system", "System")}
                  </p>
                </div>
                {SYSTEM_NAVIGATION.filter(item => hasPermission(item.requiredPermission)).map((item) => {
                  const isActive = location.pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.nameKey}
                      to={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        "group flex items-center gap-3 px-6 py-2.5 text-[15px] font-medium transition-colors",
                        isActive
                          ? "bg-[#e2e8f0] text-gray-900 shadow-[inset_3px_0_0_0_#dc2626]"
                          : "text-gray-500 hover:bg-black/5 hover:text-gray-900",
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
              </>
            )}
          </nav>

          {/* Temp Upload button & Footer links */}
          <div className="px-4 pb-4 mt-auto space-y-4">
            <button
              onClick={() => setTempUploadOpen(true)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium text-gray-500 hover:bg-black/5 hover:text-gray-900 transition-colors group"
            >
              <Upload className="w-4 h-4 shrink-0 stroke-[2] text-gray-400 group-hover:text-gray-600" />
              临时文件
            </button>
            <div className="px-3 space-y-3 border-t border-gray-200/60 pt-4">
              <a href="#" className="block text-[11px] text-gray-400 hover:text-gray-600 transition-colors">Terms and conditions</a>
              <a href="#" className="block text-[11px] text-gray-400 hover:text-gray-600 transition-colors">Privacy policy</a>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden bg-white">
        {/* Mobile Header */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 lg:hidden">
          <Button variant="text" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-6 w-6" />
          </Button>
          <Logo iconOnly />
        </header>

        <main className="flex-1 overflow-y-auto">
          {/* Breadcrumb: wider, full-width */}
          <div className="w-full px-6 md:px-10 pt-5 pb-2">
            <div className="max-w-screen-xl mx-auto">
              <Breadcrumb />
            </div>
          </div>
          <div className="w-full max-w-screen-xl mx-auto px-6 md:px-10 pb-12 pt-2">
            <Outlet />
          </div>
        </main>
      </div>

      <TempUploadDrawer open={tempUploadOpen} onClose={() => setTempUploadOpen(false)} />
    </div>
  );
}

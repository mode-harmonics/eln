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
import { GlobalSearch } from "./GlobalSearch";

const NAVIGATION = [
  { nameKey: "dashboard", href: "/dashboard", icon: LayoutDashboard, requiredPermission: "projects:read" },
  { nameKey: "projects", href: "/projects", icon: Grid, requiredPermission: "projects:read" },
  { nameKey: "inventory", href: "/inventory", icon: Database, requiredPermission: "data:read" },
];

const SYSTEM_NAVIGATION = [
  { nameKey: "user_management", href: "/users", icon: Users, requiredPermission: "users:read" },
  { nameKey: "role_management", href: "/roles", icon: Shield, requiredPermission: "roles:read" },
];

export function Layout() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    api.get<any>("/api/v1/users/me")
      .then((data) => {
        if (cancelled) return;
        setCurrentUser(data);
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
          "fixed inset-y-0 left-0 z-50 w-64 bg-[#f7f8fa] border-r border-gray-200 text-gray-600 transition-transform lg:static lg:translate-x-0 lg:flex lg:flex-col",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex flex-col shrink-0 px-6 pt-6 pb-4 border-b border-transparent relative z-10">
          <div className="flex items-center justify-between mb-1">
            <Logo />
            <div className="flex items-center gap-1">
              <NotificationBell />
              <Dropdown
                trigger={
                  <Button
                    title={displayName}
                    className="!bg-[#f27429] !text-white !w-7 !h-7 !rounded-full !p-0 !text-xs !font-bold hover:!opacity-90 focus:!ring-[#f27429] shrink-0"
                  >
                    {initial}
                  </Button>
                }
              >
              <div className="flex items-center gap-3 px-4 py-3 bg-gray-50">
                <div className="bg-[#f27429] text-white w-8 h-8 flex items-center justify-center rounded font-semibold text-sm shrink-0">
                  {initial}
                </div>
                <span className="text-sm font-medium text-gray-900 truncate">
                  {displayName}
                </span>

              </div>
              <div className="border-t border-gray-100 my-1"></div>
              <Button variant="text" onClick={toggleLanguage} className="w-full !justify-between !px-4 !py-2 !text-sm !text-gray-700 hover:!text-gray-900">
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
                className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <User className="w-4 h-4 text-gray-500" />
                {t("my_profile", "My profile")}
              </Link>
              <Button variant="text" onClick={handleLogout} className="w-full !justify-start !px-4 !py-2 !text-sm !text-gray-700 hover:!text-gray-900">
                <LogOut className="w-4 h-4 text-gray-500" />
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
              </>
            )}
          </nav>
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
          <div className="w-full px-6 md:px-10 pt-6 md:pt-10 pb-4">
            <div className="max-w-screen-xl mx-auto flex items-center justify-between gap-4 flex-wrap">
              <Breadcrumb />
              <GlobalSearch />
            </div>
          </div>
            {/* Content: original width */}
            <div className="max-w-6xl mx-auto p-6 md:p-10">
              <Outlet />
            </div>
        </main>
      </div>
    </div>
  );
}

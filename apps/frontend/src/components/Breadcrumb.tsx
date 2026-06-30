import React from "react";
import { Link, useMatches } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import { useTranslation } from "react-i18next";

export function Breadcrumb() {
  const { t } = useTranslation();
  const matches = useMatches();

  const crumbs: { label: string; pathname: string }[] = [];
  for (const m of matches) {
    const h = m.handle as { breadcrumb?: string | ((match: any) => string) } | undefined;
    if (h?.breadcrumb) {
      const label =
        typeof h.breadcrumb === "function" ? h.breadcrumb(m) : t(h.breadcrumb);
      crumbs.push({ label, pathname: m.pathname });
    }
  }

  if (crumbs.length === 0) return null;

  return (
    <nav className="flex items-center gap-1.5 text-sm text-gray-400">
      <Link
        to="/projects"
        className="flex items-center gap-1 text-gray-400 hover:text-[#1d74f5] transition-colors"
      >
        <Home className="w-4 h-4" />
      </Link>
      {crumbs.map((crumb, index) => (
        <React.Fragment key={index}>
          <ChevronRight className="w-4 h-4 text-gray-300" />
          {index < crumbs.length - 1 ? (
            <Link
              to={crumb.pathname}
              className="flex items-center gap-1 text-gray-400 hover:text-[#1d74f5] transition-colors"
            >
              {crumb.label}
            </Link>
          ) : (
            <span className="text-gray-600 font-medium">{crumb.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}

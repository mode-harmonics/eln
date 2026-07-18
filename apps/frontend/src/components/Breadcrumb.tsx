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
    <nav className="flex items-center gap-1 text-[13px] text-gray-500 font-medium">
      <Link
        to="/projects"
        className="flex items-center text-gray-400 hover:text-gray-700 transition-colors"
      >
        <Home className="w-3.5 h-3.5" />
      </Link>
      {crumbs.map((crumb, index) => (
        <React.Fragment key={index}>
          <ChevronRight className="w-3.5 h-3.5 text-gray-300 mx-0.5 stroke-[2]" />
          {index < crumbs.length - 1 ? (
            <Link
              to={crumb.pathname}
              className="flex items-center text-gray-400 hover:text-gray-700 transition-colors"
            >
              {crumb.label}
            </Link>
          ) : (
            <span className="text-gray-900">{crumb.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}

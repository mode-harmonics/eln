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

  const visibleCrumbs = crumbs.filter((crumb) => crumb.pathname !== "/projects");

  if (visibleCrumbs.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-xs font-medium text-gray-400">
      <Link
        to="/projects"
        aria-label={t("projects")}
        className="flex shrink-0 items-center text-gray-400 transition-colors hover:text-gray-700"
      >
        <Home className="h-3.5 w-3.5" />
      </Link>
      {visibleCrumbs.map((crumb, index) => (
        <React.Fragment key={index}>
          <ChevronRight className="mx-0.5 h-3 w-3 shrink-0 text-gray-300" />
          {index < visibleCrumbs.length - 1 ? (
            <Link
              to={crumb.pathname}
              className="flex shrink-0 items-center text-gray-400 transition-colors hover:text-gray-700"
            >
              {crumb.label}
            </Link>
          ) : (
            <span aria-current="page" className="truncate text-gray-500">{crumb.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}

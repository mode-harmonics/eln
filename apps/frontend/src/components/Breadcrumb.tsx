import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

interface BreadcrumbProps {
  backTo?: string;
  items: BreadcrumbItem[];
}

export function Breadcrumb({ backTo, items }: BreadcrumbProps) {
  return (
    <div className="flex items-center gap-3 mb-4">
      {backTo && (
        <Link
          to={backTo}
          className="flex items-center justify-center w-8 h-8 rounded-full border border-gray-200 bg-white text-gray-500 hover:text-gray-900 hover:border-gray-300 shadow-sm transition-all"
          title="Back"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
      )}
      <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
        {items.map((item, index) => (
          <React.Fragment key={index}>
            {index > 0 && <span>/</span>}
            {item.to ? (
              <Link to={item.to} className="hover:text-gray-900 transition-colors">
                {item.label}
              </Link>
            ) : (
              <span className="text-gray-900 font-semibold">{item.label}</span>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

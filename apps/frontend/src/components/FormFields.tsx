import React, { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "../lib/utils";
import { Check, ChevronDown, X, Search } from "lucide-react";
import { createPortal } from "react-dom";

// ─── Field wrapper ──────────────────────────────────────────────

interface FieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}

export function Field({ label, htmlFor, error, children, className }: FieldProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <label htmlFor={htmlFor} className="block text-xs font-medium text-gray-700">
        {label}
      </label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

export const inputClass =
  "block w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-gray-900 placeholder-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-300 text-xs transition-colors";

// ─── TextInput ──────────────────────────────────────────────────

interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(
  ({ label, className, id, ...props }, ref) => {
    const input = (
      <input
        ref={ref}
        id={id}
        className={cn(inputClass, className)}
        {...props}
      />
    );
    if (label) return <Field label={label} htmlFor={id}>{input}</Field>;
    return input;
  }
);
TextInput.displayName = "TextInput";

// ─── Select (custom dropdown) ───────────────────────────────────

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  label?: string;
  value?: string;
  onChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  error?: string;
}

export function Select({
  label,
  value,
  onChange,
  options,
  placeholder = "Select...",
  className,
  error,
  ...props
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const selected = options.find((o) => o.value === value);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        const portal = document.getElementById("select-portal");
        if (portal && portal.contains(e.target as Node)) return;
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  // Position the dropdown
  const measure = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setDropdownStyle({
      position: "fixed",
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      zIndex: 9999,
    });
  }, []);

  const handleToggle = () => {
    if (!open) measure();
    setOpen((p) => !p);
  };

  const handleSelect = (val: string) => {
    onChange?.(val);
    setOpen(false);
  };

  const trigger = (
    <div
      ref={containerRef}
      onClick={handleToggle}
      className={cn(
        "relative flex items-center justify-between w-full rounded-md border px-2.5 py-1.5 text-xs cursor-pointer select-none transition-colors",
        "bg-white hover:border-gray-400",
        open ? "border-gray-500 ring-1 ring-gray-300" : "border-gray-300",
        error && "border-red-400 ring-1 ring-red-400",
        className,
      )}
      {...props}
    >
      <span className={cn("truncate", !selected && "text-gray-400")}>
        {selected ? selected.label : placeholder}
      </span>
      <ChevronDown
        className={cn(
          "w-3.5 h-3.5 text-gray-500 shrink-0 transition-transform",
          open && "rotate-180",
        )}
      />
    </div>
  );

  return (
    <>
      {label ? <Field label={label} error={error}>{trigger}</Field> : trigger}

      {open && createPortal(
        <div id="select-portal" style={dropdownStyle} className="bg-white rounded-lg shadow-lg border border-gray-200 py-0.5 max-h-[240px] overflow-y-auto z-[9999] animate-in fade-in zoom-in-95 duration-150">
          {options.length === 0 ? (
            <div className="px-3 py-3 text-xs text-gray-400 text-center">No options</div>
          ) : (
            options.map((opt) => (
              <div
                key={opt.value}
                onClick={() => handleSelect(opt.value)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs cursor-pointer transition-colors",
                  opt.value === value
                    ? "bg-action-subtle text-action-muted font-medium"
                    : "text-gray-700 hover:bg-gray-50",
                )}
              >
                <span className="w-3 h-3 flex items-center justify-center shrink-0">
                  {opt.value === value && <Check className="w-2.5 h-2.5 text-action" />}
                </span>
                <span className="truncate">{opt.label}</span>
              </div>
            ))
          )}
        </div>,
        document.body,
      )}
    </>
  );
}

// ─── MultiSelect (custom dropdown) ─────────────────────────────

interface MultiSelectProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  label?: string;
  value?: string[];
  onChange?: (value: string[]) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  error?: string;
}

export function MultiSelect({
  label,
  value = [],
  onChange,
  options,
  placeholder = "Select...",
  className,
  error,
  ...props
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const selectedOptions = options.filter((o) => value.includes(o.value));
  const filteredOptions = searchText
    ? options.filter((o) => o.label.toLowerCase().includes(searchText.toLowerCase()))
    : options;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        const portal = document.getElementById("multiselect-portal");
        if (portal && portal.contains(e.target as Node)) return;
        setOpen(false);
        setSearchText("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); setSearchText(""); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open && searchRef.current) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open]);

  // Position the dropdown
  const measure = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setDropdownStyle({
      position: "fixed",
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 200),
      zIndex: 9999,
    });
  }, []);

  useEffect(() => {
    if (open) {
      measure();
      window.addEventListener("scroll", measure, true);
      window.addEventListener("resize", measure);
      return () => {
        window.removeEventListener("scroll", measure, true);
        window.removeEventListener("resize", measure);
      };
    }
  }, [open, measure]);

  const handleToggle = () => {
    if (!open) measure();
    setOpen((p) => !p);
    if (open) setSearchText("");
  };

  const handleSelect = (val: string) => {
    if (!onChange) return;
    const isSelected = value.includes(val);
    if (isSelected) {
      onChange(value.filter(v => v !== val));
    } else {
      onChange([...value, val]);
    }
  };

  const handleSelectAll = () => {
    if (!onChange) return;
    if (value.length === options.length) {
      onChange([]);
    } else {
      onChange(options.map((o) => o.value));
    }
  };

  const handleClearAll = () => {
    if (!onChange) return;
    onChange([]);
  };

  const handleRemoveTag = (e: React.MouseEvent, val: string) => {
    e.stopPropagation();
    if (!onChange) return;
    onChange(value.filter(v => v !== val));
  };

  const allSelected = options.length > 0 && value.length === options.length;

  const trigger = (
    <div
      ref={containerRef}
      onClick={handleToggle}
      className={cn(
        "relative flex items-center justify-between w-full rounded-md border px-2.5 py-1.5 text-xs cursor-pointer select-none transition-colors min-h-[30px]",
        "bg-white hover:border-gray-400",
        open ? "border-gray-500 ring-1 ring-gray-300" : "border-gray-300",
        error && "border-red-400 ring-1 ring-red-400",
        className,
      )}
      {...props}
    >
      <div className="flex-1 flex items-center gap-1 flex-wrap overflow-hidden mr-1">
        {selectedOptions.length === 0 ? (
          <span className="text-gray-400 truncate">{placeholder}</span>
        ) : selectedOptions.length <= 2 ? (
          selectedOptions.map((opt) => (
            <span
              key={opt.value}
              className="inline-flex items-center gap-1 bg-action-subtle text-action-muted rounded-sm px-1.5 py-0.5 text-xs font-medium"
            >
              <span className="truncate max-w-[80px]">{opt.label}</span>
              <X
                className="w-2.5 h-2.5 cursor-pointer hover:text-orange-900 shrink-0"
                onClick={(e) => handleRemoveTag(e, opt.value)}
              />
            </span>
          ))
        ) : (
          <span className="text-action-muted font-medium">
            {`${selectedOptions.length} 项`}
          </span>
        )}
      </div>
      <ChevronDown
        className={cn(
          "w-3.5 h-3.5 text-gray-500 shrink-0 transition-transform",
          open && "rotate-180",
        )}
      />
    </div>
  );

  return (
    <>
      {label ? <Field label={label} error={error}>{trigger}</Field> : trigger}

      {open && createPortal(
        <div id="multiselect-portal" style={dropdownStyle} className="bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-[9999] animate-in fade-in zoom-in-95 duration-150 flex flex-col">
          {/* Search input */}
          <div className="px-2 pb-1 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
              <input
                ref={searchRef}
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="搜索..."
                className="w-full pl-6 pr-2 py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-300"
                onKeyDown={(e) => e.stopPropagation()}
              />
              {searchText && (
                <X
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 cursor-pointer hover:text-gray-600"
                  onClick={() => setSearchText("")}
                />
              )}
            </div>
          </div>

          {/* Select All / Clear All */}
          {options.length > 0 && !searchText && (
            <div className="flex items-center gap-2 px-3 py-1 border-b border-gray-100">
              <button
                type="button"
                onClick={handleSelectAll}
                className={cn(
                  "text-xs font-medium transition-colors",
                  allSelected ? "text-action-muted" : "text-gray-500 hover:text-action-muted"
                )}
              >
                {allSelected ? "取消全选" : "全选"}
              </button>
              {value.length > 0 && (
                <>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="text-xs text-gray-500 hover:text-red-500 font-medium transition-colors"
                  >
                    {"清除"}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Options list */}
          <div className="max-h-[200px] overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-3 text-xs text-gray-400 text-center">
                {searchText ? "无匹配结果" : "No options"}
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = value.includes(opt.value);
                return (
                  <div
                    key={opt.value}
                    onClick={() => handleSelect(opt.value)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer transition-colors",
                      isSelected
                        ? "bg-action-subtle text-action-muted font-medium"
                        : "text-gray-700 hover:bg-gray-50",
                    )}
                  >
                    <div className={cn(
                      "w-3.5 h-3.5 rounded flex items-center justify-center border shrink-0 transition-colors",
                      isSelected ? "bg-action border-action" : "border-gray-300 bg-white"
                    )}>
                      {isSelected && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                    </div>
                    <span className="truncate">{opt.label}</span>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer with count */}
          <div className="px-3 py-1 border-t border-gray-100 text-[10px] text-gray-400">
            {`已选 ${value.length}/${options.length}`}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

// ─── Native Select (legacy, kept for compatibility) ─────────────

interface NativeSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export const NativeSelect = React.forwardRef<HTMLSelectElement, NativeSelectProps>(
  ({ label, className, id, children, ...props }, ref) => {
    const select = (
      <select
        ref={ref}
        id={id}
        className={cn(
          "block w-full appearance-none rounded-md border border-gray-300 bg-white px-2.5 py-1.5 pr-8 text-xs text-gray-900 cursor-pointer transition-colors",
          "hover:border-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-300",
          className,
        )}
        {...props}
      >
        {children}
      </select>
    );
    if (label) return <Field label={label} htmlFor={id}>{select}</Field>;
    return (
      <div className="relative">
        {select}
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
          <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
        </div>
      </div>
    );
  }
);
NativeSelect.displayName = "NativeSelect";

// Re-export NativeSelect as Select for backward compat
export { NativeSelect as FormSelect };

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, className, id, ...props }, ref) => {
    const textarea = (
      <textarea
        ref={ref}
        id={id}
        className={cn(inputClass, "resize-y", className)}
        {...props}
      />
    );
    if (label) {
      return (
        <Field label={label} htmlFor={id}>
          {textarea}
        </Field>
      );
    }
    return textarea;
  }
);
Textarea.displayName = "Textarea";

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export function Checkbox({ label, id, className, ...props }: CheckboxProps) {
  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        type="checkbox"
        className={cn("w-4 h-4 text-action rounded border-gray-300 focus:ring-focus/40", className)}
        {...props}
      />
      <label htmlFor={id} className="text-sm text-gray-700 font-medium">
        {label}
      </label>
    </div>
  );
}

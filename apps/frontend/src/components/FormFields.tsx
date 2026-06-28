import React from "react";
import { cn } from "../lib/utils";

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
      <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

// Extends native input with our consistent styling
export const inputClass =
  "block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-[#1d74f5] focus:outline-none focus:ring-1 focus:ring-[#1d74f5] sm:text-sm transition-colors";

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
    if (label) {
      return (
        <Field label={label} htmlFor={id}>
          {input}
        </Field>
      );
    }
    return input;
  }
);
TextInput.displayName = "TextInput";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, className, id, children, ...props }, ref) => {
    const select = (
      <select
        ref={ref}
        id={id}
        className={cn(inputClass, "cursor-pointer", className)}
        {...props}
      >
        {children}
      </select>
    );
    if (label) {
      return (
        <Field label={label} htmlFor={id}>
          {select}
        </Field>
      );
    }
    return select;
  }
);
Select.displayName = "Select";

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
        className={cn("w-4 h-4 text-[#1d74f5] rounded border-gray-300 focus:ring-[#1d74f5]", className)}
        {...props}
      />
      <label htmlFor={id} className="text-sm text-gray-700 font-medium">
        {label}
      </label>
    </div>
  );
}

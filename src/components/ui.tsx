"use client";

import { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--ink)] sm:text-4xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-2 max-w-2xl text-[var(--muted)]">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[0_1px_0_rgba(15,23,42,0.04)] sm:p-5 ${className}`}
    >
      {children}
    </div>
  );
}

export function Button({
  children,
  onClick,
  type = "button",
  variant = "primary",
  disabled,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean;
  className?: string;
}) {
  const styles = {
    primary: "bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)]",
    secondary:
      "bg-[var(--surface-2)] text-[var(--ink)] hover:bg-[var(--line)] border border-[var(--line)]",
    danger: "bg-[var(--danger)] text-white hover:opacity-90",
    ghost: "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]",
  }[variant];

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-md px-3.5 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Input({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
        {label}
      </span>
      <input
        {...props}
        className={`w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--ink)] outline-none ring-[var(--accent)] focus:ring-2 ${props.className ?? ""}`}
      />
    </label>
  );
}

export function Select({
  label,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
        {label}
      </span>
      <select
        {...props}
        className={`w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--ink)] outline-none ring-[var(--accent)] focus:ring-2 ${props.className ?? ""}`}
      >
        {children}
      </select>
    </label>
  );
}

export function Textarea({
  label,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
        {label}
      </span>
      <textarea
        {...props}
        className={`w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--ink)] outline-none ring-[var(--accent)] focus:ring-2 ${props.className ?? ""}`}
      />
    </label>
  );
}

export function Badge({
  children,
  color,
}: {
  children: ReactNode;
  color?: string;
}) {
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium text-white"
      style={{ backgroundColor: color ?? "var(--accent)" }}
    >
      {children}
    </span>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <p className="rounded-lg border border-dashed border-[var(--line)] bg-[var(--surface-2)]/50 px-4 py-8 text-center text-sm text-[var(--muted)]">
      {text}
    </p>
  );
}

export function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="mb-6 rounded-xl border border-[var(--danger)]/30 bg-[#fff1f2] p-4">
      <p className="text-sm font-semibold text-[var(--danger)]">Daten konnten nicht geladen werden</p>
      <p className="mt-1 text-sm text-[var(--ink-soft)]">{message}</p>
      <p className="mt-2 text-xs text-[var(--muted)]">
        Prüfen Sie auf dem Server:{" "}
        <code className="rounded bg-white px-1">http://SERVER:3000/api/health</code>
      </p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 inline-flex rounded-md bg-[var(--danger)] px-3 py-1.5 text-sm font-medium text-white"
        >
          Erneut versuchen
        </button>
      ) : null}
    </div>
  );
}

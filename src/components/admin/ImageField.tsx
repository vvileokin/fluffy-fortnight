"use client";

import * as React from "react";
import Image from "next/image";
import { Upload, ImageIcon, Loader2 } from "lucide-react";

/**
 * Admin image picker — uploads to the Supabase `media` bucket and returns the
 * public URL via `onChange`. Shows the current/updated image and a size hint.
 */
export function ImageField({
  label,
  hint,
  value,
  folder = "misc",
  onChange,
  thumbW = 96,
  thumbH = 54,
}: {
  label: string;
  hint: string;
  value?: string;
  folder?: string;
  onChange?: (url: string) => void;
  thumbW?: number;
  thumbH?: number;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [url, setUrl] = React.useState<string | undefined>(value);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("folder", folder);
    const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok && j.url) {
      setUrl(j.url);
      onChange?.(j.url);
    } else {
      setError(j.error || "Помилка завантаження");
    }
  }

  const shown = url;

  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-ink-muted">{label}</span>
      <div className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-surface-2 p-2.5">
        <span
          className="relative grid shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-surface"
          style={{ width: thumbW, height: thumbH }}
        >
          {shown ? (
            <Image src={shown} alt="" fill sizes="96px" className="object-contain" />
          ) : (
            <ImageIcon className="size-5 text-ink-faint" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md border border-border-strong px-2.5 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-surface-3 disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
            {busy ? "Завантаження…" : "Завантажити"}
          </button>
          <p className="mt-1 text-[0.6875rem] text-ink-subtle">{hint}</p>
          {error && <p className="mt-1 text-[0.6875rem] font-medium text-danger">{error}</p>}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFile}
        />
      </div>
    </label>
  );
}

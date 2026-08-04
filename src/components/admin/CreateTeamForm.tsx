"use client";

import * as React from "react";
import { Upload, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CatalogTeam } from "./TeamCombobox";

/**
 * Add a team we don't have yet. The name comes prefilled from PandaScore, but
 * the logo is chosen here on purpose — their artwork varies in quality and
 * framing, so it's picked by hand rather than taken automatically.
 */
export function CreateTeamForm({
  defaultName,
  psTeamId,
  onCreated,
  onCancel,
}: {
  defaultName: string;
  psTeamId: number | null;
  onCreated: (team: CatalogTeam) => void;
  onCancel: () => void;
}) {
  const [name, setName] = React.useState(defaultName);
  const [tag, setTag] = React.useState("");
  const [brand, setBrand] = React.useState("#1D1D20");
  const [logo, setLogo] = React.useState("");
  const [uploading, setUploading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function pickLogo(file: File) {
    setUploading(true);
    setError(null);
    const body = new FormData();
    body.append("file", file);
    body.append("folder", "teams");
    const res = await fetch("/api/admin/upload", { method: "POST", body }).catch(() => null);
    const j = await res?.json().catch(() => ({}));
    setUploading(false);
    if (!res?.ok) {
      setError(j?.error || "Не вдалося завантажити лого.");
      return;
    }
    setLogo(j.url as string);
  }

  async function save() {
    if (!name.trim()) {
      setError("Вкажи назву команди.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/pandascore/team", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        tag: tag.trim() || undefined,
        brand,
        logo: logo || null,
        ps_team_id: psTeamId,
      }),
    }).catch(() => null);
    const j = await res?.json().catch(() => ({}));
    setSaving(false);
    if (!res?.ok) {
      setError(j?.error || "Не вдалося створити команду.");
      return;
    }
    onCreated(j.team as CatalogTeam);
  }

  return (
    <div className="space-y-2.5 rounded-lg border border-accent/40 bg-accent/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Нова команда</p>
        <button
          type="button"
          onClick={onCancel}
          className="grid size-6 place-items-center rounded text-ink-subtle transition-colors hover:bg-surface-2 hover:text-ink"
          aria-label="Скасувати"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Назва"
          className="h-9 rounded-lg border border-border bg-surface-2 px-2.5 text-sm text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none"
        />
        <input
          value={tag}
          onChange={(e) => setTag(e.target.value.toUpperCase().slice(0, 5))}
          placeholder="Тег (авто, якщо порожньо)"
          className="h-9 rounded-lg border border-border bg-surface-2 px-2.5 text-sm text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span
          className="grid size-9 shrink-0 place-items-center rounded-lg"
          style={{ background: brand }}
        >
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="size-6 object-contain" />
          ) : (
            <span className="text-[0.625rem] font-bold text-white/70">лого</span>
          )}
        </span>

        <label
          className={cn(
            "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-semibold text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink",
            uploading && "pointer-events-none opacity-60",
          )}
        >
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {logo ? "Змінити лого" : "Завантажити лого"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void pickLogo(f);
              e.target.value = "";
            }}
          />
        </label>

        <label className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-2.5 text-xs text-ink-muted">
          Колір
          <input
            type="color"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="size-6 cursor-pointer rounded border-0 bg-transparent p-0"
          />
        </label>
      </div>

      {error && <p className="text-xs font-medium text-danger">{error}</p>}

      <button
        type="button"
        onClick={save}
        disabled={saving || uploading}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-bold text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
      >
        {saving && <Loader2 className="size-4 animate-spin" />}
        Створити команду
      </button>
    </div>
  );
}

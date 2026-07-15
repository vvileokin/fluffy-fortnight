"use client";

import * as React from "react";
import { Check, Loader2 } from "lucide-react";
import { AdminHead, Panel } from "@/components/admin/ui";
import { ImageField } from "@/components/admin/ImageField";
import { tournaments, promoBanner } from "@/lib/data";
import { createClient } from "@/lib/supabase/client";

const inputCls =
  "h-10 w-full rounded-lg border border-border bg-surface-2 px-3 text-sm text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none";

export default function ContentAdmin() {
  const [heading, setHeading] = React.useState(
    "Найбільша спільнота з CS2 в Україні",
  );
  const [promoEnabled, setPromoEnabled] = React.useState(promoBanner.enabled);
  const [promoImage, setPromoImage] = React.useState<string>(promoBanner.image);
  const [promoLinkType, setPromoLinkType] = React.useState<"tournament" | "match">(
    promoBanner.linkType,
  );
  const [promoTarget, setPromoTarget] = React.useState<string>(promoBanner.target);
  const [covers, setCovers] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    createClient()
      .from("site_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        setPromoEnabled(data.promo_enabled ?? promoBanner.enabled);
        setPromoImage(data.promo_image || promoBanner.image);
        setPromoLinkType(
          data.promo_link_type === "match" ? "match" : "tournament",
        );
        setPromoTarget(data.promo_target || promoBanner.target);
        setCovers((data.covers as Record<string, string>) ?? {});
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/content", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        promo_enabled: promoEnabled,
        promo_image: promoImage,
        promo_link_type: promoLinkType,
        promo_target: promoTarget,
        covers,
      }),
    });
    const j = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok || !j.ok) {
      setError(j.error || "Не вдалося зберегти");
      return;
    }
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1400);
  }

  return (
    <>
      <AdminHead
        title="Контент"
        subtitle="Промо-банер сайдбару та обкладинки турнірів головної сторінки."
        action={
          <button
            onClick={save}
            disabled={saving}
            className="flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-bold text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : saved ? (
              <>
                <Check className="size-4" strokeWidth={3} /> Збережено
              </>
            ) : (
              "Зберегти зміни"
            )}
          </button>
        }
      />

      {error && (
        <p className="mb-4 rounded-lg bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
          {error}
        </p>
      )}

      <Panel title="Hero">
        <div className="space-y-3 p-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-ink-muted">
              Заголовок (UA) · попередній перегляд
            </span>
            <textarea
              value={heading}
              onChange={(e) => setHeading(e.target.value)}
              rows={2}
              className="w-full resize-none rounded-lg border border-border bg-surface-2 p-3 text-sm text-ink focus:border-accent focus:outline-none"
            />
          </label>
          <div className="rounded-lg border border-border bg-bg p-4">
            <p className="text-[0.625rem] uppercase tracking-wide text-ink-subtle">
              Прев’ю
            </p>
            <p className="mt-1 text-lg font-extrabold leading-tight tracking-tight text-ink">
              {heading}
            </p>
          </div>
        </div>
      </Panel>

      {/* Promo banner + tournament covers */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Промо-банер (сайдбар)">
          <div className="space-y-3 p-4">
            <ImageField
              label="Зображення"
              hint="Рекомендовано 448×240 px (2×), висота показу 120 px"
              folder="promo"
              value={promoImage || undefined}
              onChange={setPromoImage}
            />
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-ink-muted">
                  Веде на
                </span>
                <select
                  className={inputCls}
                  value={promoLinkType}
                  onChange={(e) =>
                    setPromoLinkType(e.target.value === "match" ? "match" : "tournament")
                  }
                >
                  <option value="tournament">Турнір</option>
                  <option value="match">Матч</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-ink-muted">
                  Ціль
                </span>
                {promoLinkType === "tournament" ? (
                  <select
                    className={inputCls}
                    value={promoTarget}
                    onChange={(e) => setPromoTarget(e.target.value)}
                  >
                    {tournaments.map((t) => (
                      <option key={t.slug} value={t.slug}>
                        {t.shortName}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className={inputCls}
                    value={promoTarget}
                    onChange={(e) => setPromoTarget(e.target.value)}
                    placeholder="ID матчу"
                  />
                )}
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink-muted">
              <input
                type="checkbox"
                checked={promoEnabled}
                onChange={(e) => setPromoEnabled(e.target.checked)}
                className="size-4 accent-[var(--accent)]"
              />
              Показувати банер
            </label>
          </div>
        </Panel>

        <Panel title="Обкладинки турнірів">
          <ul className="divide-y divide-border">
            {tournaments.map((t) => (
              <li key={t.slug} className="p-4">
                <ImageField
                  label={t.shortName}
                  hint="Рекомендовано 800×300 px · JPG/WebP"
                  folder="covers"
                  value={covers[t.slug] || t.coverImage}
                  onChange={(url) => setCovers((prev) => ({ ...prev, [t.slug]: url }))}
                />
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}

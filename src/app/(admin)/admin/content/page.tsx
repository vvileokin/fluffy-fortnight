"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { AdminHead, Panel } from "@/components/admin/ui";
import { ImageField } from "@/components/admin/ImageField";
import { tournaments, matches, promoBanner, getTeam } from "@/lib/data";

const inputCls =
  "h-10 w-full rounded-lg border border-border bg-surface-2 px-3 text-sm text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none";

export default function ContentAdmin() {
  const [heading, setHeading] = React.useState(
    "Найбільша спільнота з CS2 в Україні",
  );
  const [saved, setSaved] = React.useState(false);

  function save() {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1400);
  }

  return (
    <>
      <AdminHead
        title="Контент"
        subtitle="Hero-повідомлення та показники соцмереж головної сторінки."
        action={
          <button
            onClick={save}
            className="flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-bold text-accent-ink transition-colors hover:bg-accent-hover"
          >
            {saved ? (
              <>
                <Check className="size-4" strokeWidth={3} /> Збережено
              </>
            ) : (
              "Зберегти зміни"
            )}
          </button>
        }
      />

      <Panel title="Hero">
        <div className="space-y-3 p-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-ink-muted">
              Заголовок (UA)
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
              value={promoBanner.image}
            />
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-ink-muted">
                  Веде на
                </span>
                <select className={inputCls} defaultValue={promoBanner.linkType}>
                  <option value="tournament">Турнір</option>
                  <option value="match">Матч</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-ink-muted">
                  Ціль
                </span>
                <select className={inputCls} defaultValue={promoBanner.target}>
                  <optgroup label="Турніри">
                    {tournaments.map((t) => (
                      <option key={t.slug} value={t.slug}>
                        {t.shortName}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Матчі">
                    {matches.map((m) => (
                      <option key={m.id} value={m.id}>
                        {getTeam(m.a).tag} vs {getTeam(m.b).tag}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink-muted">
              <input type="checkbox" defaultChecked={promoBanner.enabled} className="size-4 accent-[var(--accent)]" />
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
                  value={t.coverImage}
                />
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}

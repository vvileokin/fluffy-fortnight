"use client";

import Image from "next/image";
import { Upload, ImageIcon } from "lucide-react";

/**
 * Admin image picker (design-first: shows current image, upload affordance and
 * the recommended dimensions). Wiring to real storage happens later.
 */
export function ImageField({
  label,
  hint,
  value,
  thumbW = 96,
  thumbH = 54,
}: {
  label: string;
  hint: string;
  value?: string;
  thumbW?: number;
  thumbH?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-ink-muted">{label}</span>
      <div className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-surface-2 p-2.5">
        <span
          className="relative grid shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-surface"
          style={{ width: thumbW, height: thumbH }}
        >
          {value ? (
            <Image src={value} alt="" fill sizes="96px" className="object-cover" />
          ) : (
            <ImageIcon className="size-5 text-ink-faint" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-border-strong px-2.5 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-surface-3"
          >
            <Upload className="size-3.5" />
            Завантажити
          </button>
          <p className="mt-1 text-[0.6875rem] text-ink-subtle">{hint}</p>
        </div>
      </div>
    </label>
  );
}

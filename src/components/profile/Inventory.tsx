import { Package } from "lucide-react";
import { RARITY, type InventoryItem } from "@/lib/inventory";
import { cn } from "@/lib/utils";

function obtainedLabel(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("uk-UA", { day: "numeric", month: "short" });
}

/**
 * Impeccable: Crafted Inventory — an item is a thing you own, so each one gets
 * a lit alcove rather than a table row: the artwork floats on a pool of its own
 * rarity colour, with the rarity itself stated as a hairline along the bottom
 * edge. That bar is the only place rarity is spelled out in colour, which keeps
 * six new hues from leaking into a palette where yellow is the signal.
 */
export function Inventory({ items }: { items: InventoryItem[] }) {
  if (items.length === 0) {
    return (
      <div className="grid place-items-center rounded-2xl well px-6 py-12 text-center">
        <Package className="size-7 text-ink-faint" />
        <p className="mt-3 text-sm font-semibold text-ink">Інвентар порожній</p>
        <p className="mt-1 max-w-[36ch] text-xs text-ink-subtle">
          Предмети з розіграшів і магазину з’являться тут.
        </p>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((item) => {
        const r = RARITY[item.rarity];
        return (
          <li
            key={item.id}
            className="lift surface-1 group relative flex flex-col overflow-hidden rounded-2xl"
          >
            {/* The alcove: the item's own rarity light pooled behind it. */}
            <div
              className="relative grid aspect-[4/3] place-items-center overflow-hidden"
              style={{
                background: `radial-gradient(78% 88% at 50% 108%, color-mix(in oklch, ${r.color} 30%, var(--surface)), var(--surface) 72%)`,
              }}
            >
              {item.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.image}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="max-h-[78%] max-w-[86%] object-contain transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
                />
              ) : (
                <Package className="size-8 text-ink-faint" />
              )}
            </div>

            {/* Rarity as a hairline, the way the game itself marks it. */}
            <span
              aria-hidden
              className="h-[3px] w-full shrink-0"
              style={{ background: r.color }}
            />

            <div className="flex flex-1 flex-col gap-0.5 px-3 py-2.5">
              <p className="truncate text-sm font-bold tracking-tight text-ink">
                {item.name}
              </p>
              <p className="flex items-center gap-1.5 text-[0.6875rem] text-ink-subtle">
                <span className="truncate" style={{ color: r.color }}>
                  {r.label}
                </span>
                {item.wear && (
                  <>
                    <span className="text-ink-faint">·</span>
                    <span className="truncate">{item.wear}</span>
                  </>
                )}
              </p>
              <p
                className={cn(
                  "mt-1 flex items-center justify-between gap-2 text-[0.6875rem] text-ink-dim",
                )}
              >
                <span className="truncate">{item.source ?? "Розіграш"}</span>
                <span className="tnum shrink-0">{obtainedLabel(item.obtainedISO)}</span>
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

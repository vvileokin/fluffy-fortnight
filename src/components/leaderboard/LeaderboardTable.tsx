import { ChevronUp, ChevronDown, Minus, Flame } from "lucide-react";
import { formatInt } from "@/lib/utils";
import { type LeaderRow } from "@/lib/data";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";

function RankMedal({ rank }: { rank: number }) {
  const styles: Record<number, string> = {
    1: "text-tier1",
    2: "text-ink",
    3: "text-warning",
  };
  return (
    <span
      className={cn(
        "tnum font-mono text-sm font-bold",
        styles[rank] ?? "text-ink-subtle",
      )}
    >
      {rank}
    </span>
  );
}

function Delta({ delta }: { delta?: number }) {
  if (delta === undefined || delta === 0)
    return <Minus className="size-3 text-ink-faint" />;
  if (delta > 0)
    return (
      <span className="flex items-center text-success">
        <ChevronUp className="size-3" />
        <span className="tnum text-[0.625rem] font-bold">{delta}</span>
      </span>
    );
  return (
    <span className="flex items-center text-danger">
      <ChevronDown className="size-3" />
      <span className="tnum text-[0.625rem] font-bold">{Math.abs(delta)}</span>
    </span>
  );
}

function Row({ row, showCorrect }: { row: LeaderRow; showCorrect: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 transition-colors",
        row.isYou
          ? "bg-[color-mix(in_oklch,var(--accent)_10%,transparent)]"
          : "hover:bg-surface-2",
      )}
    >
      <span className="grid w-6 shrink-0 place-items-center">
        <RankMedal rank={row.rank} />
      </span>
      <span className="w-5 shrink-0">
        <Delta delta={row.delta} />
      </span>
      <Avatar name={row.handle} src={row.avatarUrl} size="sm" ring={row.isYou} />
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-sm font-semibold",
          row.isYou ? "text-accent" : "text-ink",
        )}
      >
        {row.handle}
        {row.isYou && (
          <span className="ml-1.5 text-[0.625rem] font-bold uppercase tracking-wide text-ink-subtle">
            це ти
          </span>
        )}
      </span>
      <span className="hidden w-9 shrink-0 items-center justify-end gap-0.5 text-xs text-warning sm:flex">
        {row.streak > 0 && (
          <>
            <Flame className="size-3.5" />
            <span className="tnum font-semibold">{row.streak}</span>
          </>
        )}
      </span>
      {showCorrect && (
        <span className="tnum hidden w-24 shrink-0 text-right text-xs text-ink-muted sm:block">
          {row.correct}
          <span className="text-ink-subtle"> вірних</span>
        </span>
      )}
      <span className="tnum w-20 shrink-0 text-right font-mono text-sm font-bold text-accent">
        {formatInt(row.points)}
      </span>
    </div>
  );
}

export function LeaderboardTable({
  rows,
  showCorrect = true,
  className,
}: {
  rows: LeaderRow[];
  showCorrect?: boolean;
  className?: string;
}) {
  const you = rows.find((r) => r.isYou);
  const rest = rows.filter((r) => !r.isYou);
  const gap = you && you.rank > (rest.at(-1)?.rank ?? 0) + 1;

  return (
    <div
      className={cn(
        "divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface",
        className,
      )}
    >
      {rest.map((row) => (
        <Row key={row.handle} row={row} showCorrect={showCorrect} />
      ))}
      {you && (
        <>
          {gap && (
            <div className="flex items-center justify-center py-1 text-ink-faint">
              <span className="text-xs tracking-widest">· · ·</span>
            </div>
          )}
          <Row row={you} showCorrect={showCorrect} />
        </>
      )}
    </div>
  );
}

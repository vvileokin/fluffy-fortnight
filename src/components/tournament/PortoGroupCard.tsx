"use client";

import * as React from "react";
import { Link } from "@/i18n/navigation";
import { ArrowUp, Check, Loader2, Lock, LogIn, Pencil, X } from "lucide-react";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { BrandIcon } from "@/components/ui/BrandIcon";
import { useUser } from "@/lib/supabase/use-user";
import { getTeam } from "@/lib/data";
import {
  PORTO_GROUP_MAX,
  PORTO_GROUP_SCORING,
  PORTO_GROUP_SIZES,
} from "@/lib/porto-groups";
import { cn, formatInt } from "@/lib/utils";

type Mine = { advance: string[]; zeroTwo: string[]; points: number; scored: boolean };
type Api = {
  signedIn: boolean;
  open: Record<string, boolean>;
  teams: Record<string, string[]>;
  mine: Record<string, Mine>;
};

const GROUPS = [
  { id: "a", label: "Група A", day: "26 серпня" },
  { id: "b", label: "Група B", day: "27 серпня" },
];

/**
 * Impeccable: Crafted 0-2 Club — the one call nobody else asks for.
 *
 * Every predictor on every site asks who goes through. A GSL group answers a
 * second question at the same time, and it is the harder one: two of the eight
 * go home without winning a series at all. Knowing who is good is not enough —
 * you have to know who is brittle. So the card asks for both, and a collapse
 * pays double a qualification.
 *
 * Each group locks on its own first match rather than on the event, because
 * they are played a day apart: one blanket lock would either shut B early or
 * take picks on A while A is being played.
 */
export function PortoGroupCard() {
  const user = useUser();
  const [data, setData] = React.useState<Api | null>(null);
  const [nonce, setNonce] = React.useState(0);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/porto-group", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.ok) setData(d);
        else setFailed(true);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [user, nonce]);

  return (
    <div className="skin-aura-card space-y-3 rounded-xl p-3 sm:p-4">
      {/* The heading and the sentence explaining it are one block, so they take
          a tighter gap than the panel's own rhythm. At the container's 12px
          they read as two separate announcements — a title floating over an
          unrelated paragraph — when the second is simply the first said in
          full. The 12px stays where it belongs: between this pair and the
          groups below. */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          {/* The tab above already says "Клуб 0-2", so the panel says which
              groups it covers instead of repeating the name back. */}
          <p className="text-sm font-extrabold tracking-tight text-white">Дві групи</p>
          <span className="tnum flex shrink-0 items-center gap-1 text-xs font-bold text-[rgb(var(--skin-ring))]">
            до {formatInt(PORTO_GROUP_MAX * GROUPS.length)}
            <BrandIcon name="points-porto" className="size-3.5" />
          </span>
        </div>
        <p className="text-xs leading-relaxed text-white/55">
          З восьми виходять троє, а двоє їдуть додому без жодної перемоги. Назви
          і тих, і тих: {PORTO_GROUP_SCORING.advance} за вихід,{" "}
          <span className="font-semibold text-white/75">
            {PORTO_GROUP_SCORING.zeroTwo} за виліт
          </span>{" "}
          — і {PORTO_GROUP_SCORING.perfect} зверху, якщо вся група в яблучко.
        </p>
      </div>

      {failed ? (
        <Note>Не вдалося завантажити. Онови сторінку.</Note>
      ) : !data ? (
        <Note>Завантажуємо…</Note>
      ) : !data.signedIn ? (
        <Link
          href="/login"
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[rgb(var(--skin-ring))] text-sm font-bold text-black transition-opacity hover:opacity-90"
        >
          <LogIn className="size-4" strokeWidth={2.5} />
          Увійти, щоб зіграти
        </Link>
      ) : (
        GROUPS.map((g) => (
          <GroupBlock
            key={g.id}
            group={g}
            teams={data.teams[g.id] ?? []}
            open={!!data.open[g.id]}
            mine={data.mine[g.id]}
            onSaved={() => setNonce((n) => n + 1)}
          />
        ))
      )}
    </div>
  );
}

function GroupBlock({
  group,
  teams,
  open,
  mine,
  onSaved,
}: {
  group: { id: string; label: string; day: string };
  teams: string[];
  open: boolean;
  mine?: Mine;
  onSaved: () => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [advance, setAdvance] = React.useState<string[]>([]);
  const [zeroTwo, setZeroTwo] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const filled = !!mine && !editing;

  function start() {
    setAdvance(mine ? [...mine.advance] : []);
    setZeroTwo(mine ? [...mine.zeroTwo] : []);
    setError(null);
    setEditing(true);
  }

  /**
   * One tap cycles a team through the three states it can be in.
   *
   * Two separate lists with two separate pickers is the obvious build and the
   * wrong one: the same eight names would appear twice, and the rule that a
   * team can't be in both would have to be explained. Cycling makes the rule
   * structural — a name holds one state at a time because there is only one of
   * it on screen.
   */
  function cycle(slug: string) {
    if (advance.includes(slug)) {
      setAdvance((v) => v.filter((s) => s !== slug));
      if (zeroTwo.length < PORTO_GROUP_SIZES.zeroTwo) setZeroTwo((v) => [...v, slug]);
      return;
    }
    if (zeroTwo.includes(slug)) {
      setZeroTwo((v) => v.filter((s) => s !== slug));
      return;
    }
    if (advance.length < PORTO_GROUP_SIZES.advance) setAdvance((v) => [...v, slug]);
    else if (zeroTwo.length < PORTO_GROUP_SIZES.zeroTwo) setZeroTwo((v) => [...v, slug]);
  }

  const ready =
    advance.length === PORTO_GROUP_SIZES.advance &&
    zeroTwo.length === PORTO_GROUP_SIZES.zeroTwo;

  async function save() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/porto-group", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ group: group.id, picks: { advance, zeroTwo } }),
    });
    const out = await res.json().catch(() => ({}));
    setBusy(false);
    if (!out.ok) {
      setError(
        out.error === "closed"
          ? "Група вже почалася."
          : out.error === "scored"
            ? "Групу вже розраховано."
            : "Не вдалося зберегти.",
      );
      return;
    }
    setEditing(false);
    onSaved();
  }

  return (
    <div className="rounded-lg bg-black/25 p-3 shadow-[inset_0_0_0_1px_rgb(var(--skin-ring)/0.16)]">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-white/70">
          {group.label}
        </span>
        <span className="text-[0.6875rem] text-white/40">
          {mine?.scored
            ? `+${formatInt(mine.points)}`
            : open
              ? `до ${group.day}`
              : "прийом закрито"}
        </span>
      </div>

      {filled ? (
        <>
          <Filled advance={mine!.advance} zeroTwo={mine!.zeroTwo} />
          {open && !mine!.scored && (
            <button
              onClick={start}
              className="mt-2.5 flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-white/[0.06] text-xs font-semibold text-white/80 transition-colors hover:bg-white/[0.12]"
            >
              <Pencil className="size-3.5" />
              Змінити
            </button>
          )}
        </>
      ) : !open ? (
        <p className="flex items-center gap-2 py-1 text-xs text-white/45">
          <Lock className="size-3.5 shrink-0" />
          Група вже грає — прийом прогнозів закрито.
        </p>
      ) : !editing ? (
        <button
          onClick={start}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[rgb(var(--skin-ring))] text-sm font-bold text-black transition-opacity hover:opacity-90"
        >
          Заповнити
        </button>
      ) : (
        <>
          {/* The two counters are the instructions. A line of prose telling you
              to pick three and two would say the same thing and go unread; a
              counter that moves as you tap says it while you are doing it. */}
          {/* Lit and struck out, not green and red.

              Two opposite states in one event palette cannot be told apart by
              hue — scarlet against scarlet is one colour. So the event's colour
              marks who *survives*, and being crossed out marks who doesn't,
              which is the same language the veto ledger on this site already
              speaks: a picked map is lit, a banned one is drained and struck
              through. It also happens to be literal — "виліт 0-2" is a team
              crossed off the tournament. */}
          <div className="mb-2 flex items-center gap-3 text-[0.6875rem] font-semibold">
            <span className="flex items-center gap-1.5 text-[rgb(var(--skin-ring))]">
              <ArrowUp className="size-3.5" strokeWidth={3} />
              Вийдуть {advance.length}/{PORTO_GROUP_SIZES.advance}
            </span>
            {/* The labels are a pair, so they stay one colour at two
                intensities. Striking the heading was wrong — a heading is not a
                team, and crossing it out read as "this section is disabled".
                The strike belongs on the names underneath, which is where it
                means something. */}
            <span className="flex items-center gap-1.5 text-[rgb(var(--skin-ring)/0.55)]">
              <X className="size-3.5" strokeWidth={3} />
              Виліт 0-2 {zeroTwo.length}/{PORTO_GROUP_SIZES.zeroTwo}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {teams.map((slug) => {
              const t = getTeam(slug);
              const isUp = advance.includes(slug);
              const isOut = zeroTwo.includes(slug);
              return (
                <button
                  key={slug}
                  onClick={() => cycle(slug)}
                  aria-pressed={isUp || isOut}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-semibold transition-colors",
                    // The plate carries the event's colour, the name stays
                    // white. Colouring both made a scarlet word on a scarlet
                    // field — one hue, low contrast, and eight of them in a
                    // grid read as a single red block rather than as choices.
                    isUp
                      ? "bg-[rgb(var(--skin-ring)/0.22)] text-white shadow-[inset_0_0_0_1px_rgb(var(--skin-ring)/0.6)]"
                      : isOut
                        ? "bg-black/45 text-white/35 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)]"
                        : "bg-black/30 text-white/70 hover:bg-black/45",
                  )}
                >
                  <span className={cn("shrink-0", isOut && "opacity-45 grayscale")}>
                    <TeamLogo team={t} size="xs" />
                  </span>
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate",
                      isOut && "line-through decoration-white/40",
                    )}
                  >
                    {t.name}
                  </span>
                  {/* An arrow and a cross, not a trophy and a skull. At 12px a
                      trophy is a blob and a skull is a smudge — both were being
                      read as some third icon. Up means through and a cross
                      means crossed off, which is what the strikethrough beside
                      it already says. */}
                  {isUp && (
                    <ArrowUp
                      className="size-3.5 shrink-0 text-[rgb(var(--skin-ring))]"
                      strokeWidth={3}
                    />
                  )}
                  {isOut && <X className="size-3.5 shrink-0 text-white/30" strokeWidth={3} />}
                </button>
              );
            })}
          </div>

          {error && (
            <p role="alert" className="mt-2 text-center text-xs font-semibold text-danger">
              {error}
            </p>
          )}

          <div className="mt-2.5 flex gap-2">
            <button
              onClick={() => setEditing(false)}
              className="h-10 flex-1 rounded-lg bg-white/[0.06] text-xs font-semibold text-white/70 transition-colors hover:bg-white/[0.12]"
            >
              Скасувати
            </button>
            <button
              onClick={save}
              disabled={!ready || busy}
              className={cn(
                "flex h-10 flex-[2] items-center justify-center gap-2 rounded-lg text-sm font-bold transition-opacity",
                "bg-[rgb(var(--skin-ring))] text-black hover:opacity-90",
                "disabled:cursor-not-allowed disabled:bg-white/[0.08] disabled:text-white/35",
              )}
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              Підтвердити
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** A submitted card, read-only. */
function Filled({ advance, zeroTwo }: { advance: string[]; zeroTwo: string[] }) {
  const rows = [
    { label: "Вийдуть", teams: advance, out: false, tone: "text-[rgb(var(--skin-ring))]" },
    { label: "Виліт 0-2", teams: zeroTwo, out: true, tone: "text-[rgb(var(--skin-ring)/0.55)]" },
  ];
  return (
    <div className="space-y-1.5">
      {rows.map((r) => (
        <div key={r.label} className="flex items-start gap-2">
          <span
            className={cn(
              "w-16 shrink-0 pt-1 text-[0.625rem] font-bold uppercase tracking-wide",
              r.tone,
            )}
          >
            {r.label}
          </span>
          <div className="flex flex-wrap gap-1">
            {r.teams.map((slug) => {
              const t = getTeam(slug);
              return (
                <span
                  key={slug}
                  className={cn(
                    "flex items-center gap-1 rounded px-1.5 py-1 text-[0.6875rem] font-semibold",
                    r.out
                      ? "bg-black/45"
                      : "bg-[rgb(var(--skin-ring)/0.22)] shadow-[inset_0_0_0_1px_rgb(var(--skin-ring)/0.5)]",
                    r.out ? "text-white/35" : "text-white",
                  )}
                >
                  <span className={cn("shrink-0", r.out && "opacity-45 grayscale")}>
                    <TeamLogo team={t} size="xs" />
                  </span>
                  <span className={cn(r.out && "line-through decoration-white/35")}>
                    {t.name}
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 rounded-lg bg-black/25 px-3 py-3 text-xs text-white/50">
      <Check className="size-3.5 shrink-0 opacity-0" />
      {children}
    </p>
  );
}

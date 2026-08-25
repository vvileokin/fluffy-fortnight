"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { getTeam, matchTimeLabel, type Match } from "@/lib/data";
import { cn, formatInt } from "@/lib/utils";

/**
 * Impeccable: Crafted Challenge — thrown at a person, from where you saw them.
 *
 * The leaderboard is the one page that already answers "who is above me", so it
 * is where a challenge belongs: you are not looking for a fixture to bet on,
 * you are looking at somebody you want to beat. The fixture is the second
 * question, and it is asked here.
 *
 * A named challenge takes any amount, unlike the open board's four tiers. The
 * tiers exist so an unanswered challenge can *find* a pair — 137 never meets
 * 140 — and that problem does not exist when you are asking one person who
 * either accepts or does not.
 */
export function ChallengeDialog({
  open,
  onClose,
  target,
  matches,
}: {
  open: boolean;
  onClose: () => void;
  target: { id: string; handle: string } | null;
  /** Porto fixtures; only the ones not yet started can be challenged on. */
  matches: Match[];
}) {
  const upcoming = React.useMemo(
    () => matches.filter((m) => m.status === "upcoming").slice(0, 8),
    [matches],
  );

  const [matchId, setMatchId] = React.useState<string | null>(null);
  const [side, setSide] = React.useState<"a" | "b" | null>(null);
  const [stake, setStake] = React.useState("100");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);
  /**
   * A duel commits points to somebody else the instant it is sent, and it
   * cannot be undone once they accept. One misread tap already cost two players
   * a stake each and had to be reversed by hand — so the last press states who
   * and how much, in words, and asks again.
   */
  const [confirming, setConfirming] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setMatchId(null);
    setSide(null);
    setStake("100");
    setError(null);
    setDone(false);
    setConfirming(false);
  }, [open, target?.id]);

  const match = upcoming.find((m) => m.id === matchId) ?? null;
  const amount = Number(stake || 0);
  const ready = !!match && !!side && amount >= 1;

  const REFUSAL: Record<string, string> = {
    insufficient: "Не вистачає поінтів",
    already_in: "У тебе вже є дуель на цей матч",
    too_many_open: "Забагато відкритих викликів — максимум три",
    started: "Матч уже почався",
    self: "Це ти",
  };

  async function send() {
    if (!match || !side || !target) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/duels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ match: match.id, side, stake: amount, opponent: target.id }),
    });
    const out = await res.json().catch(() => ({}));
    setBusy(false);
    if (!out.ok) {
      setError(REFUSAL[out.error as string] ?? "Не вдалося");
      return;
    }
    setDone(true);
  }

  return (
    <Modal open={open} onClose={onClose} title={`Виклик · ${target?.handle ?? ""}`}>
      {/* The dialog is opened from Porto's board about a Porto fixture, so it
          wears the event. `data-skin` sits here rather than on a parent because
          a modal renders into its own tree, outside the page that declares the
          palette — without it every token would fall back to the World Cup. */}
      <div data-skin="porto">
      {done ? (
        <p className="rounded-xl bg-success/10 px-3 py-4 text-center text-sm font-bold text-success">
          Виклик надіслано. {target?.handle} побачить його на матчі.
        </p>
      ) : upcoming.length === 0 ? (
        <p className="rounded-xl bg-black/30 px-3 py-4 text-center text-sm text-white/50">
          Немає матчів, які ще не почались.
        </p>
      ) : (
        <div className="space-y-3">
          <Field label="Матч">
            <div className="space-y-1.5">
              {upcoming.map((m) => {
                const a = getTeam(m.a);
                const b = getTeam(m.b);
                const on = m.id === matchId;
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      setMatchId(m.id);
                      setSide(null);
                      setConfirming(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition-colors",
                      on
                        ? "bg-[rgb(var(--skin-ring)/0.22)] text-white shadow-[inset_0_0_0_1px_rgb(var(--skin-ring)/0.6)]"
                        : "bg-black/30 text-white/70 hover:bg-black/45",
                    )}
                  >
                    <TeamLogo team={a} size="xs" />
                    <TeamLogo team={b} size="xs" />
                    <span className="min-w-0 flex-1 truncate">
                      {a.tag} — {b.tag}
                    </span>
                    <span className="shrink-0 text-[0.6875rem] font-normal text-white/40">
                      {matchTimeLabel(m)}
                    </span>
                  </button>
                );
              })}
            </div>
          </Field>

          {/* The side is only askable once there is a match to have sides. */}
          {match && (
            <Field label="Твій бік">
              <div className="grid grid-cols-2 gap-2">
                {(["a", "b"] as const).map((s) => {
                  const t = getTeam(s === "a" ? match.a : match.b);
                  return (
                    <button
                      key={s}
                      onClick={() => {
                        setSide(s);
                        setConfirming(false);
                      }}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition-colors",
                        side === s
                          ? "bg-[rgb(var(--skin-ring)/0.22)] text-white shadow-[inset_0_0_0_1px_rgb(var(--skin-ring)/0.6)]"
                          : "bg-black/30 text-white/70 hover:bg-black/45",
                      )}
                    >
                      <TeamLogo team={t} size="xs" />
                      <span className="min-w-0 flex-1 truncate">{t.name}</span>
                    </button>
                  );
                })}
              </div>
            </Field>
          )}

          <Field label="Ставка">
            <input
              type="text"
              inputMode="numeric"
              value={stake}
              onChange={(e) => {
                setStake(e.target.value.replace(/\D/g, "").slice(0, 6));
                setConfirming(false);
              }}
              // Forced off, like every other numeric field on the site: the
              // site-wide focus ring is an offset outline meant for controls on
              // flat ground, and on a bordered input it doubles the frame.
              className="tnum h-11 w-full rounded-xl bg-black/30 px-3 font-mono text-sm font-bold text-white shadow-[inset_0_0_0_1px_rgb(var(--skin-ring)/0.2)] outline-none focus:shadow-[inset_0_0_0_1px_rgb(var(--skin-ring)/0.6)] focus-visible:rounded-xl! focus-visible:outline-none!"
            />
          </Field>

          {error && (
            <p role="alert" className="text-center text-xs font-semibold text-danger">
              {error}
            </p>
          )}

          {confirming && match && side && (
            <p className="rounded-xl bg-[rgb(var(--skin-ring)/0.12)] px-3 py-2.5 text-center text-xs leading-relaxed text-white shadow-[inset_0_0_0_1px_rgb(var(--skin-ring)/0.35)]">
              Кинути виклик <b>{target?.handle}</b> на{" "}
              <b>{getTeam(side === "a" ? match.a : match.b).name}</b> за{" "}
              <b>{formatInt(amount)}</b>? Поінти зарезервуються одразу.
            </p>
          )}

          <button
            onClick={() => (confirming ? send() : setConfirming(true))}
            disabled={!ready || busy}
            className={cn(
              "flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold transition-colors",
              "bg-[rgb(var(--skin-ring))] text-black hover:brightness-110",
              "disabled:cursor-not-allowed disabled:bg-white/[0.08] disabled:text-white/35",
            )}
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {!ready
              ? "Обери матч і бік"
              : confirming
                ? "Так, кидаю"
                : `Кинути виклик · ${formatInt(amount)}`}
          </button>
        </div>
      )}
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="mb-1.5 block text-xs font-semibold text-white/55">{label}</span>
      {children}
    </div>
  );
}

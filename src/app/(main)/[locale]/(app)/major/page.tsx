import type { Metadata } from "next";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { MajorMode } from "@/components/major/MajorMode";
import { findTeam } from "@/lib/data";
import {
  getMajorProjection, regionTeams, ourTeams, stageOf,
  type MajorTeam, type MajorRegion, type MajorSlots,
} from "@/lib/db/major";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Інвайти на мейджор",
  description: "Хто отримає запрошення на PGL Major Singapore за очками VRS.",
};

/** One decimal, always. "70%" and "70.3%" are different claims, and rounding a
 *  bubble team to the nearest whole point hides the movement the page is for. */
const pct = (v: number) => (v * 100).toFixed(1) + "%";

const REGION_NAME: Record<MajorRegion, string> = {
  europe: "Європа", americas: "Америка", asia: "Азія",
};
/** How deep each region is worth showing. Below these the chance is a rounding
 *  error and the rows are only length. */
const DEPTH: Record<MajorRegion, number> = { europe: 32, americas: 16, asia: 14 };

/**
 * One hue, four weights.
 *
 * The percentages were white, which said nothing, and before that they were on
 * a green-gold-amber-red scale, which said four things at once in four hues
 * that belong to other parts of this product. This is the event's own red at
 * four strengths: full for a side that is going, dimmed to ink for one that is
 * not. The ramp reads as one material rather than a traffic light.
 */
const tone = (p: number) =>
  p >= 0.85 ? "var(--major-hot)"
  : p >= 0.5 ? "var(--major)"
  : p >= 0.2 ? "color-mix(in oklch, var(--major) 62%, var(--ink-faint))"
  : "var(--ink-faint)";

export default async function MajorPage() {
  const data = await getMajorProjection();

  if (!data) {
    return (
      <div className="rounded-2xl surface-1 px-6 py-12 text-center">
        <MajorMode />
        <p className="text-sm text-ink-subtle">Прогноз ще не опублікований. Заходь пізніше.</p>
      </div>
    );
  }

  const { meta } = data;
  const ours = ourTeams(data);

  return (
    <div className="space-y-5 sm:space-y-6">
      <MajorMode />

      {/* The three sides, and no plate around them.
          The banner underneath was a second object saying the same thing the
          rows already said, and with it gone the rows can take the room it was
          using — a 56px crest, the name at 20px, and the split spelled out.
          Desktop only: on a phone the standings start immediately. */}
      {ours.length > 0 && (
        <section className="major-plate major-divide hidden overflow-hidden rounded-2xl sm:block">
          {ours.map((t) => (
            <OurRow key={t.region + t.team} t={t} slots={meta.slots[t.region]} />
          ))}
        </section>
      )}

      {/* Two columns, not three. Three put every table at 225px, which is not
          enough for a rank, a crest, a name, a stage and a number — "THUNDER
          dOWNUNDER" came out as "Thund…". Europe has twice the rows of either
          other region, so it takes a column of its own and the other two stack
          beside it, which lands the two sides at about the same height. */}
      {/* The two columns end on the same line.
          Europe carries thirty-two rows and the other two regions thirty
          between them, so the sides never come out equal on their own — one
          panel stopped short and left a band of page under it, which reads as
          something missing rather than as a shorter list. The grid stretches
          both to the taller, and Asia takes up whatever slack is left, so its
          floor lands exactly where Europe's does. */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RegionTable data={data} region="europe" />
        <div className="flex min-h-0 flex-col gap-6">
          <RegionTable data={data} region="americas" />
          <div className="flex-1">
            <RegionTable data={data} region="asia" fill />
          </div>
        </div>
      </section>

    </div>
  );
}

/**
 * One Ukrainian side, given the room the page is named after.
 *
 * The crest is 44px rather than 28: at the smaller size it sat inside its row
 * like a bullet point, and these three rows are the reason anybody opens this.
 */
function OurRow({ t, slots }: { t: MajorTeam & { place: number }; slots: MajorSlots }) {
  const team = findTeam(t.slug);
  const stage = stageOf(t.place, slots);
  /* The three stage chances sum to the qualification chance — they are the same
     number split by where a team enters. So they are one bar, not a bar and a
     caption: the length is the chance of going at all and the segments are what
     that seat would be worth. */
  /* One red, three depths.
     Transparency was the first mistake — a red at 34% alpha over a red plate is
     the plate, so the last segment vanished and the bar looked like it stopped
     early. Mixing toward white was the second: warm red plus white in oklch
     lands on beige, which belongs to no part of this page.
     So the ramp only ever goes down, and never leaves the hue. The brightest
     segment is the seat worth most, and the deepest is still four times lighter
     than the plate it sits on. */
  const seg = [
    { key: 3, p: t.p3, color: "var(--major-hot)" },
    { key: 2, p: t.p2, color: "color-mix(in oklch, var(--major) 86%, black)" },
    { key: 1, p: t.p1, color: "color-mix(in oklch, var(--major) 58%, black)" },
  ];

  return (
    /* Three lines on a phone, not seven.
       The crest, the name and the headline number share the top line; the bar
       and its split sit under them at full width. Laid out as crest | column |
       number, the middle column was ~150px on a 390px screen and the legend
       wrapped to three rows, which made one team as tall as a card. */
    <div className="px-4 py-4 sm:px-5 sm:py-5">
      <div className="flex items-center gap-3 sm:gap-4">
        {team ? (
          <TeamLogo team={team} size="lg" />
        ) : (
          <span className="size-14 shrink-0 rounded-xl bg-white/10" />
        )}
        <p className="min-w-0 flex-1 truncate text-xl font-bold text-white">{t.team}</p>
        <StageChip stage={stage} place={t.place} />
        <span
          className="tnum shrink-0 font-mono text-2xl font-bold leading-none"
          style={{ color: tone(t.pQual) }}
        >
          {pct(t.pQual)}
        </span>
      </div>

      {/* The empty remainder is a recessed slot, not a pale wash. A white film
          over a red plate reads as a fourth segment; a dark well reads as the
          part that isn't filled. */}
      <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-black/35 shadow-[0_1px_0_0_rgb(255_255_255/0.06)_inset]">
        {seg.map((s) => (
          <span
            key={s.key}
            title={`Stage ${s.key} — ${pct(s.p)}`}
            style={{ width: `${s.p * 100}%`, background: s.color }}
          />
        ))}
      </div>

      {/* The legend is the third line of every team on a phone and the bar
          above it already carries the split — so it waits for a screen with
          room. Each segment keeps its tooltip either way. */}
      <div className="mt-2 hidden items-center gap-4 sm:flex">
        {seg.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5 text-xs text-white/50">
            <span
              className="size-1.5 shrink-0 rounded-full"
              style={{ background: s.color }}
            />
            Stage {s.key}
            <span className="tnum font-mono text-white/85">{pct(s.p)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}


/** The stage in words, the way the workbook writes it. */
function StageChip({ stage, place }: { stage: 3 | 2 | 1 | 0; place: number }) {
  if (stage === 0) {
    return (
      <span className="shrink-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[0.625rem] font-bold text-white/40 ring-1 ring-inset ring-white/12">
        {place} місце
      </span>
    );
  }
  return (
    <span
      className="shrink-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[0.625rem] font-bold text-white/90"
      style={{ background: `color-mix(in oklch, var(--major) ${stage === 3 ? 72 : stage === 2 ? 46 : 28}%, transparent)` }}
    >
      Stage {stage}
    </span>
  );
}

/**
 * A region, as deep as it is worth reading.
 *
 * Thirty-two in Europe, sixteen in the Americas, twelve in Asia — roughly twice
 * the seats on offer, which covers everyone with a real claim and stops before
 * the rows become filler. Showing the whole pool was worse than showing a
 * window: a hundred and twenty lines of sub-one-percent is not more honest, it
 * is just longer.
 *
 * The stage is written out rather than drawn. Three ticks were compact and
 * unreadable — the workbook says "Stage 3" and so does this.
 */
function RegionTable({
  data, region, fill = false,
}: {
  data: NonNullable<Awaited<ReturnType<typeof getMajorProjection>>>;
  region: MajorRegion;
  /** Grow to whatever height the column gives it, so the two columns share a
   *  bottom edge. The rows stay at the top; the panel simply continues. */
  fill?: boolean;
}) {
  const slots = data.meta.slots[region];
  const rows = regionTeams(data, region).slice(0, DEPTH[region]);

  return (
    /* The table is an object, not a list on the page: a lit rim, a header that
       names the columns, and rows that respond to a cursor. Without those it
       was three hundred lines of text on a dark ground, which is what "too
       dark" actually means — not the colour, the absence of anything to look
       at. */
    <div className={cn("overflow-hidden rounded-2xl major-card", fill && "h-full")}>
      <h2 className="px-3 pb-2 pt-3 text-base font-bold text-ink">{REGION_NAME[region]}</h2>
      <div className="divide-y divide-[color-mix(in_oklch,var(--ink)_6%,transparent)]">
        {rows.map((t, i) => {
          // The place is this list's own, so the number on the left, the stage
          // badge and the cut below all agree with the order the rows are in.
          const place = i + 1;
          const stage = stageOf(place, slots);
          const team = findTeam(t.slug);
          return (
            <div key={t.vrs + t.team + t.projected}>
              <div
                className={cn(
                  "flex items-center gap-2 px-2.5 py-2 text-[0.8125rem] transition-colors duration-150",
                  // Zebra, very quiet. Thirty rows of text on one flat ground
                  // is what reads as emptiness; a half-percent step every other
                  // row gives the column a surface without drawing rules on it.
                  place % 2 === 0 && "bg-white/[0.018]",
                  stage === 0 ? "opacity-55 hover:opacity-80" : "hover:bg-[color-mix(in_oklch,var(--major)_10%,transparent)]",
                )}
              >
                <span className="tnum w-4 shrink-0 text-right font-mono text-[0.6875rem] text-ink-faint">
                  {place}
                </span>
                {team ? (
                  <TeamLogo team={team} size="xs" />
                ) : (
                  <span className="size-5 shrink-0 rounded bg-fill-1" />
                )}
                <span className="min-w-0 flex-1 truncate font-semibold text-ink">{t.team}</span>
                <StageMark stage={stage} />
                <span
                  className="tnum w-[3.25rem] shrink-0 text-right font-mono font-bold"
                  style={{ color: tone(t.pQual) }}
                >
                  {pct(t.pQual)}
                </span>
              </div>
              {place === slots.total && (
                /* The cut, lit rather than ruled. It is the one line on the
                   page where something actually happens, so it gets the
                   event's own light behind it instead of a hairline. */
                <div className="relative flex items-center justify-center bg-[color-mix(in_oklch,var(--major)_16%,transparent)] py-1">
                  <span className="text-[0.625rem] font-bold uppercase tracking-[0.18em] text-[var(--major-hot)]">
                    межа інвайтів
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** "St3" / "St2" / "St1", or nothing when the team is outside the invitations. */
function StageMark({ stage }: { stage: 3 | 2 | 1 | 0 }) {
  if (stage === 0) return <span className="w-8 shrink-0" />;
  return (
    <span
      className="tnum w-8 shrink-0 rounded text-center font-mono text-[0.625rem] font-bold leading-[1.4] text-white/90"
      style={{ background: `color-mix(in oklch, var(--major) ${stage === 3 ? 72 : stage === 2 ? 46 : 28}%, transparent)` }}
    >
      St{stage}
    </span>
  );
}

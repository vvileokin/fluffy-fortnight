/* =========================================================================
   Mock SportsData — realistic demo content for the public front.
   Shapes here mirror what a SportsDataProvider would normalize later.
   Reference "now": 2026-07-12 (Europe/Kyiv).
   ========================================================================= */

export type Region = "EU" | "NA" | "SA" | "Asia" | "Oceania" | "UA";

export type Team = {
  slug: string;
  name: string;
  tag: string;
  logo: string;
  /** Square background color for the logo tile. */
  brand: string;
  /** Silhouette color rendered on the tile: white on dark/saturated, black on light. */
  ink: "white" | "black";
  region: Region;
  worldRank: number;
};

export const teams: Record<string, Team> = {
  b8: { slug: "b8", name: "B8", tag: "B8", logo: "/teams/b8.svg", brand: "#E8B21E", ink: "black", region: "UA", worldRank: 14 },
  natus: { slug: "natus", name: "Natus Vincere", tag: "NAVI", logo: "/teams/natus.svg", brand: "#101319", ink: "white", region: "UA", worldRank: 3 },
  big: { slug: "big", name: "BIG", tag: "BIG", logo: "/teams/big.svg", brand: "#1D1D20", ink: "white", region: "EU", worldRank: 22 },
  betboom: { slug: "betboom", name: "BetBoom Team", tag: "BB", logo: "/teams/betboom.svg", brand: "#FFCC00", ink: "black", region: "EU", worldRank: 12 },
  flyquest: { slug: "flyquest", name: "FlyQuest", tag: "FLY", logo: "/teams/flyquest.svg", brand: "#0A8A3F", ink: "white", region: "Oceania", worldRank: 19 },
  gaimin: { slug: "gaimin", name: "Gaimin Gladiators", tag: "GG", logo: "/teams/gaimin-gladiators.png", brand: "#5A2D91", ink: "white", region: "EU", worldRank: 27 },
  gamerlegion: { slug: "gamerlegion", name: "GamerLegion", tag: "GL", logo: "/teams/gamerlegion.svg", brand: "#D81E27", ink: "white", region: "EU", worldRank: 9 },
  heroic: { slug: "heroic", name: "Heroic", tag: "HER", logo: "/teams/heroic.svg", brand: "#E4002B", ink: "white", region: "EU", worldRank: 16 },
  lynn: { slug: "lynn", name: "Lynn Vision", tag: "LV", logo: "/teams/lynn.svg", brand: "#C1121C", ink: "white", region: "Asia", worldRank: 24 },
  m80: { slug: "m80", name: "M80", tag: "M80", logo: "/teams/m80.svg", brand: "#E7442E", ink: "white", region: "NA", worldRank: 21 },
  mibr: { slug: "mibr", name: "MIBR", tag: "MIBR", logo: "/teams/mibr.svg", brand: "#14213D", ink: "white", region: "SA", worldRank: 18 },
  nrg: { slug: "nrg", name: "NRG", tag: "NRG", logo: "/teams/nrg.png", brand: "#1A1A1A", ink: "white", region: "NA", worldRank: 25 },
  sinners: { slug: "sinners", name: "SINNERS", tag: "SIN", logo: "/teams/sinners.svg", brand: "#C8102E", ink: "white", region: "EU", worldRank: 30 },
  sharks: { slug: "sharks", name: "Sharks", tag: "SHK", logo: "/teams/sharks.svg", brand: "#0B4DA2", ink: "white", region: "SA", worldRank: 33 },
  thunder: { slug: "thunder", name: "THUNDERTDU", tag: "TDU", logo: "/teams/thunderdownunder.png", brand: "#F39200", ink: "black", region: "Oceania", worldRank: 41 },
  liquid: { slug: "liquid", name: "Team Liquid", tag: "TL", logo: "/teams/liquid.svg", brand: "#0A1F44", ink: "white", region: "NA", worldRank: 8 },
  tyloo: { slug: "tyloo", name: "TYLOO", tag: "TY", logo: "/teams/tyloo.png", brand: "#D71920", ink: "white", region: "Asia", worldRank: 17 },

  // --- BLAST Bounty S2 field (top seeds) ---
  vitality: { slug: "vitality", name: "Team Vitality", tag: "VIT", logo: "/teams/vitality.svg", brand: "#F2C200", ink: "black", region: "EU", worldRank: 1 },
  spirit: { slug: "spirit", name: "Team Spirit", tag: "SPT", logo: "/teams/spirit.svg", brand: "#17181C", ink: "white", region: "EU", worldRank: 2 },
  falcons: { slug: "falcons", name: "Falcons", tag: "FLC", logo: "/teams/falcons.svg", brand: "#0E7A3C", ink: "white", region: "EU", worldRank: 4 },
  mouz: { slug: "mouz", name: "MOUZ", tag: "MOUZ", logo: "/teams/mouz.svg", brand: "#DC1E28", ink: "white", region: "EU", worldRank: 5 },
  mongolz: { slug: "mongolz", name: "The MongolZ", tag: "MGZ", logo: "/teams/mongolz.svg", brand: "#17181C", ink: "white", region: "Asia", worldRank: 6 },
  aurora: { slug: "aurora", name: "Aurora", tag: "AUR", logo: "/teams/aurora.svg", brand: "#6A2BD9", ink: "white", region: "EU", worldRank: 7 },
  astralis: { slug: "astralis", name: "Astralis", tag: "AST", logo: "/teams/astralis.svg", brand: "#E11B22", ink: "white", region: "EU", worldRank: 10 },
  furia: { slug: "furia", name: "FURIA", tag: "FUR", logo: "/teams/furia.svg", brand: "#17181C", ink: "white", region: "SA", worldRank: 11 },
  fut: { slug: "fut", name: "FUT Esports", tag: "FUT", logo: "/teams/fut.svg", brand: "#0AA0C8", ink: "white", region: "EU", worldRank: 13 },
  g2: { slug: "g2", name: "G2 Esports", tag: "G2", logo: "/teams/g2.svg", brand: "#17181C", ink: "white", region: "EU", worldRank: 15 },
  nemiga: { slug: "nemiga", name: "Nemiga", tag: "NMG", logo: "/teams/nemiga.svg", brand: "#D81E27", ink: "white", region: "EU", worldRank: 20 },
  magic: { slug: "magic", name: "Magic Esports", tag: "MAG", logo: "/teams/magic.svg", brand: "#7A2BD9", ink: "white", region: "NA", worldRank: 26 },
  pain: { slug: "pain", name: "paiN Gaming", tag: "paiN", logo: "/teams/pain.svg", brand: "#E11B22", ink: "white", region: "SA", worldRank: 23 },
  faze: { slug: "faze", name: "FaZe Clan", tag: "FaZe", logo: "/teams/faze.svg", brand: "#E4002B", ink: "white", region: "EU", worldRank: 28 },
  nip: { slug: "nip", name: "NiP", tag: "NIP", logo: "/teams/nip.svg", brand: "#101319", ink: "white", region: "EU", worldRank: 29 },

  // --- BLAST Bounty S2 field (lower seeds) ---
  wildcard: { slug: "wildcard", name: "Wildcard", tag: "WC", logo: "/teams/wildcard.svg", brand: "#C8901E", ink: "black", region: "NA", worldRank: 34 },
  threedmax: { slug: "threedmax", name: "3DMAX", tag: "3DM", logo: "/teams/threedmax.svg", brand: "#D81E27", ink: "white", region: "EU", worldRank: 35 },
  alliance: { slug: "alliance", name: "Alliance", tag: "ALL", logo: "/teams/alliance.svg", brand: "#0B5FA8", ink: "white", region: "EU", worldRank: 36 },
  gentlemates: { slug: "gentlemates", name: "Gentle Mates", tag: "M8", logo: "", brand: "#E63980", ink: "white", region: "EU", worldRank: 37 },
  hotu: { slug: "hotu", name: "HOTU", tag: "HOTU", logo: "/teams/hotu.svg", brand: "#1D1D20", ink: "white", region: "EU", worldRank: 38 },
  nemesis: { slug: "nemesis", name: "Nemesis", tag: "NEM", logo: "/teams/nemesis.svg", brand: "#1D1D20", ink: "white", region: "EU", worldRank: 39 },
  fokus: { slug: "fokus", name: "Fokus", tag: "FKS", logo: "/teams/fokus.svg", brand: "#17181C", ink: "white", region: "EU", worldRank: 40 },
  nucleartigers: { slug: "nucleartigers", name: "Nuclear TigeRES", tag: "NT", logo: "/teams/nucleartigers.svg", brand: "#E7442E", ink: "white", region: "Asia", worldRank: 42 },
  eyeballers: { slug: "eyeballers", name: "EYEBALLERS", tag: "EYE", logo: "/teams/eyeballers.svg", brand: "#E8C81E", ink: "black", region: "EU", worldRank: 43 },
  hundredthieves: { slug: "hundredthieves", name: "100 Thieves", tag: "100T", logo: "/teams/hundredthieves.svg", brand: "#E4002B", ink: "white", region: "NA", worldRank: 44 },
  og: { slug: "og", name: "OG", tag: "OG", logo: "/teams/og.svg", brand: "#1D1D20", ink: "white", region: "EU", worldRank: 45 },
};

export type Tier = 1 | 2;
export type TournamentStatus = "live" | "upcoming" | "finished";

export type Tournament = {
  slug: string;
  name: string;
  shortName: string;
  tier: Tier;
  status: TournamentStatus;
  startISO: string;
  endISO: string;
  dateLabel: string;
  location: string;
  online: boolean;
  prizeUSD: number;
  teamSlugs: string[];
  format: string;
  accent: string; // subtle cover tint (oklch)
  coverImage?: string; // optional cover photo, recommended 800×300
  isEvent?: boolean; // special featured event (Bounty predictor + neon match skin)
};

const allTournaments: Tournament[] = [
  {
    slug: "pgl-bucharest-2026",
    name: "PGL Bucharest 2026",
    shortName: "PGL Bucharest",
    tier: 1,
    status: "live",
    startISO: "2026-07-08",
    endISO: "2026-07-19",
    dateLabel: "8 – 19 лип",
    location: "Бухарест, Румунія",
    online: false,
    prizeUSD: 1250000,
    teamSlugs: ["natus", "gamerlegion", "liquid", "betboom", "heroic", "big", "tyloo", "mibr"],
    format: "Swiss → Playoffs (BO3)",
    accent: "oklch(0.64 0.235 24)",
    coverImage: "/covers/train.webp",
  },
  {
    slug: "esl-pro-league-s23",
    name: "ESL Pro League Season 23",
    shortName: "ESL Pro S23",
    tier: 1,
    status: "live",
    startISO: "2026-07-01",
    endISO: "2026-07-27",
    dateLabel: "1 – 27 лип",
    location: "Онлайн · EU",
    online: true,
    prizeUSD: 850000,
    teamSlugs: ["natus", "liquid", "gamerlegion", "heroic", "flyquest", "m80", "nrg", "gaimin"],
    format: "Групи → Плейоф",
    accent: "oklch(0.68 0.14 245)",
  },
  {
    slug: "ua-masters-2026",
    name: "Ukraine CS2 Masters 2026",
    shortName: "UA Masters",
    tier: 2,
    status: "upcoming",
    startISO: "2026-07-24",
    endISO: "2026-08-02",
    dateLabel: "24 лип – 2 сер",
    location: "Київ, Україна",
    online: false,
    prizeUSD: 100000,
    teamSlugs: ["b8", "betboom", "sinners", "gaimin", "lynn", "sharks"],
    format: "Double Elim (BO3)",
    accent: "oklch(0.902 0.183 103.5)",
  },
  {
    slug: "iem-cologne-2026",
    name: "IEM Cologne 2026",
    shortName: "IEM Cologne",
    tier: 1,
    status: "upcoming",
    startISO: "2026-08-05",
    endISO: "2026-08-16",
    dateLabel: "5 – 16 сер",
    location: "Кельн, Німеччина",
    online: false,
    prizeUSD: 1000000,
    teamSlugs: ["natus", "liquid", "big", "heroic", "gamerlegion", "tyloo", "mibr", "flyquest"],
    format: "Groups → Playoffs",
    accent: "oklch(0.82 0.13 88)",
    coverImage: "/covers/anubis.webp",
  },
  {
    slug: "blast-spring-2026",
    name: "BLAST Premier Spring Final 2026",
    shortName: "BLAST Spring",
    tier: 1,
    status: "finished",
    startISO: "2026-06-11",
    endISO: "2026-06-15",
    dateLabel: "11 – 15 чер",
    location: "Лондон, Британія",
    online: false,
    prizeUSD: 425000,
    teamSlugs: ["natus", "liquid", "heroic", "gamerlegion"],
    format: "Double Elim",
    accent: "oklch(0.5 0.02 245)",
  },
  {
    slug: "cct-season-3",
    name: "CCT Season 3 Europe",
    shortName: "CCT S3 EU",
    tier: 2,
    status: "upcoming",
    startISO: "2026-07-21",
    endISO: "2026-08-10",
    dateLabel: "21 лип – 10 сер",
    location: "Онлайн · EU",
    online: true,
    prizeUSD: 75000,
    teamSlugs: ["sinners", "gaimin", "b8", "big", "sharks", "thunder"],
    format: "Swiss → BO3",
    accent: "oklch(0.68 0.14 245)",
  },
  {
    slug: "blast-bounty-s2",
    name: "BLAST Bounty Season 2",
    shortName: "BLAST Bounty S2",
    tier: 1,
    status: "upcoming",
    startISO: "2026-07-21",
    endISO: "2026-08-02",
    dateLabel: "21 лип – 2 сер",
    location: "Мальта (LAN-фінал)",
    online: false,
    prizeUSD: 500000,
    teamSlugs: [
      // top seeds
      "vitality", "spirit", "falcons", "mouz", "mongolz", "aurora", "gamerlegion", "astralis",
      "furia", "fut", "g2", "nemiga", "magic", "pain", "faze", "nip",
      // lower seeds
      "wildcard", "threedmax", "heroic", "alliance", "gentlemates", "hotu", "m80", "sinners",
      "nemesis", "fokus", "sharks", "nucleartigers", "eyeballers", "liquid", "hundredthieves", "og",
    ],
    format: "Bounty picks → LAN Playoffs",
    accent: "oklch(0.6 0.25 25)",
    isEvent: true,
  },
];

// Only the BLAST Bounty event is public for now (other events are kept as
// internal demo data and can be re-enabled later).
export const tournaments: Tournament[] = allTournaments.filter(
  (t) => t.slug === "blast-bounty-s2",
);

/* --- BLAST Bounty S2: seeds & bounty stages --- */

export const bountyHighSeeds = [
  "vitality", "spirit", "falcons", "mouz", "mongolz", "aurora", "gamerlegion", "astralis",
  "furia", "fut", "g2", "nemiga", "magic", "pain", "faze", "nip",
];

export const bountyLowSeeds = [
  "wildcard", "threedmax", "heroic", "alliance", "gentlemates", "hotu", "m80", "sinners",
  "nemesis", "fokus", "sharks", "nucleartigers", "eyeballers", "liquid", "hundredthieves", "og",
];

export type BountyStage = {
  id: string;
  title: string;
  phase: "online" | "lan";
  kind: "picks" | "bracket";
  reward: number;
  pairCount: number;
  note: string;
  /** Locked until the previous stage resolves — teams show as TBD, admin unlocks. */
  locked: boolean;
};

export const bountyStages: BountyStage[] = [
  {
    id: "r1",
    title: "Раунд 1 · Bounty",
    phase: "online",
    kind: "picks",
    reward: 60,
    pairCount: 16,
    note: "16 нижчих сідів обирають суперника серед 16 вищих. Вгадай кожну пару.",
    locked: false,
  },
  {
    id: "r2",
    title: "Раунд 2 · Bounty",
    phase: "online",
    kind: "picks",
    reward: 90,
    pairCount: 8,
    note: "8 нижчих сідів пікають серед 8 вищих, що пройшли далі.",
    locked: true,
  },
  {
    id: "qf",
    title: "Чвертьфінали · LAN",
    phase: "lan",
    kind: "picks",
    reward: 130,
    pairCount: 4,
    note: "Офлайн на Мальті: нижчий сід обирає суперника серед вищих.",
    locked: true,
  },
  {
    id: "sf",
    title: "Півфінали та фінал",
    phase: "lan",
    kind: "bracket",
    reward: 200,
    pairCount: 2,
    note: "Півфінали пікаються навхрест, фінал формується системою.",
    locked: true,
  },
];

export type MatchStatus = "live" | "upcoming" | "finished";
export type MatchFormat = "BO1" | "BO3" | "BO5";

export type Match = {
  id: string;
  tournamentSlug: string;
  a: string; // team slug
  b: string;
  status: MatchStatus;
  format: MatchFormat;
  startISO: string;
  timeLabel: string;
  scoreA: number;
  scoreB: number;
  // live map context
  liveMapLabel?: string;
  liveRoundA?: number;
  liveRoundB?: number;
  openQuestions: number;
  maxReward: number;
  stage: string;
};

const allMatches: Match[] = [
  {
    id: "m-navi-gl",
    tournamentSlug: "pgl-bucharest-2026",
    a: "natus",
    b: "gamerlegion",
    status: "live",
    format: "BO3",
    startISO: "2026-07-12T15:00:00Z",
    timeLabel: "LIVE",
    scoreA: 1,
    scoreB: 0,
    liveMapLabel: "Mirage · 2 карта",
    liveRoundA: 11,
    liveRoundB: 8,
    openQuestions: 4,
    maxReward: 320,
    stage: "Півфінал",
  },
  {
    id: "m-liquid-heroic",
    tournamentSlug: "esl-pro-league-s23",
    a: "liquid",
    b: "heroic",
    status: "live",
    format: "BO3",
    startISO: "2026-07-12T16:30:00Z",
    timeLabel: "LIVE",
    scoreA: 0,
    scoreB: 0,
    liveMapLabel: "Ancient · 1 карта",
    liveRoundA: 6,
    liveRoundB: 4,
    openQuestions: 3,
    maxReward: 240,
    stage: "Група B",
  },
  {
    id: "m-b8-sinners",
    tournamentSlug: "ua-masters-2026",
    a: "b8",
    b: "sinners",
    status: "upcoming",
    format: "BO3",
    startISO: "2026-07-12T18:00:00Z",
    timeLabel: "Сьогодні · 21:00",
    scoreA: 0,
    scoreB: 0,
    openQuestions: 5,
    maxReward: 400,
    stage: "Відкриття",
  },
  {
    id: "m-big-tyloo",
    tournamentSlug: "pgl-bucharest-2026",
    a: "big",
    b: "tyloo",
    status: "upcoming",
    format: "BO3",
    startISO: "2026-07-12T19:30:00Z",
    timeLabel: "Сьогодні · 22:30",
    scoreA: 0,
    scoreB: 0,
    openQuestions: 3,
    maxReward: 220,
    stage: "Чвертьфінал",
  },
  {
    id: "m-mibr-flyquest",
    tournamentSlug: "iem-cologne-2026",
    a: "mibr",
    b: "flyquest",
    status: "upcoming",
    format: "BO1",
    startISO: "2026-07-13T13:00:00Z",
    timeLabel: "Завтра · 16:00",
    scoreA: 0,
    scoreB: 0,
    openQuestions: 2,
    maxReward: 150,
    stage: "Play-in",
  },
  {
    id: "m-gaimin-lynn",
    tournamentSlug: "cct-season-3",
    a: "gaimin",
    b: "lynn",
    status: "upcoming",
    format: "BO3",
    startISO: "2026-07-13T15:00:00Z",
    timeLabel: "Завтра · 18:00",
    scoreA: 0,
    scoreB: 0,
    openQuestions: 3,
    maxReward: 210,
    stage: "Група A",
  },
  {
    id: "m-vitality-wildcard",
    tournamentSlug: "blast-bounty-s2",
    a: "vitality",
    b: "wildcard",
    status: "upcoming",
    format: "BO3",
    startISO: "2026-07-21T14:00:00Z",
    timeLabel: "21 лип · 17:00",
    scoreA: 0,
    scoreB: 0,
    openQuestions: 4,
    maxReward: 300,
    stage: "Bounty · Раунд 1",
  },
  {
    id: "m-spirit-og",
    tournamentSlug: "blast-bounty-s2",
    a: "spirit",
    b: "og",
    status: "upcoming",
    format: "BO3",
    startISO: "2026-07-21T17:00:00Z",
    timeLabel: "21 лип · 20:00",
    scoreA: 0,
    scoreB: 0,
    openQuestions: 3,
    maxReward: 260,
    stage: "Bounty · Раунд 1",
  },
  {
    id: "m-navi-liquid-final",
    tournamentSlug: "blast-spring-2026",
    a: "natus",
    b: "liquid",
    status: "finished",
    format: "BO5",
    startISO: "2026-06-15T16:00:00Z",
    timeLabel: "15 чер",
    scoreA: 3,
    scoreB: 1,
    openQuestions: 0,
    maxReward: 0,
    stage: "Гранд-фінал",
  },
];

// Only BLAST Bounty matches are public for now.
export const matches: Match[] = allMatches.filter(
  (m) => m.tournamentSlug === "blast-bounty-s2",
);

/* --- Interactives (prediction questions) --- */

export type QuestionKind =
  | "match_winner"
  | "exact_score"
  | "map_winner"
  | "player_stat"
  | "custom";

export type QuestionStatus = "open" | "upcoming" | "locked" | "resolved";
export type Difficulty = "easy" | "medium" | "hard";

export type Option = {
  id: string;
  label: string;
  sublabel?: string;
  reward: number;
  picked?: boolean;
};

export type Question = {
  id: string;
  matchId: string;
  kind: QuestionKind;
  title: string;
  difficulty: Difficulty;
  status: QuestionStatus;
  deadlineISO: string;
  deadlineLabel: string;
  options: Option[];
  answered?: string; // option id
  result?: "correct" | "wrong" | "pending";
};

export const questions: Question[] = [
  {
    id: "q-vit-wc-winner",
    matchId: "m-vitality-wildcard",
    kind: "match_winner",
    title: "Переможець матчу",
    difficulty: "easy",
    status: "open",
    deadlineISO: "2026-07-21T14:00:00Z",
    deadlineLabel: "до старту матчу",
    options: [
      { id: "a", label: "Team Vitality", sublabel: "#1", reward: 40 },
      { id: "b", label: "Wildcard", reward: 120 },
    ],
  },
  {
    id: "q-vit-wc-score",
    matchId: "m-vitality-wildcard",
    kind: "exact_score",
    title: "Точний рахунок серії",
    difficulty: "hard",
    status: "open",
    deadlineISO: "2026-07-21T14:00:00Z",
    deadlineLabel: "до старту матчу",
    options: [
      { id: "20", label: "2 : 0", sublabel: "VIT", reward: 110 },
      { id: "21", label: "2 : 1", sublabel: "VIT", reward: 160 },
      { id: "12", label: "1 : 2", sublabel: "WC", reward: 260 },
    ],
  },
  {
    id: "q-spirit-og-winner",
    matchId: "m-spirit-og",
    kind: "match_winner",
    title: "Переможець матчу",
    difficulty: "easy",
    status: "open",
    deadlineISO: "2026-07-21T17:00:00Z",
    deadlineLabel: "до старту матчу",
    options: [
      { id: "a", label: "Team Spirit", sublabel: "#2", reward: 45 },
      { id: "b", label: "OG", reward: 95 },
    ],
  },
  {
    id: "q-spirit-og-first",
    matchId: "m-spirit-og",
    kind: "custom",
    title: "Хто візьме перший пістолетний раунд 1 карти?",
    difficulty: "medium",
    status: "open",
    deadlineISO: "2026-07-21T17:00:00Z",
    deadlineLabel: "до старту матчу",
    options: [
      { id: "a", label: "Team Spirit", reward: 100 },
      { id: "b", label: "OG", reward: 100 },
    ],
  },
];

/* --- Leaderboard --- */

export type LeaderRow = {
  rank: number;
  handle: string;
  points: number;
  correct: number;
  streak: number;
  isYou?: boolean;
  delta?: number; // rank change
};

export const seasonLeaderboard: LeaderRow[] = [
  { rank: 1, handle: "zaraza_ua", points: 18420, correct: 214, streak: 7, delta: 0 },
  { rank: 2, handle: "kv1tka", points: 17980, correct: 205, streak: 3, delta: 2 },
  { rank: 3, handle: "molotok", points: 17110, correct: 199, streak: 0, delta: -1 },
  { rank: 4, handle: "b1t_believer", points: 16240, correct: 191, streak: 5, delta: 1 },
  { rank: 5, handle: "shadow_kyiv", points: 15870, correct: 188, streak: 2, delta: -1 },
  { rank: 6, handle: "praporshchyk", points: 15220, correct: 180, streak: 1, delta: 0 },
  { rank: 7, handle: "oleksandr_p", points: 14690, correct: 176, streak: 4, delta: 3 },
  { rank: 42, handle: "ти", points: 6120, correct: 78, streak: 2, isYou: true, delta: 5 },
];

/* --- Giveaways --- */

export type Giveaway = {
  slug: string;
  prize: string;
  sponsor: string;
  valueUSD: number;
  endISO: string;
  endLabel: string;
  entrants: number;
  minPoints: number;
  status: "open" | "ending" | "finished";
  cover: string; // oklch tint (fallback when no image)
  image?: string; // optional prize photo, recommended 640×400
  description: string;
  conditions: string[];
  entered?: boolean; // demo: whether the current user already applied
};

export const giveaways: Giveaway[] = [
  {
    slug: "ak-nightwish",
    prize: "AK-47 | Nightwish (FN)",
    sponsor: "CS2 UA × SkinHub",
    valueUSD: 340,
    endISO: "2026-07-20T21:00:00Z",
    endLabel: "до 20 лип",
    entrants: 2840,
    minPoints: 500,
    status: "open",
    cover: "oklch(0.64 0.235 24)",
    description:
      "Розігруємо AK-47 | Nightwish у Factory New серед активних учасників спільноти. Переможець отримає скін прямим трейдом у Steam.",
    conditions: [
      "Підписка на Telegram і Instagram CS2 UA",
      "Мінімум 500 поінтів у поточному сезоні",
      "Відкритий для трейду Steam-акаунт",
    ],
  },
  {
    slug: "awp-dragon",
    prize: "AWP | Dragon Lore",
    sponsor: "BLAST Bounty S2",
    valueUSD: 9800,
    endISO: "2026-07-14T18:00:00Z",
    endLabel: "завершується завтра",
    entrants: 5210,
    minPoints: 1000,
    status: "ending",
    cover: "oklch(0.82 0.13 88)",
    description:
      "Легендарний AWP | Dragon Lore до старту BLAST Bounty S2. Головний приз — не пропусти дедлайн подачі заявки.",
    conditions: [
      "Активна участь у bounty-прогнозах BLAST Bounty",
      "Мінімум 1000 поінтів у сезоні",
      "Один акаунт — одна заявка",
    ],
    entered: true,
  },
];

export function getGiveaway(slug: string): Giveaway | undefined {
  return giveaways.find((g) => g.slug === slug);
}

/* --- Notifications --- */

export type NotifKind = "reward" | "match" | "giveaway" | "rank";

export type Notification = {
  id: string;
  kind: NotifKind;
  title: string;
  time: string;
  unread: boolean;
};

export const notifications: Notification[] = [
  { id: "n1", kind: "reward", title: "Прогноз на Natus Vincere зіграв — +40 поінтів", time: "щойно", unread: true },
  { id: "n2", kind: "match", title: "B8 vs SINNERS почнеться за 30 хвилин", time: "12 хв тому", unread: true },
  { id: "n3", kind: "rank", title: "Ти піднявся на 5 місць у сезонному лідерборді", time: "1 год тому", unread: true },
  { id: "n4", kind: "giveaway", title: "Новий розіграш: AWP | Dragon Lore", time: "3 год тому", unread: false },
  { id: "n5", kind: "reward", title: "Прогноз на точний рахунок не зіграв", time: "вчора", unread: false },
];

/* --- Sidebar promo banner (editable in admin) --- */

export type PromoBanner = {
  enabled: boolean;
  image: string; // recommended 344×240 (2×), displayed at 120px tall
  linkType: "tournament" | "match";
  target: string; // tournament slug or match id
};

export const promoBanner: PromoBanner = {
  enabled: true,
  image: "/brand/promo.png",
  linkType: "tournament",
  target: "blast-bounty-s2",
};

export function promoHref(p: PromoBanner): string {
  return p.linkType === "match" ? `/matches/${p.target}` : `/tournaments/${p.target}`;
}

/* --- Social proof (editable in admin) --- */

export const socials = [
  { key: "instagram", label: "Instagram", handle: "@cs2ua", followers: 128000, url: "https://instagram.com" },
  { key: "telegram", label: "Telegram", handle: "CS2 UA", followers: 94500, url: "https://telegram.org" },
  { key: "tiktok", label: "TikTok", handle: "@cs2.ua", followers: 212000, url: "https://tiktok.com" },
] as const;

/* --- Helpers --- */

export function getTeam(slug: string): Team {
  return teams[slug];
}

export function getTournament(slug: string): Tournament | undefined {
  return tournaments.find((t) => t.slug === slug);
}

export function getMatch(id: string): Match | undefined {
  return matches.find((m) => m.id === id);
}

export function questionsForMatch(id: string): Question[] {
  return questions.filter((q) => q.matchId === id);
}

export function formatPrize(usd: number): string {
  return "$" + new Intl.NumberFormat("uk-UA").format(usd);
}

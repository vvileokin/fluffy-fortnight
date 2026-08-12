import {
  HomeGlyph,
  TrophyGlyph,
  SwordsGlyph,
  TargetGlyph,
  GiftGlyph,
} from "@/components/layout/NavGlyphs";

/** Solid nav glyph: takes a className, inherits colour from its parent. */
export type NavIcon = (props: { className?: string }) => React.ReactElement;

export type NavItem = {
  href: string;
  /** Key under the `nav` message namespace. */
  key: "home" | "tournaments" | "matches" | "interactives" | "giveaways";
  icon: NavIcon;
};

/** Five primary sections. Shown in the desktop sidebar and mobile bottom bar. */
export const primaryNav: NavItem[] = [
  { href: "/", key: "home", icon: HomeGlyph },
  { href: "/tournaments", key: "tournaments", icon: TrophyGlyph },
  { href: "/matches", key: "matches", icon: SwordsGlyph },
  { href: "/interactives", key: "interactives", icon: TargetGlyph },
  { href: "/giveaways", key: "giveaways", icon: GiftGlyph },
];

export const bottomNav: NavItem[] = primaryNav;

import {
  HomeGlyph,
  TrophyGlyph,
  SwordsGlyph,
  GiftGlyph,
  CrownGlyph,
} from "@/components/layout/NavGlyphs";
import { TargetGlyph } from "@/components/layout/NavGlyphs";

/** Solid nav glyph: takes a className, inherits colour from its parent. */
export type NavIcon = (props: { className?: string }) => React.ReactElement;

export type NavItem = {
  href: string;
  /** Key under the `nav` message namespace. */
  key: "home" | "tournaments" | "matches" | "major" | "interactives" | "giveaways";
  icon: NavIcon;
  /**
   * Optical correction, because a row of glyphs is set by eye and not by a
   * number. Sizing on height alone assumes every mark is about as wide as it is
   * tall; the crown is 202×144 and solid, so at the shared height it comes out a
   * third wider than the swords beside it and reads as the loudest thing in the
   * bar. This shrinks that one mark until it weighs the same as its neighbours.
   */
  iconScale?: number;
  /**
   * The section's own colour, when it has one. The Major is not a part of this
   * site the way Matches is — it is an event with its own identity, and the
   * scarlet is PGL's. Everything else stays on the product's yellow.
   */
  accent?: string;
};

/** The primary sections, in the desktop sidebar and the mobile bottom bar. */
export const primaryNav: NavItem[] = [
  { href: "/", key: "home", icon: HomeGlyph },
  { href: "/tournaments", key: "tournaments", icon: TrophyGlyph },
  { href: "/matches", key: "matches", icon: SwordsGlyph },
  { href: "/interactives", key: "interactives", icon: TargetGlyph },
  { href: "/giveaways", key: "giveaways", icon: GiftGlyph },
];

/**
 * The Major sits apart, at the foot of the rail.
 * It is not a section of this product the way Matches is — it is one event,
 * for one autumn, with its own colour. Mixed into the list it competed with
 * five permanent things; on its own at the bottom it reads as what it is.
 * The mobile bar still carries it inline, because a bottom bar has no bottom.
 */
export const majorNav: NavItem = {
  href: "/major", key: "major", icon: CrownGlyph, iconScale: 0.8, accent: "var(--major)",
};

export const bottomNav: NavItem[] = [...primaryNav, majorNav];

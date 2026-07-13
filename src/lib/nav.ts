import {
  Home,
  Trophy,
  Swords,
  Target,
  Gift,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  /** Key under the `nav` message namespace. */
  key: "home" | "tournaments" | "matches" | "interactives" | "giveaways";
  icon: LucideIcon;
};

/** Five primary sections. Shown in the desktop sidebar and mobile bottom bar. */
export const primaryNav: NavItem[] = [
  { href: "/", key: "home", icon: Home },
  { href: "/tournaments", key: "tournaments", icon: Trophy },
  { href: "/matches", key: "matches", icon: Swords },
  { href: "/interactives", key: "interactives", icon: Target },
  { href: "/giveaways", key: "giveaways", icon: Gift },
];

export const bottomNav: NavItem[] = primaryNav;

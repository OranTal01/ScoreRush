import { nav } from "@/lib/content/he";
import {
  IconBonuses,
  IconHome,
  IconLeaderboard,
  IconPredictions,
} from "../icons";

/**
 * The 4 primary tabs per UX-BLUEPRINT.md §2 — identical set on mobile
 * (fixed bottom nav) and desktop (top bar horizontal tabs). Groups/Bracket
 * live under the Predictions sub-tabs (see sub-tabs.tsx); Profile/Admin are
 * reached from the header, not this primary set — same as the blueprint.
 */
export const primaryNavItems = [
  { href: "/", label: nav.home, Icon: IconHome },
  { href: "/predictions", label: nav.predictions, Icon: IconPredictions },
  { href: "/leaderboard", label: nav.leaderboard, Icon: IconLeaderboard },
  { href: "/bonuses", label: nav.bonuses, Icon: IconBonuses },
] as const;

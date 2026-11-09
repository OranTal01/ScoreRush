import type { MatchStatus } from "./list";
export type FriendPrediction = {
  id: string;
  name: string;
  home: number | null;
  away: number | null;
  points: number | null;
  isDefault: boolean;
};
export function canRevealPredictions(
  status: MatchStatus,
  lockTime: string,
  retrospective: boolean,
  now: number,
) {
  return (
    !retrospective &&
    status !== "cancelled" &&
    status !== "postponed" &&
    Number.isFinite(Date.parse(lockTime)) &&
    now >= Date.parse(lockTime)
  );
}

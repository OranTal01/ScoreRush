export type DraftScore = { home: string; away: string };
export type SavedDraft = DraftScore & {
  version: 1;
  baseline: string;
  updatedAt: number;
};
export const DRAFT_MAX_AGE = 45 * 86400000;
export function draftKey(scope: string, matchId: string) {
  return `scorerush:prediction-draft:v1:${scope}:${matchId}`;
}
export function decodeDraft(
  raw: string | null,
  baseline: string,
  now: number,
): SavedDraft | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw);
    return d?.version === 1 &&
      d.baseline === baseline &&
      typeof d.home === "string" &&
      typeof d.away === "string" &&
      /^\d{0,2}$/.test(d.home) &&
      /^\d{0,2}$/.test(d.away) &&
      (d.home !== "" || d.away !== "") &&
      Number.isFinite(d.updatedAt) &&
      d.updatedAt <= now &&
      now - d.updatedAt < DRAFT_MAX_AGE
      ? d
      : null;
  } catch {
    return null;
  }
}

import dictionary from "./football-names.he.json";

/** Display-only dictionary. Provider names and IDs remain canonical in storage. */
export function normalizeFootballName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[׳’']/g, "")
    .replace(/[־–-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
const translations = new Map<string, string>();
const aliases = new Map<string, string[]>();
const entries: { en: string; he: string; aliases?: string[] }[] = [
  ...dictionary.teams,
  ...dictionary.players,
];
for (const entry of entries) {
  const names = [entry.en, entry.he, ...(entry.aliases ?? [])];
  for (const name of names)
    translations.set(normalizeFootballName(name), entry.he);
  aliases.set(normalizeFootballName(entry.he), names);
}
for (const [en, he] of Object.entries(dictionary.otherNames)) {
  translations.set(normalizeFootballName(en), he);
  aliases.set(normalizeFootballName(he), [en, he]);
}
/** Preserve unknown/custom names, never guess a person's identity or rename members. */
export function footballName(name: string): string {
  return translations.get(normalizeFootballName(name)) ?? name;
}
export function footballSearchText(name: string): string {
  const he = footballName(name);
  return normalizeFootballName(
    (aliases.get(normalizeFootballName(he)) ?? [name]).join(" "),
  );
}
export type FootballChoice = { refId: string; label: string; team?: string };
export function footballChoiceLabel(
  option: FootballChoice,
  language: "he" | "en" = "he",
): string {
  const display = language === "he" ? footballName : (name: string) => name;
  return [display(option.label), option.team ? display(option.team) : null]
    .filter(Boolean)
    .join(" · ");
}
export function resolveFootballChoice(
  options: FootballChoice[],
  value: string,
): FootballChoice | undefined {
  const normalized = normalizeFootballName(value);
  const exact = options.filter((option) =>
    [
      footballChoiceLabel(option),
      footballChoiceLabel(option, "en"),
      option.label,
      footballName(option.label),
    ].some((name) => normalizeFootballName(name) === normalized),
  );
  // Two players with the same name must be selected with their team attached.
  return exact.length === 1 ? exact[0] : undefined;
}

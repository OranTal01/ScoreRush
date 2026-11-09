export function competitionLabel(competition: string): string {
  const labels: Record<string, string> = {
    champions_league: "ליגת האלופות",
    world_cup: "גביע העולם",
    custom: "טורניר פרטי",
  };
  return labels[competition] ?? competition;
}

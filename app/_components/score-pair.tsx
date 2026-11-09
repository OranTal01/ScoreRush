type ScorePairProps = {
  home: number;
  away: number;
  homeLabel?: string;
  awayLabel?: string;
  className?: string;
  live?: boolean;
};

/** Match rows place the home team on the right in Hebrew. Keep each score
 * on that same side, while isolating each number so 10 never becomes 01. */
export function ScorePair({
  home,
  away,
  homeLabel = "בית",
  awayLabel = "חוץ",
  className = "",
  live = false,
}: ScorePairProps) {
  return (
    <span
      dir="rtl"
      role="img"
      aria-label={`${homeLabel}: ${home}, ${awayLabel}: ${away}`}
      aria-live={live ? "polite" : undefined}
      className={`inline-flex items-center justify-center gap-1 whitespace-nowrap tabular-nums [unicode-bidi:isolate] ${className}`}
    >
      <bdi dir="ltr" aria-hidden="true">
        {home}
      </bdi>
      <span aria-hidden="true">–</span>
      <bdi dir="ltr" aria-hidden="true">
        {away}
      </bdi>
    </span>
  );
}

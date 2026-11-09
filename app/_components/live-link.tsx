import Link from "next/link";
export function LiveLink() {
  return (
    <Link
      href="/live"
      className="recap-teaser my-4 flex flex-wrap items-center justify-between gap-3"
    >
      <span>
        <b className="block text-sm text-[var(--interactive)]">
          ערב המשחקים ⚽
        </b>
        <span className="mt-1 block text-xs leading-6 text-[var(--text-secondary)]">
          התוצאות, הניחוש שלכם והטבלה הזמנית — במקום אחד.
        </span>
      </span>
      <span className="text-sm font-bold text-[var(--interactive)]">
        לכל מה שקורה עכשיו ←
      </span>
    </Link>
  );
}

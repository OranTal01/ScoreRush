/**
 * Minimal hand-rolled stroke icons (no icon package dependency yet) —
 * consistent 20x20 viewBox, currentColor, restrained per Premium Fantasy
 * Refined's "calm, never busy" intent.
 */
import type { SVGProps } from "react";

const base = {
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function IconHome(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M3 9.5 10 3l7 6.5" />
      <path d="M5 8.5V17h10V8.5" />
    </svg>
  );
}

export function IconPredictions(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="3.5" width="13" height="13" rx="2.5" />
      <path d="M6.5 8h7M6.5 11.5h4.5" />
    </svg>
  );
}

export function IconLeaderboard(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M5 17V10M10 17V3M15 17v-5.5" />
    </svg>
  );
}

export function IconBonuses(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M10 3.2 12 8l5 .6-3.7 3.4.9 4.9L10 14.5 5.8 16.9l.9-4.9L3 8.6 8 8Z" />
    </svg>
  );
}

export function IconGroups(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="3" width="6" height="6" rx="1.5" />
      <rect x="11" y="3" width="6" height="6" rx="1.5" />
      <rect x="3" y="11" width="6" height="6" rx="1.5" />
      <rect x="11" y="11" width="6" height="6" rx="1.5" />
    </svg>
  );
}

export function IconBracket(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M3 5h4v3.5H3zM3 11.5h4V15H3zM7 6.5h3v6.5H7M10 9.75h3M13 5h4v3.5h-4zM13 11.5h4V15h-4z" />
    </svg>
  );
}

export function IconProfile(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="10" cy="6.8" r="3.3" />
      <path d="M3.8 17c.9-3.2 3.4-5 6.2-5s5.3 1.8 6.2 5" />
    </svg>
  );
}

export function IconAdmin(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M10 3 4 5.3v4.4c0 4 2.6 6.6 6 7.3 3.4-.7 6-3.3 6-7.3V5.3Z" />
      <path d="M7.5 10 9 11.5l3.5-3.5" />
    </svg>
  );
}

export function IconChevronDown(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M5 7.5 10 12.5 15 7.5" />
    </svg>
  );
}

export function IconClose(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M5 5 15 15M15 5 5 15" />
    </svg>
  );
}

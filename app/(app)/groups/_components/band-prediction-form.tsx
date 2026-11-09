"use client";
import {
  footballSearchText,
  normalizeFootballName,
} from "@/lib/content/football-names";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { rankingBands, type RankingConfig } from "@/lib/scoring/ranking-config";
import { groups as content } from "@/lib/content/he";
import {
  submitGroupPrediction,
  type SubmitGroupPredictionState,
} from "../actions";

type Team = { id: string; label: string };
function SaveButton({ valid }: { valid: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={!valid || pending}
      className="min-h-12 w-full rounded-2xl bg-[var(--interactive)] px-4 py-3 text-sm font-bold text-[#080B14] disabled:opacity-40"
    >
      {pending ? content.saveLoading : "שמירת טווחי המיקומים"}
    </button>
  );
}

export function BandPredictionForm({
  group,
  teams,
  config,
  savedOrder,
  points,
}: {
  group: string;
  teams: Team[];
  config: RankingConfig;
  savedOrder?: string[];
  points: number;
}) {
  const bands = rankingBands(config);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(!savedOrder?.length);
  const [state, action] = useActionState<SubmitGroupPredictionState, FormData>(
    async (previous, data) => {
      const result = await submitGroupPrediction(previous, data);
      if (result.status === "success") setEditing(false);
      return result;
    },
    { status: "idle" },
  );
  const [selection, setSelection] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      (savedOrder ?? []).map((id, index) => [
        id,
        bands.findIndex((b) => index >= b.start && index < b.end),
      ]),
    ),
  );
  const buckets = bands.map((band) =>
    teams.filter((team) => selection[team.id] === band.index),
  );
  const unassigned = teams.filter(
    (team) => selection[team.id] === undefined || selection[team.id] < 0,
  );
  const valid =
    unassigned.length === 0 &&
    bands.every((band) => buckets[band.index].length === band.size);
  const order = buckets.flat().map((team) => team.id);
  const saved =
    state.status === "success" &&
    JSON.stringify(state.predictedOrder) === JSON.stringify(order);
  const tone = [
    "border-emerald-400/30 bg-emerald-400/5",
    "border-amber-400/30 bg-amber-400/5",
    "border-white/10 bg-white/[0.025]",
  ];

  function teamRow(team: Team) {
    return (
      <label
        key={team.id}
        className="flex min-h-12 items-center justify-between gap-3 border-b border-white/5 py-2 last:border-0"
      >
        <bdi className="min-w-0 text-sm font-semibold [overflow-wrap:anywhere]">
          {team.label}
        </bdi>
        <select
          aria-label={`טווח המיקום של ${team.label}`}
          value={selection[team.id] ?? -1}
          onChange={(event) =>
            setSelection((previous) => ({
              ...previous,
              [team.id]: Number(event.target.value),
            }))
          }
          className="h-11 w-28 shrink-0 rounded-xl border border-white/10 bg-[var(--bg-elevated)] ps-2 pe-8 text-sm"
        >
          <option value={-1}>בחירת טווח</option>
          {bands.map((band) => (
            <option key={band.index} value={band.index}>
              {band.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="group" value={group} />
      <input
        type="hidden"
        name="predictedOrder"
        value={JSON.stringify(order)}
      />
      <p className="text-sm leading-6 text-[var(--text-secondary)]">
        בחרו טווח לכל קבוצה. כל קבוצה בטווח הנכון שווה {points} נקודות. הסדר
        בתוך הטווח אינו משנה.
      </p>
      <div
        className="sticky top-[76px] z-10 grid grid-cols-3 gap-2 rounded-2xl bg-[var(--surface-card)] py-2 lg:top-20"
        aria-live="polite"
        aria-label="מכסת הקבוצות בכל טווח"
      >
        {bands.map((band) => (
          <div
            key={band.index}
            className={`rounded-2xl border p-3 text-center ${tone[band.index % tone.length]}`}
          >
            <div className="text-xs text-[var(--text-secondary)]" dir="ltr">
              {band.label}
            </div>
            <div
              className={`mt-1 text-lg font-bold tabular-nums ${buckets[band.index].length > band.size ? "text-[var(--danger)]" : ""}`}
            >
              {buckets[band.index].length}/{band.size}
            </div>
          </div>
        ))}
      </div>
      {!editing && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-[var(--success)]">
            השיבוץ נשמר. אפשר לערוך עד הנעילה.
          </p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="min-h-11 rounded-xl border border-[var(--interactive)] px-4 text-sm font-bold text-[var(--interactive)]"
          >
            עריכת השיבוץ
          </button>
        </div>
      )}
      {editing && (
        <section className="rounded-2xl border border-white/10 p-3">
          <h3 className="mb-3 text-sm font-bold">
            שיבוץ הקבוצות · {unassigned.length} נותרו
          </h3>
          <label className="mb-2 block">
            <span className="sr-only">חיפוש קבוצה לשיבוץ</span>
            <input
              type="search"
              placeholder="חיפוש קבוצה…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-h-11 w-full rounded-xl border border-white/10 bg-[var(--bg-elevated)] px-3 text-sm"
            />
          </label>
          {teams
            .filter((team) =>
              footballSearchText(team.label).includes(
                normalizeFootballName(query),
              ),
            )
            .map(teamRow)}
          {teams.every(
            (team) =>
              !footballSearchText(team.label).includes(
                normalizeFootballName(query),
              ),
          ) && (
            <p className="py-3 text-sm text-[var(--text-muted)]">
              לא נמצאה קבוצה בשם הזה.
            </p>
          )}
        </section>
      )}
      {bands.map((band) => (
        <details
          open={!editing}
          key={band.index}
          className={`rounded-2xl border p-3 ${tone[band.index % tone.length]}`}
        >
          <summary className="min-h-11 cursor-pointer text-sm leading-11 font-bold">
            <span className="ms-2 text-[var(--text-secondary)]">
              מקומות <bdi>{band.label}</bdi>
            </span>
            <span>
              {buckets[band.index].length}/{band.size}
            </span>
          </summary>
          {buckets[band.index].length ? (
            <ul className="space-y-2 pb-2 text-sm text-[var(--text-secondary)]">
              {buckets[band.index].map((team) => (
                <li key={team.id}>
                  <bdi>{team.label}</bdi>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-2 text-xs text-[var(--text-muted)]">
              הקבוצות שתבחרו יופיעו כאן
            </p>
          )}
        </details>
      ))}
      {state.status === "error" && (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {state.code === "finalized"
            ? content.errorFinalized
            : content.saveError}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm text-[var(--success)]">
          {content.saveSuccess}
        </p>
      )}
      {!valid && (
        <p className="text-center text-xs text-[var(--text-muted)]">
          יש לשבץ את כל הקבוצות ולמלא בדיוק את המכסה בכל טווח.
        </p>
      )}
      {editing && <SaveButton valid={valid} />}
    </form>
  );
}

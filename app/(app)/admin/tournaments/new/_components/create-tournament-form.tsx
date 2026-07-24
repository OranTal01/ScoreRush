"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { createTournament as content } from "@/lib/content/he";
import { colors } from "@/lib/design-tokens";
import { Card, SectionHeader } from "@/app/_components/ui";
import {
  createTournament,
  type CreateTournamentErrorCode,
  type CreateTournamentState,
} from "../actions";

const initialState: CreateTournamentState = { status: "idle" };

const ERROR_MESSAGES: Record<CreateTournamentErrorCode, string> = {
  invalid_input: content.errorInvalidInput,
  unauthenticated: content.errorUnauthenticated,
  not_platform_admin: content.errorNotPlatformAdmin,
  generic: content.errorGeneric,
};

// Mirrors lib/scoring/recompute.ts DEFAULT_SCORING_RULES — a sane starting
// point the admin can override, not a hardcoded rule (they're still plain
// form fields, submitted like everything else).
const DEFAULT_SCORING = {
  exactScorePoints: "9",
  winnerAndDiffPoints: "6",
  winnerOnlyPoints: "3",
  wrongPoints: "0",
  groupRankingPointsPerPosition: "3",
};

type SlotDraft = { key: string; points: string };
type BonusCategoryDraft = {
  key: string;
  name: string;
  type: string;
  resolvesAt: "ongoing" | "tournament_end";
  duplicateStackingAllowed: boolean;
  slots: SlotDraft[];
};
type PrizeDraft = { key: string; description: string };

function makeKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `k${Math.random().toString(36).slice(2)}`;
}

const inputStyle = {
  background: colors.surfaceCard2,
  borderRadius: "var(--radius-button)",
  border: `1px solid ${colors.border}`,
};

const labelClass = "text-xs font-semibold text-[var(--text-secondary)]";
const textInputClass =
  "px-4 py-3 text-end text-sm text-[var(--text-primary)] outline-none";
const numberInputClass =
  "ltr w-full px-4 py-3 text-start text-sm text-[var(--text-primary)] outline-none";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full py-3 text-sm font-bold text-[#080B14] transition-opacity disabled:opacity-60"
      style={{
        background: colors.interactive,
        borderRadius: "var(--radius-button)",
      }}
    >
      {pending ? content.submitPending : content.submitCta}
    </button>
  );
}

function RemoveButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[11px] font-bold text-[var(--danger)]"
    >
      {label}
    </button>
  );
}

/**
 * Tournament creation form — UX-BLUEPRINT.md §5 flow F condensed into one
 * screen (name/competition -> provider binding -> scoring rules -> bonus
 * categories+slots -> prizes), since DECISIONS.md locks all of it at
 * creation with no later edit screen. Complex nested state (bonus
 * categories/slots, prizes) is kept as local component state and serialized
 * to JSON in hidden inputs on submit, the same pattern
 * group-prediction-form.tsx uses for `predictedOrder`.
 */
export function CreateTournamentForm() {
  const [state, formAction] = useActionState(createTournament, initialState);

  const [dataSource, setDataSource] = useState<"football_data_org" | "manual">(
    "manual",
  );
  const [scoring, setScoring] = useState(DEFAULT_SCORING);
  const [categories, setCategories] = useState<BonusCategoryDraft[]>([]);
  const [prizeList, setPrizeList] = useState<PrizeDraft[]>([]);

  function addCategory() {
    setCategories((prev) => [
      ...prev,
      {
        key: makeKey(),
        name: "",
        type: "",
        resolvesAt: "ongoing",
        duplicateStackingAllowed: true,
        slots: [{ key: makeKey(), points: "10" }],
      },
    ]);
  }

  function updateCategory(key: string, patch: Partial<BonusCategoryDraft>) {
    setCategories((prev) =>
      prev.map((c) => (c.key === key ? { ...c, ...patch } : c)),
    );
  }

  function removeCategory(key: string) {
    setCategories((prev) => prev.filter((c) => c.key !== key));
  }

  function addSlot(categoryKey: string) {
    setCategories((prev) =>
      prev.map((c) =>
        c.key === categoryKey
          ? { ...c, slots: [...c.slots, { key: makeKey(), points: "10" }] }
          : c,
      ),
    );
  }

  function updateSlot(categoryKey: string, slotKey: string, points: string) {
    setCategories((prev) =>
      prev.map((c) =>
        c.key === categoryKey
          ? {
              ...c,
              slots: c.slots.map((s) =>
                s.key === slotKey ? { ...s, points } : s,
              ),
            }
          : c,
      ),
    );
  }

  function removeSlot(categoryKey: string, slotKey: string) {
    setCategories((prev) =>
      prev.map((c) =>
        c.key === categoryKey
          ? { ...c, slots: c.slots.filter((s) => s.key !== slotKey) }
          : c,
      ),
    );
  }

  function addPrize() {
    setPrizeList((prev) => [...prev, { key: makeKey(), description: "" }]);
  }

  function updatePrize(key: string, description: string) {
    setPrizeList((prev) =>
      prev.map((p) => (p.key === key ? { ...p, description } : p)),
    );
  }

  function removePrize(key: string) {
    setPrizeList((prev) => prev.filter((p) => p.key !== key));
  }

  if (state.status === "success") {
    return (
      <Card className="flex flex-col items-center gap-3 text-center">
        <span className="text-sm font-extrabold text-[var(--success)]">
          {content.successMessage}
        </span>
        <Link
          href="/admin"
          className="text-sm font-bold text-[var(--interactive)]"
        >
          {content.backToAdmin}
        </Link>
      </Card>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input
        type="hidden"
        name="bonusCategories"
        value={JSON.stringify(
          categories.map((c) => ({
            name: c.name,
            type: c.type,
            resolvesAt: c.resolvesAt,
            duplicateStackingAllowed: c.duplicateStackingAllowed,
            slots: c.slots.map((s) => ({ points: s.points })),
          })),
        )}
      />
      <input
        type="hidden"
        name="prizes"
        value={JSON.stringify(
          prizeList.map((p) => ({ description: p.description })),
        )}
      />

      <Card className="flex flex-col gap-3">
        <SectionHeader title={content.basicsSection} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className={labelClass}>
            {content.nameLabel}
          </label>
          <input
            id="name"
            name="name"
            required
            placeholder={content.namePlaceholder}
            className={textInputClass}
            style={inputStyle}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="competition" className={labelClass}>
            {content.competitionLabel}
          </label>
          <input
            id="competition"
            name="competition"
            required
            dir="ltr"
            placeholder={content.competitionPlaceholder}
            className="px-4 py-3 text-start text-sm text-[var(--text-primary)] outline-none"
            style={inputStyle}
          />
          <span className="text-[11px] text-[var(--text-muted)]">
            {content.competitionHint}
          </span>
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <SectionHeader title={content.providerSection} />
        <div className="flex gap-2">
          {(["manual", "football_data_org"] as const).map((option) => (
            <label
              key={option}
              className="flex flex-1 items-center justify-center gap-2 px-3 py-2.5 text-xs font-bold"
              style={{
                ...inputStyle,
                color:
                  dataSource === option
                    ? colors.textPrimary
                    : colors.textSecondary,
                background:
                  dataSource === option
                    ? colors.surfaceCard2
                    : "transparent",
              }}
            >
              <input
                type="radio"
                name="dataSource"
                value={option}
                checked={dataSource === option}
                onChange={() => setDataSource(option)}
                className="sr-only"
              />
              {option === "football_data_org"
                ? content.providerFootballData
                : content.providerManual}
            </label>
          ))}
        </div>
        <span className="text-[11px] text-[var(--text-muted)]">
          {content.providerHint}
        </span>
        {dataSource === "football_data_org" && (
          <div className="flex gap-2">
            <div className="flex flex-1 flex-col gap-1.5">
              <label htmlFor="competitionCode" className={labelClass}>
                {content.competitionCodeLabel}
              </label>
              <input
                id="competitionCode"
                name="competitionCode"
                dir="ltr"
                required
                placeholder={content.competitionCodePlaceholder}
                className="px-4 py-3 text-start text-sm text-[var(--text-primary)] outline-none"
                style={inputStyle}
              />
            </div>
            <div className="flex w-28 flex-col gap-1.5">
              <label htmlFor="season" className={labelClass}>
                {content.seasonLabel}
              </label>
              <input
                id="season"
                name="season"
                type="number"
                dir="ltr"
                className={numberInputClass}
                style={inputStyle}
              />
            </div>
          </div>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <SectionHeader title={content.scoringSection} />
        {(
          [
            ["exactScorePoints", content.exactScoreLabel],
            ["winnerAndDiffPoints", content.winnerAndDiffLabel],
            ["winnerOnlyPoints", content.winnerOnlyLabel],
            ["wrongPoints", content.wrongLabel],
            [
              "groupRankingPointsPerPosition",
              content.groupRankingLabel,
            ],
          ] as const
        ).map(([field, label]) => (
          <div key={field} className="flex items-center justify-between gap-3">
            <label htmlFor={field} className={labelClass}>
              {label}
            </label>
            <input
              id={field}
              name={field}
              type="number"
              min={0}
              dir="ltr"
              value={scoring[field]}
              onChange={(e) =>
                setScoring((prev) => ({ ...prev, [field]: e.target.value }))
              }
              className="ltr w-20 px-3 py-2 text-center text-sm font-bold text-[var(--text-primary)] outline-none"
              style={inputStyle}
            />
          </div>
        ))}
      </Card>

      <Card className="flex flex-col gap-3">
        <SectionHeader title={content.bonusSection} />
        {categories.length === 0 && (
          <p className="text-xs text-[var(--text-muted)]">
            {content.bonusEmptyHint}
          </p>
        )}
        {categories.map((category) => (
          <div
            key={category.key}
            className="flex flex-col gap-2.5 border-t pt-3"
            style={{ borderColor: colors.border }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-[var(--text-primary)]">
                {category.name || content.bonusNamePlaceholder}
              </span>
              <RemoveButton
                label={content.removeCategory}
                onClick={() => removeCategory(category.key)}
              />
            </div>
            <div className="flex gap-2">
              <div className="flex flex-1 flex-col gap-1.5">
                <label className={labelClass}>{content.bonusNameLabel}</label>
                <input
                  required
                  placeholder={content.bonusNamePlaceholder}
                  value={category.name}
                  onChange={(e) =>
                    updateCategory(category.key, { name: e.target.value })
                  }
                  className={textInputClass}
                  style={inputStyle}
                />
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <label className={labelClass}>{content.bonusTypeLabel}</label>
                <input
                  required
                  dir="ltr"
                  placeholder={content.bonusTypePlaceholder}
                  value={category.type}
                  onChange={(e) =>
                    updateCategory(category.key, { type: e.target.value })
                  }
                  className="px-4 py-3 text-start text-sm text-[var(--text-primary)] outline-none"
                  style={inputStyle}
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <label className={labelClass}>
                {content.bonusResolvesAtLabel}
              </label>
              <select
                value={category.resolvesAt}
                onChange={(e) =>
                  updateCategory(category.key, {
                    resolvesAt: e.target.value as "ongoing" | "tournament_end",
                  })
                }
                className="px-3 py-2 text-xs font-bold text-[var(--text-primary)] outline-none"
                style={inputStyle}
              >
                <option value="ongoing">{content.bonusResolvesOngoing}</option>
                <option value="tournament_end">
                  {content.bonusResolvesEnd}
                </option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)]">
              <input
                type="checkbox"
                checked={category.duplicateStackingAllowed}
                onChange={(e) =>
                  updateCategory(category.key, {
                    duplicateStackingAllowed: e.target.checked,
                  })
                }
              />
              {content.bonusDuplicateStackingLabel}
            </label>

            <div className="flex flex-col gap-1.5">
              <span className={labelClass}>{content.bonusSlotsLabel}</span>
              {category.slots.map((slot, index) => (
                <div key={slot.key} className="flex items-center gap-2">
                  <span className="w-20 text-[11px] text-[var(--text-muted)]">
                    {content.slotLabel(index + 1)}
                  </span>
                  <input
                    type="number"
                    min={0}
                    dir="ltr"
                    value={slot.points}
                    onChange={(e) =>
                      updateSlot(category.key, slot.key, e.target.value)
                    }
                    className="ltr w-20 px-3 py-2 text-center text-sm font-bold text-[var(--text-primary)] outline-none"
                    style={inputStyle}
                  />
                  {category.slots.length > 1 && (
                    <RemoveButton
                      label={content.removeSlot}
                      onClick={() => removeSlot(category.key, slot.key)}
                    />
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => addSlot(category.key)}
                className="w-fit text-[11px] font-bold text-[var(--interactive)]"
              >
                {content.addBonusSlot}
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={addCategory}
          className="w-fit text-xs font-bold text-[var(--interactive)]"
        >
          {content.addBonusCategory}
        </button>
      </Card>

      <Card className="flex flex-col gap-3">
        <SectionHeader title={content.prizesSection} />
        {prizeList.length === 0 && (
          <p className="text-xs text-[var(--text-muted)]">
            {content.prizesEmptyHint}
          </p>
        )}
        {prizeList.map((prize, index) => (
          <div key={prize.key} className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-xs font-bold text-[var(--text-secondary)]">
              {content.prizeRankLabel(index + 1)}
            </span>
            <input
              required
              placeholder={content.prizeDescriptionPlaceholder}
              value={prize.description}
              onChange={(e) => updatePrize(prize.key, e.target.value)}
              className={`flex-1 ${textInputClass}`}
              style={inputStyle}
            />
            <RemoveButton
              label={content.removePrize}
              onClick={() => removePrize(prize.key)}
            />
          </div>
        ))}
        <button
          type="button"
          onClick={addPrize}
          className="w-fit text-xs font-bold text-[var(--interactive)]"
        >
          {content.addPrize}
        </button>
      </Card>

      {state.status === "error" && (
        <span
          role="alert"
          className="text-center text-xs font-semibold text-[var(--danger)]"
        >
          {ERROR_MESSAGES[state.code]}
        </span>
      )}

      <SubmitButton />
    </form>
  );
}

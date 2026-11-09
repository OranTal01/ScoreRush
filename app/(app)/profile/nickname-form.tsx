"use client";
import { useActionState, useState } from "react";
import { saveNickname, type ProfileState } from "./actions";

export function NicknameForm({ name }: { name: string }) {
  const [value, setValue] = useState(name);
  const [state, action, pending] = useActionState<ProfileState, FormData>(
    saveNickname,
    {},
  );
  return (
    <details className="w-full rounded-xl border border-white/10 p-3 text-start">
      <summary className="min-h-11 cursor-pointer content-center text-sm font-bold text-[var(--interactive)]">
        עריכת הכינוי
      </summary>
      <form action={action} className="mt-3 flex flex-col gap-3">
        <label className="flex flex-col gap-2 text-sm">
          הכינוי שלכם בטורניר
          <input
            name="nickname"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
            maxLength={32}
            autoComplete="nickname"
            className="h-12 w-full min-w-0 rounded-xl border border-white/15 bg-[var(--surface-card)] px-3"
          />
        </label>
        <p className="text-xs leading-5 text-[var(--text-secondary)]">
          זה השם שיופיע בטבלה ובטורניר הנוכחי.
        </p>
        <button
          disabled={pending || value.trim() === (state.savedName ?? name)}
          className="min-h-11 rounded-xl bg-[var(--interactive)] px-4 text-sm font-bold text-[#080B14] disabled:opacity-50"
        >
          {pending ? "שומר…" : "שמירת הכינוי"}
        </button>
        {state.error && (
          <p role="alert" className="text-sm text-[var(--danger)]">
            {state.error}
          </p>
        )}
        {state.savedName === value.trim() && (
          <p role="status" className="text-sm text-[var(--success)]">
            הכינוי נשמר.
          </p>
        )}
      </form>
    </details>
  );
}

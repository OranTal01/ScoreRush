export function eligibleDigest(digest, state, now = Date.now()) {
  const published = Date.parse(digest.published_at);
  return (
    !!digest.body?.trim() &&
    Number.isFinite(published) &&
    published >= Date.parse(state.activatedAt) &&
    published <= now &&
    now - published <= 30 * 3600000 &&
    !state.deliveries[digest.id]
  );
}

const israelParts = (value) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const p = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
};

/** A broad, once-only window survives a sleeping/offline home computer. */
export function reminderWindow(now, firstLock) {
  if (!(now instanceof Date) || !(firstLock instanceof Date)) return null;
  if (
    !Number.isFinite(+now) ||
    !Number.isFinite(+firstLock) ||
    now >= firstLock
  )
    return null;
  const current = israelParts(now);
  const target = israelParts(firstLock);
  const daysUntil =
    (Date.parse(`${target.day}T00:00:00Z`) -
      Date.parse(`${current.day}T00:00:00Z`)) /
    86400000;
  if (daysUntil === 1 && current.hour >= 18) return "day-before";
  if (daysUntil === 0 && current.hour >= 9 && +firstLock - +now > 2 * 3600000)
    return "same-day";
  return null;
}

export function reminderMessage(round, window, siteUrl) {
  const kickoff = new Date(round.first_kickoff).toLocaleTimeString("he-IL", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
  });
  const title =
    window === "day-before"
      ? `מחר מתחיל מחזור ${round.matchday} ⚽`
      : `היום משחקים — מחזור ${round.matchday} ⏰`;
  return `${title}\n\nהמשחק הראשון מתחיל ב־${kickoff}. בקבוצה עדיין חסרים ${round.missing_picks} ניחושים אצל ${round.missing_people} חברים.\n\nלמי שעוד לא מילא — זה הזמן להשלים באפליקציה. אפשר לנחש עד דקה לפני כל משחק:\n${siteUrl}/predictions`;
}

export function kickoffWindow(now, firstKickoff) {
  const remaining = +firstKickoff - +now;
  return Number.isFinite(remaining) && remaining > 60000 && remaining <= 600000;
}

export function kickoffMessage(day, siteUrl) {
  const count = Number(day.games);
  return `עוד כ־10 דקות מתחילים משחקי מחזור ${day.matchday} ⚽\n\n${count} משחקים מתוכננים להיום. הניחושים למשחק הראשון נסגרים דקה לפני השריקה. מי שכבר מילא — זה הזמן לראות מה החברים בחרו ולהתכונן לערב המשחקים.\n\n${siteUrl}/predictions`;
}

/** Persist intent before WhatsApp; uncertain attempts are never auto-retried. */
export async function deliverOnce({
  key,
  body,
  metadata = {},
  groupId,
  state,
  persist,
  send,
  now = new Date(),
}) {
  if (!key || !body?.trim() || state.deliveries[key]) return "skipped";
  state.deliveries[key] = {
    status: "sending",
    ...metadata,
    groupId,
    at: now.toISOString(),
  };
  await persist();
  try {
    const message = await send(groupId, body);
    if (!message?.id?._serialized)
      throw new Error("No message acknowledgement");
    state.deliveries[key] = {
      ...state.deliveries[key],
      status: "sent",
      messageId: message.id._serialized,
    };
    await persist();
    return "sent";
  } catch (error) {
    state.deliveries[key] = {
      ...state.deliveries[key],
      status: "uncertain",
      error:
        error instanceof Error
          ? error.message.slice(0, 160)
          : "Unknown send error",
    };
    await persist();
    return "uncertain";
  }
}
/** Persist an intent BEFORE touching WhatsApp: ambiguous/crashed sends never auto-retry. */
export async function deliverDigest({
  digest,
  groupId,
  state,
  persist,
  send,
  now = new Date(),
}) {
  if (!eligibleDigest(digest, state, +now)) return "skipped";
  return deliverOnce({
    key: digest.id,
    body: digest.body,
    metadata: { day: digest.day, kind: "digest" },
    groupId,
    state,
    persist,
    send,
    now,
  });
}

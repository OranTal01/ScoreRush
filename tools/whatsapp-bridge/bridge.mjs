import { loadEnvFile } from "node:process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { createServer } from "node:http";
import wa from "whatsapp-web.js";
import QRCode from "qrcode";
import postgres from "postgres";
import {
  eligibleDigest,
  deliverDigest,
  deliverOnce,
  kickoffMessage,
  kickoffWindow,
  reminderMessage,
  reminderWindow,
} from "./policy.mjs";
const root = dirname(fileURLToPath(import.meta.url));
const local = join(root, ".local");
await mkdir(local, { recursive: true, mode: 0o700 });
const config = JSON.parse(await readFile(join(local, "config.json"), "utf8"));
loadEnvFile(resolve(root, "../../.env.local"));
const url = new URL(process.env.DATABASE_URL);
if (url.hostname.endsWith(".pooler.supabase.com")) url.port = "6543";
const sql = postgres(url.toString(), {
  prepare: false,
  max: 1,
  idle_timeout: 20,
  connect_timeout: 15,
});
const statePath = join(local, "state.json");
let state;
try {
  state = JSON.parse(await readFile(statePath, "utf8"));
} catch (e) {
  if (e.code !== "ENOENT") throw e;
  state = { activatedAt: new Date().toISOString(), deliveries: {} };
}
async function persist() {
  await writeFile(statePath + ".tmp", JSON.stringify(state, null, 2), {
    mode: 0o600,
  });
  await rename(statePath + ".tmp", statePath);
}
await persist();
let status = "מתחבר לוואטסאפ…",
  qr = null,
  group = null,
  running = false;
const client = new wa.Client({
  authStrategy: new wa.LocalAuth({ dataPath: join(local, "auth") }),
  deviceName: "ScoreRush – התראות הטורניר",
  takeoverOnConflict: false,
  webVersionCache: { type: "local", path: join(local, "web-cache") },
  puppeteer: { headless: true },
  authTimeoutMs: 120000,
});
const sendGroupMessage = (id, body) =>
  new Promise((resolve, reject) => {
    let sendError = null;
    let settled = false;
    const finish = (error, message) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      client.off("message_create", onMessage);
      if (error) reject(error);
      else resolve(message);
    };
    const onMessage = (message) => {
      if (
        message.fromMe &&
        (message.to === id || message.id?.remote === id) &&
        message.body === body &&
        message.id?._serialized
      ) finish(null, message);
    };
    const timer = setTimeout(
      () => finish(sendError ?? new Error("Send timed out")),
      30000,
    );
    timer.unref();
    client.on("message_create", onMessage);
    client
      .sendMessage(id, body, { sendSeen: false, linkPreview: false })
      .then((message) => {
        if (message?.id?._serialized) finish(null, message);
      })
      .catch((error) => {
        sendError = error;
      });
  });
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const server = createServer((req, res) => {
  if (!["127.0.0.1:4199", "localhost:4199"].includes(req.headers.host)) {
    res.writeHead(403).end();
    return;
  }
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; frame-ancestors 'none'",
  );
  if (req.url === "/qr.svg" && qr) {
    res.setHeader("Content-Type", "image/svg+xml");
    res.end(qr);
    return;
  }
  if (req.url !== "/") {
    res.writeHead(404).end();
    return;
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(
    `<!doctype html><html lang="he" dir="rtl"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="10"><title>חיבור וואטסאפ · ScoreRush</title><style>body{font:18px system-ui;background:#080b14;color:#f5f7fb;margin:0;padding:28px;line-height:1.7}main{max-width:600px;margin:auto;background:#161c2c;border:1px solid #303a50;border-radius:24px;padding:28px}h1{font-size:28px}img{width:280px;max-width:100%;border:14px solid white;border-radius:12px;box-sizing:border-box}small{color:#aebad0}b{color:#76d7ac}</style><main><h1>התראות הטורניר בוואטסאפ ⚽</h1><p><b>${escape(status)}</b></p>${qr ? '<p>בטלפון: וואטסאפ ← הגדרות ← מכשירים מקושרים ← קישור מכשיר. סרקו את הקוד:</p><img alt="קוד QR לקישור וואטסאפ" src="/qr.svg">' : ""}${group ? `<p>קבוצה: <strong>${escape(group.name)}</strong></p>` : ""}<p>תזכורת בערב שלפני כל יום משחקים, תזכורת בבוקר אם עדיין חסרים ניחושים, הודעת פתיחה כ־10 דקות לפני המשחק הראשון, וסיכום אחרי עדכון הניקוד.</p><small>החיבור חינמי ופועל מהמחשב הזה. המחשב צריך להישאר דלוק, מחובר לאינטרנט וער. ניסיון שליחה שלא אושר לא נשלח שוב אוטומטית כדי למנוע כפילות.</small><p>${Object.values(state.deliveries).filter((d) => d.status === "sent").length} שליחות אושרו · ${Object.values(state.deliveries).filter((d) => d.status === "uncertain").length} דורשות אימות בקבוצה</p></main></html>`,
  );
});
await new Promise((res, rej) => {
  server.once("error", rej);
  server.listen(4199, "127.0.0.1", res);
});
client.on("qr", async (code) => {
  qr = await QRCode.toString(code, { type: "svg", margin: 2 });
  status = "ממתין לסריקת QR מהטלפון";
  console.log("QR ready at http://127.0.0.1:4199");
});
client.on("authenticated", () => {
  qr = null;
  status = "הטלפון קושר. מאמת את קבוצת הטורניר…";
});
client.on("auth_failure", () => {
  status = "החיבור נכשל. יש לקשר את הטלפון מחדש.";
});
client.on("disconnected", () => {
  group = null;
  qr = null;
  status = "וואטסאפ התנתק. יש להפעיל מחדש ולקשר את הטלפון.";
});
async function scan() {
  if (running || !group) return;
  running = true;
  try {
    const days = await sql`with day_slots as (
      select stage,matchday,to_char(kickoff at time zone 'Asia/Jerusalem','YYYY-MM-DD') game_day,
        min(kickoff) first_kickoff,min(lock_time) first_lock,count(*)::int games
      from matches where tournament_id=${config.tournamentId}
        and status not in ('cancelled','postponed') and matchday is not null
        and kickoff between now()-interval '1 day' and now()+interval '2 days'
      group by stage,matchday,to_char(kickoff at time zone 'Asia/Jerusalem','YYYY-MM-DD')
    )
    select nr.*,
      (select count(*)::int from participants p where p.tournament_id=${config.tournamentId}
        and exists(select 1 from matches m left join match_predictions mp
          on mp.match_id=m.id and mp.participant_id=p.id
          where m.tournament_id=${config.tournamentId} and m.stage=nr.stage
            and m.matchday=nr.matchday and to_char(m.kickoff at time zone 'Asia/Jerusalem','YYYY-MM-DD')=nr.game_day
            and m.status='scheduled' and m.lock_time>now()
            and (mp.id is null or mp.is_default))) missing_people,
      (select count(*)::int from participants p cross join matches m
        left join match_predictions mp on mp.match_id=m.id and mp.participant_id=p.id
        where p.tournament_id=${config.tournamentId} and m.tournament_id=${config.tournamentId}
          and m.stage=nr.stage and m.matchday=nr.matchday
          and to_char(m.kickoff at time zone 'Asia/Jerusalem','YYYY-MM-DD')=nr.game_day and m.status='scheduled'
          and m.lock_time>now() and (mp.id is null or mp.is_default)) missing_picks
    from day_slots nr order by nr.first_kickoff`;
    for (const round of days) {
      const window = reminderWindow(new Date(), new Date(round.first_lock));
      if (window && round.missing_picks > 0) {
        const key = `reminder:${round.stage}:${round.matchday}:${round.game_day}:${window}`;
        const result = await deliverOnce({
          key,
          body: reminderMessage(
            round,
            window,
            "https://scorerush-sigma.vercel.app",
          ),
          metadata: {
            kind: "reminder",
            matchday: round.matchday,
            window,
          },
          groupId: group.id._serialized,
          state,
          persist,
          send: sendGroupMessage,
        });
        if (result !== "skipped") {
          status =
            result === "sent"
              ? `תזכורת מחזור ${round.matchday} נשלחה. ממתין לעדכון הבא.`
              : "שליחת התזכורת לא אושרה. בדקו בקבוצה; לא נשלח שוב אוטומטית.";
          console.log(`Reminder ${round.matchday} ${window}: ${result}`);
        }
      }
      if (kickoffWindow(new Date(), new Date(round.first_kickoff))) {
        const key = `kickoff:${round.stage}:${round.matchday}:${round.game_day}`;
        const result = await deliverOnce({
          key,
          body: kickoffMessage(round, "https://scorerush-sigma.vercel.app"),
          metadata: {
            kind: "kickoff",
            day: round.game_day,
            matchday: round.matchday,
          },
          groupId: group.id._serialized,
          state,
          persist,
          send: sendGroupMessage,
        });
        if (result !== "skipped")
          console.log(`Kickoff ${round.game_day}: ${result}`);
      }
    }
    const digests =
      await sql`select id, day, body, published_at from tournament_digests where tournament_id=${config.tournamentId} and published_at>=${state.activatedAt} order by day`;
    for (const digest of digests) {
      if (!eligibleDigest(digest, state)) continue;
      const result = await deliverDigest({
        digest,
        groupId: group.id._serialized,
        state,
        persist,
        send: sendGroupMessage,
      });
      status =
        result === "sent"
          ? `הסיכום של ${digest.day} נשלח. ממתין לערב המשחקים הבא.`
          : "השליחה לא אושרה. בדקו בקבוצה לפני ניסיון נוסף; לא נשלח שוב אוטומטית.";
      console.log(`Digest ${digest.day}: ${result}`);
    }
  } catch (error) {
    status = "החיבור לנתוני הטורניר זמנית לא זמין. ניסיון נוסף בעוד דקה.";
    console.error(
      "WhatsApp scan failed:",
      error instanceof Error ? error.message : String(error),
    );
  } finally {
    running = false;
  }
}
client.on("ready", async () => {
  try {
    let info;
    try {
      info = await client.getInviteInfo(config.inviteCode);
    } catch {
      // Some WhatsApp versions reject invite lookup for existing members.
      // Match the exact invite code through joined groups; never guess by name.
      const chats = await client.getChats();
      for (const candidate of chats.filter((chat) => chat.isGroup)) {
        try {
          if ((await candidate.getInviteCode()) === config.inviteCode) {
            info = { id: candidate.id._serialized };
            break;
          }
        } catch {
          // Reading invite codes may require group administrator rights.
        }
      }
      if (!info)
        throw new Error("Invite does not match an accessible joined group");
    }
    const id = typeof info.id === "string" ? info.id : info.id?._serialized;
    if (!id?.endsWith("@g.us")) throw new Error("No group id");
    // Read the joined group's existing metadata without the library's chat
    // serializer, which refreshes metadata through an incompatible WA API.
    const chat = await client.pupPage.evaluate((groupId) => {
      const collections = window.require("WAWebCollections");
      const model = collections.Chat.get(groupId);
      if (!model?.groupMetadata) return null;
      return {
        id: { _serialized: groupId },
        name: model.name || model.groupMetadata.subject,
        isGroup: true,
        participants: model.groupMetadata.participants
          .getModelsArray()
          .map((p) => ({
            id: { _serialized: p.id._serialized },
          })),
      };
    }, id);
    if (!chat)
      throw new Error("Invited group is not in the linked account's chats");
    if (!chat.isGroup) throw new Error("Not a group");
    // Never auto-join another group or send to a guessed recipient.
    const memberIds = chat.participants?.map((p) => p.id._serialized) ?? [];
    const browserOwnIds = await client.pupPage.evaluate(() => {
      const me = window.require("WAWebUserPrefsMeUser");
      return [
        me.getMaybeMeLidUser()?._serialized,
        me.getMaybeMePnUser()?._serialized,
      ].filter(Boolean);
    });
    const ownIds = [
      ...browserOwnIds,
      client.info.wid?._serialized,
      client.info.me?._serialized,
      client.info.lid?._serialized,
    ].filter(Boolean);
    if (!memberIds.some((id) => ownIds.includes(id))) {
      status =
        "החשבון קושר, אך לא אומתה החברות בקבוצה. נדרש אימות לפני הפעלת השליחה.";
      console.log("Group membership needs verification");
      return;
    }
    if (state.groupId && state.groupId !== id)
      throw new Error("Recipient changed");
    state.groupId = id;
    await persist();
    group = chat;
    status = "מחובר לקבוצה. התזכורות והסיכומים האוטומטיים מוכנים.";
    console.log("WhatsApp ready; verified tournament group");
    await scan();
  } catch (error) {
    console.error("Group verification failed:", error.stack ?? error.message);
    status =
      "לא ניתן לאמת את קבוצת הטורניר. בדקו שהחשבון חבר בקבוצה וקישור ההזמנה תקין.";
  }
});
const timer = setInterval(scan, 60000);
async function stop() {
  clearInterval(timer);
  server.close();
  await client.destroy().catch(() => {});
  await sql.end();
  process.exit(0);
}
process.once("SIGTERM", stop);
process.once("SIGINT", stop);
await client.initialize();

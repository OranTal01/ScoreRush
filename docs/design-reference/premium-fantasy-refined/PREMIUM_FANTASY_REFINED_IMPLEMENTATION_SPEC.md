# PREMIUM_FANTASY_REFINED_IMPLEMENTATION_SPEC

Implementation spec for the **Premium Fantasy Refined** football-prediction tournament UI. Written for an AI coding agent (Claude Code) targeting **React + Next.js (App Router) + TypeScript + Tailwind CSS + Motion (framer-motion v11+)**.

Source of truth: `C_PremiumFantasy_Refined_Mobile.dc.html` and `C_PremiumFantasy_Refined_Desktop.dc.html`. This document records only what is already approved; it does not introduce new visuals, screens, palette, or features. All copy is Hebrew RTL; scores, dates, and Latin names are LTR-isolated.

---

## 1. DESIGN INTENT

**Emotional goal.** A calm, mature, premium home for a private friends-and-family World Cup prediction league. It should feel like a high-end sports product you open daily for weeks without fatigue — competitive and rewarding, never loud. Color is used almost exclusively to carry *meaning*, not decoration.

**Visual hierarchy (what the eye lands on, in order):**
1. **Ranking hero** — the gold rank circle (#3) and the gold total-points number. Largest type on the screen, centered, gold on near-black.
2. **Next Match card** — the interactive core. Oversized readable scores, obvious ± controls, full-width primary action.
3. **Everything else** — leaderboard/podium, latest result, achievements, activity feed, tournament leaders. Neutral surfaces, quiet until the user scans them.

**Must feel:** premium, calm, competitive, rewarding, social, elegant, comfortable for daily use.

**Must NOT feel like:**
- A **casino** — no neon glow, no saturated purple/pink gradients, no glowing borders on every surface, no coin/jackpot motifs.
- A **generic SaaS dashboard** — no data-table chrome, no chart-first layout, no admin-template header.
- A **childish mobile game** — restrained emoji only (🥇🥈🥉👑🎯🔥⚽ used as semantic markers, not toys), no bouncy cartoon everything, no rainbow palette.

**Rule of thumb:** surfaces are neutral navy/slate; a splash of color means *something happened* (points, success, live, celebration). If a color isn't communicating state, it should not be there.

---

## 2. DESIGN TOKENS

### 2.1 Colors

Define as CSS variables and mirror into `tailwind.config.ts` under `theme.extend.colors`.

| Token | Hex / value | Usage |
|---|---|---|
| `--bg-page` | `#080B14` | Page background (near-black navy). App root. |
| `--bg-elevated` | `#0E1320` | Top bar, bottom nav, hero inner circle backing, gradient floors. |
| `--surface-card` | `#151B2A` | Primary card surface (all main cards). |
| `--surface-card-2` | `#1B2233` | Secondary surface: inner rows, stat tiles, badge tiles, silver podium block. |
| `--surface-plum` | `#241D32` | Deep plum support — achievements card gradient top, gold-text-on-plum. |
| `--interactive` | `#5FA8D3` | Primary interactive: + buttons, save button, selected tab, own-row accents, "climber" badge. Soft cyan. |
| `--interactive-2` | `#7C83C9` | Secondary interactive / avatar-ring partner, "top assists" leader. Muted slate-blue. |
| `--gold` | `#D6B56E` | Rank, points, countdown, 1st place, crown, top-scorer, +points badges, achievements "sniper". Warm restrained gold. |
| `--silver` | `#AEB6C2` | 2nd place avatar ring, 2nd place points. |
| `--bronze` | `#C9A876` | 3rd place / own-podium number text (block bg `#3A2F26`). |
| `--success` | `#4FAF83` | Saved confirmation, rank-up ▲, "exact score" positive text, top-scoring-team value. |
| `--coral` | `#C87878` | Celebration-only accent: streak flame label, confetti particle, finished-state accent. |
| `--danger` | `#D85C6A` | LIVE pulse dot/badge, notification dot, rank-down ▼. |
| `--text-primary` | `#F2F4F8` | Headlines, names, primary numerals. |
| `--text-secondary` | `#98A2B3` | Labels, timestamps, captions, inactive nav. |
| `--text-muted` | `#6B7688` | PHOTO placeholders, metadata (team/nation subline), 4th-tier text. |
| `--border` | `rgba(255,255,255,0.08)` | Default card border. |
| `--border-strong` | `rgba(255,255,255,0.10)` | Score-control minus button outline, hairline dividers at higher contrast. |
| `--overlay` | `rgba(8,11,20,0.72)` | Modal/scrim over page (bottom sheets, dialogs). |
| `--focus-ring` | `#5FA8D3` at 2px + `rgba(95,168,211,0.35)` 3px halo | `:focus-visible` ring on all interactive elements. |

Divider hairlines inside cards: `rgba(255,255,255,0.06)`.
Highlighted own-row: fill `rgba(95,168,211,0.10)`, border `rgba(95,168,211,0.35)`.
Gold "chip"/badge fill: `rgba(214,181,110,0.12–0.14)`. Success chip fill: `rgba(79,175,131,0.12–0.14)`. Danger strip fill: `rgba(216,92,106,0.12)`.

**Gradients (the only permitted gradients — do not add more):**
- Hero card: `linear-gradient(160deg,#151B2A,#0E1320)`.
- Achievements card: `linear-gradient(160deg,#241D32,#1B2233)`.
- Avatar rings: `linear-gradient(135deg,#5FA8D3,#7C83C9)` (self), `linear-gradient(135deg,#D6B56E,#B89350)` (1st), `linear-gradient(135deg,#AEB6C2,#7C8696)` (2nd).
- Gold rank ring: `linear-gradient(135deg,#D6B56E,#B8935088)`.
- 1st-place podium block: `linear-gradient(180deg,#D6B56E,#B89350)`.
- Hero glow wash (decorative, very low alpha): `radial-gradient(ellipse,rgba(214,181,110,0.10),transparent 70%)`.

### 2.2 Typography

- **Family:** `Rubik` (Google Fonts, weights 400/500/600/700/800/900) as the single UI family, Hebrew + Latin. Fallback stack: `Rubik, system-ui, "Segoe UI", Arial, sans-serif`. Load via `next/font/google` with `subsets: ['latin','hebrew']`, `display: 'swap'`.
- **Weights in use:** 500 (secondary labels), 600 (captions/meta), 700 (body-strong), 800 (headings, team names, tab labels), 900 (hero numbers, scores, podium points).

**Type scale — mobile → desktop:**

| Role | Mobile | Desktop | Weight | Line-height | Tracking |
|---|---|---|---|---|---|
| Hero total points | 48px | 46px | 900 | 1.0 | 0 |
| Hero rank number | 44px | 42px | 900 | 0.9 | 0 |
| Score value (Next Match) | 52px | 62px | 900 | 1.0 | 0 |
| Score value (non-open display) | 56px | 68px | 900 | 1.0 | 0 |
| Result score | 28px | 38px | 900 | 1.0 | 0 |
| Card title | 13–14px | 13–14px | 800 | 1.2 | 0 |
| Team name | 16px | 19px | 800 | 1.2 | 0 |
| Greeting name | 18px | 18px | 800 | 1.2 | 0 |
| Body / row text | 12–12.5px | 12–13px | 600–700 | 1.4 | 0 |
| Labels / captions | 10–11px | 10–11px | 500–600 | 1.3 | tournament id label +1px (`letter-spacing:1px`) |
| Countdown value | 15px | 16px | 800 | 1 | 0.5px |
| Stat tile number | 19px | 18px | 800 | 1 | 0 |

**Numeric rules:** enable `font-variant-numeric: tabular-nums` on every changing number (points counter, scores, countdown, leaderboard points, stat tiles) so width never jitters. Scores and points are always Latin digits.

**Hebrew rules:** UI copy is Hebrew, `dir="rtl"` at the app root. Body text uses `text-wrap: pretty`. Do not letter-space Hebrew (tracking 0). Weight 800 is the heading default.

**LTR isolation:** wrap scores, `2 – 1` result strings, dates/times (`17 ביולי · 21:00`), countdown `HH:MM:SS`, and Latin names (`Kylian Mbappé`, `France`, `Lusail`) in an inline element with `dir="ltr"; unicode-bidi: isolate` (Tailwind: a `.ltr` utility → `direction:ltr; unicode-bidi:isolate; display:inline-block`). This keeps `2 – 1` from flipping to `1 – 2` and keeps the minus/colon in place inside RTL flow. The score-control triplet (− value +) sits in a fixed 3-column grid so it is order-stable regardless of direction.

### 2.3 Spacing

- Page padding (mobile content): `14px 16px` horizontal, `90px` bottom (clears fixed nav), header `50px 18px 8px` (top accounts for status bar).
- Card padding: `16px` standard; hero `18px`; compact rows `8–12px`.
- Inter-card gap (mobile vertical stack): `14px`.
- Section spacing on presentation/desktop: `16–18px` grid gap.
- Bottom navigation height: **`56px` content + safe-area** (icons row `padding:11px 0 16px`); reserve `env(safe-area-inset-bottom)` below.
- Desktop grid: three columns `340px | 1fr | 360px`, gutter `18px`, outer padding `20px 28px`, top bar height `72px`.
- Stat-tile gap: `8px`. Podium column gap: `8px`.
- Safe-area: apply `padding-bottom: env(safe-area-inset-bottom)` to fixed bottom nav and `padding-top: env(safe-area-inset-top)` to the header on mobile web/standalone.

### 2.4 Radii

- Cards: `22px` (main), `24px` (hero, Next Match).
- Buttons (save / primary): `16px`.
- Pills / chips / badges: `20px` (full pill).
- Stat tiles / inner rows: `14px`; leaderboard rows `12px`.
- Avatars: `50%` (circular). LV badge: `8px`.
- Score-control ± buttons: `50%` (circular).
- Notification button: `14px`.
- Podium blocks: `12px 12px 0 0` (top corners only).

### 2.5 Shadows and glows

- Phone frame (presentation only, not in-app): `0 30px 80px rgba(0,0,0,0.5)`.
- Desktop card lift (presentation frame): `0 20px 50px rgba(0,0,0,0.55)`.
- **In-app cards: NO drop shadow.** Elevation is communicated by surface color step (`#0E1320` → `#151B2A` → `#1B2233`) and the 1px `--border`, not shadow.
- **Glow is allowed ONLY** as the hero's low-alpha gold radial wash (`rgba(214,181,110,0.10)`) and the LIVE dot's expanding ring pulse (`box-shadow` animation, danger color, see §7).
- **Glow is FORBIDDEN** on: card borders, avatars, buttons, badges, podium, text. No `filter: drop-shadow` neon, no colored box-shadow on resting elements. If an element is not the hero wash or the live pulse, it has no glow.

---

## 3. RESPONSIVE LAYOUT

Breakpoints (Tailwind): `sm 640`, `md 768`, `lg 1024`, `xl 1280`, `2xl 1536`. Layout switches from single-column to three-column at **`lg` (1024px)**.

| Width | Layout |
|---|---|
| **375px** (iPhone SE/mini) | 1-col. Card content width = viewport − 32px (`16px` side padding). Score-control buttons stay 40px; if the − value + row would overflow, reduce inter-item gap from 12px to 8px (never shrink touch target). |
| **390px** (design baseline) | 1-col, exact reference. Card inner width 358px. |
| **430px** (Pro Max) | 1-col; content max-width caps at **480px** and centers; side padding grows to `20px`. Do not stretch cards full-bleed beyond 480px. |
| **768px** (tablet portrait) | Still 1-col but centered content column **max-width 560px**; bottom nav remains fixed. Optionally 2-col for stat tiles only. |
| **1024px** | Switch to 3-col grid `340 / 1fr / 360`, top bar replaces bottom nav, max content width **1320px** centered. |
| **1440px** | Same 3-col; content locked at **1320px**, extra space is page margin. Do not widen columns. |

**Mobile specifics:**
- Single vertical scroll; `overflow-x: hidden` on the shell — **zero horizontal overflow** at any width.
- Bottom nav is **fixed** (`position: sticky`/fixed to viewport bottom) with safe-area inset; the scroll region pads `90px` at the bottom so the last card clears it.
- Header is **non-sticky** (scrolls away). Nothing else is sticky.
- Score controls: ± buttons `40×40px` (min touch target 44px — extend hit area with padding/`::before`), score number min-width `40px` to prevent reflow when digits change.

**Desktop specifics (≥1024px):**
- Grid `grid-template-columns: 340px 1fr 360px; gap:18px; padding:20px 28px`.
- Column priority: **center** (Next Match + Latest Result) is primary; **left** (hero + achievements) second; **right** (leaderboard + activity) third. On `lg` exactly, if space is tight, right column may drop to `340px`.
- Center panel is fluid (`1fr`); left `340px`, right `360px` fixed. Max content width `1320px`, centered.
- Navigation is a **top bar** (72px) with horizontal tabs centered; active tab = `rgba(95,168,211,0.12)` fill + `#5FA8D3` text, radius 12px.
- Cards top-align within each column (`align-items:flex-start`); columns are independent flex stacks with `16px` vertical gaps; second card in a column may `flex:1` to fill height.

**Mobile↔desktop mapping.** Same cards, same order, re-flowed:
- Mobile order (top→bottom): header → hero → Next Match → latest result → leaderboard → achievements → activity → tournament leaders → bottom nav.
- Desktop: header(top bar); **left col** = hero, achievements; **center col** = Next Match, latest result; **right col** = leaderboard, activity. (Tournament leaders + tournament-wide extras live below the fold / secondary on desktop, matching the mobile leaders card.) No card is removed between layouts; only column placement changes.

---

## 4. GLOBAL MOTION SYSTEM

Use **Motion (framer-motion)** for orchestrated/enter-exit/looping animation; use CSS transitions for simple hover/press color/opacity. Respect `prefers-reduced-motion` globally.

**Duration tokens:**
```
--motion-fast:   120ms   // hover, press, color/opacity
--motion-normal: 220ms   // state changes, chip in/out, button morph
--motion-slow:   420ms   // card enter, podium blocks, count-up base
```

**Easing:**
```
--ease-standard: cubic-bezier(0.4, 0.0, 0.2, 1)   // most transitions
--ease-out:      cubic-bezier(0.0, 0.0, 0.2, 1)   // enters
--ease-in:       cubic-bezier(0.4, 0.0, 1, 1)     // exits
--ease-emphasis: cubic-bezier(0.2, 0.8, 0.2, 1)   // rank/points arrivals
```

**Springs (Motion):**
```
spring.soft   = { type:'spring', stiffness:260, damping:26, mass:0.9 }  // entrances (rise/bounce)
spring.snappy = { type:'spring', stiffness:420, damping:30 }            // press/scale, save morph
spring.float  = handled via keyframes/tween loop, not spring (see §5/§6)
```

**Stagger:** list children `0.06s` (60ms) between items; podium uses explicit per-item delays (§6).

**Enter transitions:** cards/lists fade + translateY. Default variant `rise`: `{opacity:[0,1], y:[20,0]}` mobile / `y:[16,0]` desktop, `spring.soft`, once (viewport `{ once:true, margin:'-10%' }`).

**Exit transitions:** `{opacity:0, y:8}` at `--motion-normal` `--ease-in`. Only where components unmount (state swaps, toasts).

**Hover:** `--motion-fast`, transform/opacity/background-color only. Buttons: background lightens ~6%. Rows: background to `#1B2233`.

**Press:** `scale: 0.96` for buttons/tiles, `spring.snappy`. Score ± buttons `scale:0.90`.

**Layout transitions:** leaderboard rows and the own-row use Motion `layout` + `LayoutGroup` so rank reordering animates position (`spring.soft`); guard with reduced-motion.

**Reduced motion (`prefers-reduced-motion: reduce`):** disable all looping (float, crown, glow pulse, confetti) — render final resting frame. Replace enters/count-up with instant final state or a ≤120ms opacity fade only. No transforms that move layout. Provide a single `useReducedMotionSafe()` hook and gate every animated variant through it.

---

## 5. RANK HERO ANIMATION

Container enters via `rise` (`spring.soft`, once). Children then run:

**Rank circle (#3, gold ring):**
- Gentle vertical float loop. Travel: **−4px** at midpoint (`translateY(0 → -4px → 0)`).
- Duration: **4000ms**, `ease-in-out`, `repeat: Infinity`, `repeat-type: mirror`. Delay: `0ms`.
- Loops infinitely. The 🥉 medal is a child of the circle and floats with it (no independent motion).
- Reduced motion: no transform, static.

**Rank number entrance:** counts/reveals with the circle; the numeral `3` fades+scales `{opacity:[0,1], scale:[0.8,1]}`, `--motion-slow`, `--ease-emphasis`, delay `120ms`. No per-digit odometer (single digit).

**Rank movement indicator (chip "▲ עלית 2 מקומות השבוע"):**
- Entrance: `{opacity:[0,1], y:[-6,0]}`, `--motion-normal`, `--ease-out`, delay `200ms`.
- Colors: **up = success `#4FAF83`** (fill `rgba(79,175,131,0.12)`), **down = danger `#D85C6A`**, **unchanged = muted `#98A2B3`** with a "–" glyph and no arrow.
- Arrow glyph ▲/▼ precedes the text; never rely on arrow alone — text states the direction.

**Total points counter (`247`, gold):**
- Count-up from **0 → 247**, duration **900ms**, easing = cubic-out (`1 - (1-p)^3`), `requestAnimationFrame`.
- Formatting: integer, `tabular-nums`, no thousands separator below 10,000 (locale `he-IL` grouping above).
- Animates **on first mount** and **on every value change** (when points increase after a scored match), animating from previous value to new value at `--motion-slow`. Reduced motion: set final value instantly.

**Point-breakdown stat tiles (168 / 39 / 40):** stagger in with the hero, `rise` variant, stagger `60ms`. Numbers are static (not counted up) to keep the hero's single count-up (points) as the focal motion.

**Achievement chip:** part of the rank-movement chip above; single instance.

---

## 6. PODIUM AND LEADERBOARD MOTION

**First-place crown (👑):**
- Gentle float loop, travel **−4px** (`translateY(0→-4px→0)`).
- Rotation: **none**.
- Duration **3400ms**, `ease-in-out`, `repeat:Infinity`, mirror. Delay `0ms`.
- **No gold glow pulse** (glow is forbidden here). The gold is expressed by color only.
- Reduced motion: static.

**Podium entrance (bounce-in):** each column uses variant `bounceIn`: `{opacity:[0,1], scale:[0.7,1], y:[16,0]}` with a slight overshoot (`spring.soft`, or keyframe `scale:[0.7,1.06,1]`), duration ~**600ms**.
- **Order & stagger:** 1st place delay **0ms** → 2nd place delay **150ms** → 3rd place delay **300ms**. (First rises first, then silver, then bronze — matching the approved timing.)
- Vertical offsets / block heights (visual ranking): 1st block `72px` (mobile) / `66px` (desktop), 2nd `52/48px`, 3rd `42/38px`.
- Medal entrance: 🥇🥈🥉 fade in with their column (no separate delay).
- Point number under each avatar: fades in with column; no count-up on podium (keeps hero's count-up unique).

**Current-participant row (own row in list):**
- Highlight: fill `rgba(95,168,211,0.10)`, border `1px rgba(95,168,211,0.35)`, rank + points in `--interactive`.
- Border does not animate on rest. On rank change, the row uses **Motion `layout`** to slide to its new position (`spring.soft`), and the ▲/▼ indicator re-enters (`--motion-normal`).
- Rank-movement arrow inside row: up `#4FAF83` ▲, down `#D85C6A` ▼, unchanged muted "–".

**Leaderboard rows (list below podium):**
- Enter: `rise` with `60ms` stagger, once.
- Hover (desktop/pointer): background → `#1B2233`, `--motion-fast`.
- Press (touch): `scale:0.98`, `spring.snappy`.
- Expanded state (mobile): tapping a row may expand to show that participant's match-points / bonus split; expansion uses `layout` height animation `--motion-normal`, content fades in `--motion-fast`. (Behavior optional; if implemented, must not cause horizontal overflow.)

---

## 7. NEXT MATCH CARD

Shared shell: `--surface-card` (`#151B2A`), `1px --border`, radius `24px`, stage-label pill in gold, symmetric teams grid (2-col: flag 44px mobile / 52px desktop + team name), score row as fixed 3-col grid `1fr auto 1fr` with `:` divider so order is stable in RTL.

State transitions between Open/Saved/Locked/Live/Finished cross-fade the status region (`--motion-normal`, `--ease-standard`); score values morph with a digit transition (see below). Use Motion `AnimatePresence` on the swappable region.

| State | Background | Border | Label / status | Controls | Countdown | Notes |
|---|---|---|---|---|---|---|
| **Open** | card default | default | gold stage pill | ± controls active, score editable | gold, live-ticking | Save button visible (full width). |
| **Saved** | card default | default | gold stage pill | ± still active (can re-edit) | gold, live-ticking | Save button morphs to green "✓ ההימור נשמר · הקש לעריכה"; tapping returns to Open. |
| **Locked** | card default | default | strip `#1B2233`, muted text | controls hidden; show final chosen score as large static numerals | replaced by "🔒 ההימור ננעל · ההימור שלך 2–1" | No editing; controls `disabled`. |
| **Live** | card default | default | strip `rgba(216,92,106,0.12)`, `#D85C6A` text | static score display | replaced by live clock "חי · 63'" + user prediction | Pulse dot animates. |
| **Finished** | card default | default | strip `rgba(214,181,110,0.14)`, `#D6B56E` text | static final score | replaced by "🎯 ניחש תוצאה מדויקת! קיבלת 9 נקודות" (copy varies by points) | Confetti runs once (see §8 rules; coral/gold particles). |

**Score controls:**
- **− button:** `40×40px` mobile / `46×46px` desktop, circular, `background:#1B2233`, `1px rgba(255,255,255,0.10)`, glyph `#5FA8D3`.
- **+ button:** same size, circular, `background:#5FA8D3`, glyph `#08121C` (no border).
- **Touch target:** minimum `44×44px` — pad the hit area beyond the visual 40px with an invisible `::before`/padding.
- **Score number:** 52px mobile / 62px desktop, weight 900, `#F2F4F8`, `min-width:40/44px`, `tabular-nums`.
- **Hover (pointer):** + lightens ~6%, − background → `#212a3d`. `--motion-fast`.
- **Press:** `scale:0.90`, `spring.snappy`.
- **Disabled (locked/live/finished):** controls unmounted (not just greyed); if greyed variant needed, `opacity:0.4; pointer-events:none`.
- **Keyboard:** buttons are real `<button>`; `ArrowUp`/`Arrowright`(RTL-aware) increments, `ArrowDown`/`Arrowleft` decrements when the score group is focused; `Home`=0. Range clamp **0–19**.
- **Focus ring:** `--focus-ring` (2px `#5FA8D3` + 3px `rgba(95,168,211,0.35)` halo), `:focus-visible` only.
- **Haptic:** on native/PWA, fire `navigator.vibrate?.(8)` on each increment (progressive enhancement; guard for support).
- **Number transition on ±:** the digit swaps with a **vertical slide + fade** (`{y:[±8,0], opacity:[0,1]}`, `--motion-fast`, `--ease-out`) so increment feels directional (new value slides from above on +, below on −). Reduced motion: instant swap.

**Save button:**
- **Idle:** full-width, `#5FA8D3`, text `#08121C`, weight 800, 16px, radius 16px, padding 16px (mobile) / 15px (desktop, `flex:1` beside countdown).
- **Hover:** background lighten ~6%, `--motion-fast`.
- **Press:** `scale:0.98`, `spring.snappy`.
- **Loading:** label → inline spinner (16px, 2px stroke, `#08121C`), button width fixed (no reflow), `aria-busy=true`, disabled.
- **Success / Saved confirmation:** button **morphs in place** to green variant: background → `rgba(79,175,131,0.14)`, border `1px rgba(79,175,131,0.4)`, text `#4FAF83`, leading ✓ inside a `20px` `#4FAF83` circle. Morph = `--motion-normal` color/border tween + `scale` `pop` keyframe `[0.7,1.08,1]`. Message text: "ההימור נשמר · הקש לעריכה". Persists until user edits or navigates (no auto-dismiss on this card; it is a state, not a toast).
- **Error:** background → `rgba(216,92,106,0.12)`, border danger, text `#D85C6A`, label "לא נשמר · נסה שוב"; shake keyframe `x:[0,-4,4,-3,3,0]` `--motion-normal`; reverts to idle on retry. Announce via `role="alert"`.

**Countdown states (time until predictions lock):**
- **Normal (>60min):** gold `#D6B56E`, static value, `tabular-nums`, ticking each second (update text only, no layout change).
- **<60 min:** unchanged color; value shows `MM:SS` emphasis is fine but keep `HH:MM:SS` format consistent.
- **<10 min:** color shifts to coral `#C87878`; label "ננעל בקרוב".
- **<1 min:** color danger `#D85C6A`; the value **pulses opacity** `[1,0.55,1]` at 1000ms loop (reduced motion: static danger color, no pulse).
- **Lock transition:** at 0, cross-fade (`--motion-normal`) countdown → Locked strip; controls unmount; card state → Locked.
- **Live transition:** at kickoff, cross-fade Locked → Live strip; start live-clock text; start dot pulse.
- **Pulse rules:** only the <1min countdown and the LIVE dot pulse. Nothing else.
- **LIVE dot pulse:** `9px` (mobile) / `10px` (desktop) circle, `#D85C6A`, expanding ring via box-shadow keyframe `0 0 0 0 rgba(216,92,106,0.45) → 0 0 0 9–10px rgba(216,92,106,0) → 0`, **1300ms** loop. This is the one permitted glow-like effect besides the hero wash.

---

## 8. LATEST RESULT CARD

- **Result entrance:** card `rise` on scroll-in. The `2 – 1` score is LTR-isolated, weight 900.
- **Points badge (`+6` etc.):** enters with `pop` (`scale:[0.7,1.08,1]`, `--motion-normal`, `--ease-emphasis`), delay `120ms` after card. Fill by outcome: 9/6 pts gold `rgba(214,181,110,0.14)` text `#D6B56E`; 3 pts same gold family; 0 pts muted `#1B2233` text `#98A2B3` (no celebratory color).
- **Scoring explanation reveal:** the explanatory line fades+`y:[6,0]` `--motion-normal`, delay `200ms`. Copy states the *reason* using approved terminology (see §10), e.g. "ניחש את המנצחת + הפרש השערים — לא ניחש תוצאה מדויקת, לכן 6 נקודות במקום 9."

**Outcome variants:**
- **9 pts — exact score ("ניחש תוצאה מדויקת"):** success/gold framing; **confetti celebration** (see below).
- **6 pts:** gold badge, explanation "מנצחת + הפרש שערים נכון".
- **3 pts:** gold badge (lower), explanation "ניחש את המנצחת בלבד".
- **0 pts:** muted badge `0`, explanation "לא ניחש את המנצחת", no color celebration, no confetti.

**Exact-score confetti:**
- Particles: small squares (`4–6px`), colors drawn from `#D6B56E`, `#C87878`, `#5FA8D3` (gold/coral/cyan only — no rainbow).
- Behavior: `translateY(-8px → 52px)` + `rotate(0 → 220deg)` + `opacity(0.9 → 0)`, per-particle duration **1100–1400ms**, slight per-particle delay (0/0.2/0.5s).
- Density: **low — 3–6 particles** across the banner width (restrained, premium; not a burst).
- **Runs once** when the finished/exact state first appears (guard with a ref/flag so re-render doesn't replay). Not looped.
- Reduced motion: no confetti; show the static gold "🎯 ניחש תוצאה מדויקת! קיבלת 9 נקודות" banner only.

---

## 9. ACHIEVEMENTS AND BADGES

Card: plum gradient (`160deg,#241D32,#1B2233`), 4 tiles (`🎯 צלף` gold, `🔥 רצף חם` coral, `📈 מטפס` cyan, `🔒 נעול` muted @ `opacity:0.45`).

- **Badge idle:** static; icon centered on `#151B2A` tile, label below in the badge's semantic color.
- **Badge unlock animation:** on transition locked→unlocked: tile `opacity 0.45→1` (`--motion-normal`), icon `pop` (`scale:[0.7,1.15,1]`, `spring.snappy`), label color fades from muted to semantic. Optional one-time ring flash using the tile's color at low alpha (≤`--motion-slow`), no persistent glow.
- **Streak flame (🔥):** the "רצף 4 מדויקים" header marker may pulse **scale** `[1,1.08,1]` at 1600ms loop, coral. Reduced motion: static.
- **Locked badge:** `opacity:0.45`, `🔒`, muted label; not interactive beyond showing a tooltip of unlock criteria.
- **Hover/press:** tile hover background → `#1B2233`; press `scale:0.96`.
- **Notification dot:** newly-unlocked badge shows a `#D85C6A` dot (top-inline-start) until viewed.
- **Concurrency:** **at most one** unlock animation plays at a time; queue additional unlocks `150ms` apart. The streak pulse + one unlock may coexist; never run 3+ looping animations in this card simultaneously.

---

## 10. ACTIVITY FEED

Card `#151B2A`; rows = 32px circular icon chip (tinted by type) + text + timestamp; hairline dividers `rgba(255,255,255,0.06)`.

- **Item entrance:** `rise` with **60ms stagger**, once on scroll-in.
- **Icon movement:** icon chip `pop` (`scale:[0.8,1]`) with its row; no continuous motion.
- **Divider style:** `1px` bottom border `rgba(255,255,255,0.06)`; last row no divider.
- **New-item highlight:** newly-arrived item slides in from top (`y:[-8,0]`, opacity) `--motion-normal`, with a brief background wash of the item type color at `0.06` alpha fading out over `--motion-slow`. Uses `layout` so existing items push down without jump.
- **Timestamp:** `--text-secondary`, 10.5px, LTR-isolated if numeric ("לפני 12 דקות" is Hebrew and stays RTL; absolute times LTR-isolated).
- **Empty state:** centered muted line "עוד לא הייתה פעילות — המשחקים הבאים כבר בדרך" + faded ⚽ glyph; no card border emphasis.

**Copy terminology (MANDATORY).** Never use **קלע / קלעה**. Use:
- **כבש** / **הבקיע** — scored a goal (player).
- **ניחש תוצאה מדויקת** — predicted the exact score (9 pts).
- **ניחש את המנצחת** — predicted the winning team.
- **ניחש את הפרש השערים** — predicted the goal difference.
- **צבר נקודות** — accumulated points.
- **עלה בדירוג** / **ירד בדירוג** — moved up / down the ranking.

Example feed lines: "יעל ניחשה תוצאה מדויקת · Brazil 3–1 · +9", "דניאל עלה בדירוג למקום הראשון", "אורן פתח רצף של 4 ניחושים מדויקים", "מיכל הובילה בבונוס מלך השערים". Apply the same terminology everywhere (Latest Result explanation, notifications).

---

## 11. TOURNAMENT LEADERS

Card `#151B2A`, three rows: מלך השערים (gold), מלך הבישולים (secondary `#7C83C9`), הקבוצה הכי קולעת → rename per terminology to **"הקבוצה הבקיעה ביותר"** / **"הקבוצה שהבקיעה הכי הרבה"** (success `#4FAF83`).

- **Row layout:** `46px` leading media (player PHOTO placeholder `border-radius:14px`, or nation flag block for team) + category label (color-coded) over name + Latin nation subline (`--text-muted`) + trailing big value (weight 900, category color) with unit caption.
- **Photo placeholder:** diagonal hatch `repeating-linear-gradient(45deg,#1B2233,#1B2233 6px,#212a3d 6px,#212a3d 12px)`, centered "PHOTO" label `#6B7688`, 9px. When a real image is supplied, fill the same rounded box (`object-fit:cover`).
- **Value animation:** count-up on first reveal only, duration `--motion-slow`, `tabular-nums`; subsequent changes tween at `--motion-normal`.
- **Tied first-place:** if two leaders tie, show both stacked in the row with a small "שווים" pill (gold), value shown once; do not fabricate a tiebreak.
- **Source metadata:** small `--text-muted` caption allowed (e.g. "5 משחקים"); no external attribution UI.
- **Loading:** skeleton — hatch box + two grey bars (`#1B2233`) shimmering via `--motion-slow` opacity loop (reduced motion: static grey).
- **Fallback (no data yet):** "טרם נצברו נתונים" muted line in place of value.
- **Error:** row shows "לא ניתן לטעון" muted + a small retry text button (`#5FA8D3`); `role="alert"` on the card region.

---

## 12. BOTTOM NAVIGATION (mobile) / TOP NAV (desktop)

**Mobile bottom nav:**
- Height: **56px content + `env(safe-area-inset-bottom)`**; background `#0E1320`; top border `1px --border`. Fixed to viewport bottom.
- Items: בית / משחקים / טבלה / בונוסים (4 tabs; achievements reachable via profile/hero on mobile). Icon `20px` line icon (stroke 2), label `9.5px`.
- **Active:** icon + label `#5FA8D3`, label weight 800. **Inactive:** `#6B7688`, weight 600.
- **Active indicator:** color only (no underline bar in the approved design); optionally a `2px` top inset accent in `#5FA8D3` may be added but is not required — if added, it animates with `layout`/shared-layout between tabs `--motion-normal`.
- **Press feedback:** `scale:0.94` on the tab, `spring.snappy`; color transition `--motion-fast`.
- **Tab transition:** route content cross-fades (`opacity`, `--motion-normal`); no horizontal slide (avoids RTL direction ambiguity).

**Desktop equivalent:** horizontal top-bar tabs (בית/משחקים/טבלה/בונוסים/הישגים), 72px bar, active = `rgba(95,168,211,0.12)` pill + `#5FA8D3` text (radius 12px), inactive `#98A2B3`. Hover inactive → text `#F2F4F8`, `--motion-fast`.

---

## 13. INTERACTION STATES

Define for **every** interactive element (buttons, ± controls, tabs, rows, chips, badges, retry links):

| State | Treatment |
|---|---|
| **default** | Token colors as specified per component. |
| **hover** (pointer only) | Background lighten ~6% (buttons) or → `#1B2233` (rows/tiles); `--motion-fast`; never on touch. |
| **focus-visible** | `--focus-ring` (2px `#5FA8D3` + 3px `rgba(95,168,211,0.35)` halo); visible on keyboard only (`:focus-visible`), never suppressed. |
| **pressed** | `scale:0.96` (buttons/tiles/tabs), `0.90` (± controls), `0.98` (rows); `spring.snappy`. |
| **selected** | Active tab pill; own-row highlight; selected score retains value with cyan emphasis where applicable. |
| **disabled** | `opacity:0.4; pointer-events:none; cursor:not-allowed`; or unmounted (locked controls). No focus. |
| **loading** | Spinner replaces label, fixed width, `aria-busy`, disabled. |
| **success** | Green variant (save→saved); `--success`. |
| **error** | Danger variant + shake + `role="alert"`; `--danger`. |

---

## 14. ACCESSIBILITY

- **Contrast:** body text `#F2F4F8`/`#98A2B3` on `#151B2A`/`#080B14` meets WCAG AA (≥4.5:1 for text, ≥3:1 for large/UI). `--text-muted #6B7688` only for ≥14px or non-essential meta. Gold `#D6B56E` on dark for large numerals passes AA-large; do not use gold for small body text on card surfaces.
- **Focus-visible:** every interactive element shows `--focus-ring` on keyboard focus; managed with `:focus-visible`. Logical tab order follows visual order in RTL.
- **Minimum touch target:** 44×44px (extend ± visual 40px via padding). Nav tabs full-height tap area.
- **Reduced motion:** honor `prefers-reduced-motion: reduce` — disable float/crown/glow-pulse/confetti/count-up/shake; keep ≤120ms opacity fades. Single gate hook.
- **Screen-reader labels:** ± buttons `aria-label="הוסף שער לצרפת"` / `"הפחת שער לארגנטינה"`; score group `role="group" aria-label="ניחוש תוצאה"`; save button announces state changes via `aria-live="polite"` (saved) / `role="alert"` (error); countdown `aria-label` reads remaining time in words, updated politely (throttle to ~every 30s to avoid chatter); live/finished strips `aria-live="polite"`.
- **Semantic roles:** cards are `<section>` with `aria-labelledby` the card title; leaderboard is an ordered list `<ol>`; nav is `<nav>` with `aria-current="page"` on active tab; podium is a list with accessible rank/points text.
- **Keyboard navigation:** all actions reachable/operable by keyboard; ± via Arrow keys when group focused; Enter/Space activate buttons; Esc closes any expanded row/sheet.
- **Color-independent state:** never rely on color alone — rank movement uses ▲/▼ glyph **and** text; live uses "חי" text + dot; success/error use icon + text; points differences stated in words in the explanation line.
- **RTL/LTR:** root `dir="rtl"`; scores/dates/times/Latin names wrapped `dir="ltr"; unicode-bidi:isolate`. Mirror directional icons (chevrons) for RTL; do not mirror flags, medals, or numerals. Score-control grid uses explicit column order so − / value / + never reflow by direction.

---

## 15. IMPLEMENTATION GUIDANCE

- **Motion vs CSS:** use **Motion** for enter/exit, `AnimatePresence` (state swaps, confetti, toasts), looping keyframes (float/crown/pulse), `layout` reordering (leaderboard, activity), and count-up. Use **CSS transitions** for hover/press color/opacity where no orchestration is needed (cheaper, no JS).
- **Transforms only:** float, crown, press-scale, confetti, digit-slide, pulse ring — all `transform`/`opacity` (and `box-shadow` for the one pulse). Never animate `width`/`height`/`top`/`left`/`margin` for these.
- **Layout animation:** allowed only for leaderboard row reorder, activity new-item insertion, and optional row expansion — via Motion `layout`. Everything else avoids layout animation.
- **No layout shift:** reserve space for changing numbers with `tabular-nums` + `min-width`; fix save-button width across idle/loading/success; count-up must not change element width (pad to final width). Confetti is `position:absolute` within an `overflow:hidden` banner — never expands the card.
- **Component boundaries:** `<AppShell>` (dir, fonts, nav) · `<RankHero>` · `<NextMatchCard>` (+ `<ScoreControl>`, `<SaveButton>`, `<Countdown>`) · `<LatestResultCard>` (+ `<Confetti>`) · `<Leaderboard>` (+ `<Podium>`, `<LeaderRow>`) · `<AchievementsCard>` (+ `<Badge>`) · `<ActivityFeed>` (+ `<ActivityItem>`) · `<TournamentLeaders>` (+ `<LeaderStatRow>`) · `<BottomNav>` / `<TopNav>`.
- **Reusable animation variants** (central `motion/variants.ts`): `rise`, `bounceIn`, `pop`, `floatLoop(distance, dur)`, `pulseRing`, `digitSwap(dir)`, `staggerParent(0.06)`. All read from motion tokens and route through `useReducedMotionSafe()`.
- **Motion token naming:** `motion.duration.fast|normal|slow`, `motion.ease.standard|out|in|emphasis`, `motion.spring.soft|snappy`. Mirror durations/eases as CSS vars for the CSS-transition path.
- **Avoid over-animation:** max **one** looping animation focal per card; entrances play **once** (`viewport={{once:true}}`); no animation on every scroll; celebrations run once per event.
- **Performance:** `will-change: transform` only on actively-looping elements (float/crown/pulse) and remove when reduced-motion; use `content-visibility:auto` on below-fold cards; memoize list rows; throttle countdown to 1s tick updating text node only; confetti uses a fixed small particle count.

Do not add backend logic, change scoring/business rules, or invent user data — bind to existing data props/hooks.

---

## 16. IMPLEMENTATION CHECKLIST

- [ ] **Desktop parity** — 3-col `340/1fr/360`, gutter 18px, max width 1320px, top-bar nav, card placement per §3.
- [ ] **Mobile parity** — 1-col, fixed bottom nav (56px + safe area), 90px scroll pad, content cap 480px ≥430w.
- [ ] **Motion parity** — rank float (−4px/4000ms), crown float (−4px/3400ms), podium stagger (0/150/300ms), points count-up (0→247/900ms), score digit slide, save morph, confetti-once, all present.
- [ ] **RTL parity** — `dir=rtl`; scores/dates/Latin names LTR-isolated; score grid order-stable; chevrons mirrored, flags/medals not.
- [ ] **Typography parity** — Rubik, weights/sizes/line-heights per §2.2; `tabular-nums` on all changing numbers.
- [ ] **Color parity** — exact tokens §2.1; gradients limited to the approved list; no invented colors.
- [ ] **Interaction-state parity** — default/hover/focus-visible/pressed/selected/disabled/loading/success/error on every control.
- [ ] **Accessibility parity** — AA contrast, focus rings, 44px targets, aria labels/roles, keyboard ± and nav, color-independent states.
- [ ] **Reduced-motion parity** — all loops/celebrations/count-up disabled to final frame; ≤120ms fades only.
- [ ] **No layout shift** — fixed widths for numbers/buttons; confetti absolutely positioned; count-up padded.
- [ ] **No horizontal overflow** — `overflow-x:hidden` shell; verified at 375/390/430/768/1024/1440.
- [ ] **Terminology** — never קלע/קלעה; use כבש/הבקיע/ניחש תוצאה מדויקת/ניחש את המנצחת/ניחש את הפרש השערים/צבר נקודות/עלה בדירוג/ירד בדירוג everywhere.
- [ ] **Glow discipline** — glow only on hero gold wash + LIVE pulse; nowhere else.

---

## 17. FINAL HANDOFF PROMPT (paste into Claude Code)

> Read `PREMIUM_FANTASY_REFINED_IMPLEMENTATION_SPEC.md` in full. It documents the approved Premium Fantasy Refined home dashboard (mobile + desktop) for our React/Next.js/TypeScript/Tailwind/Motion app.
>
> 1. Compare the current implementation in the repo against every section of the spec (design tokens, responsive layout, motion system, per-component states, accessibility, reduced-motion).
> 2. Produce a diff report: list each detail that is **missing, inaccurate, or divergent** — grouped by component — before changing code.
> 3. Implement **only** the missing or inaccurate **UI and motion refinements** to reach spec parity: color tokens, typography, radii/spacing, the rank float, crown float, podium entrance stagger, points count-up, score-control digit motion + press/focus, the save→saved button morph, all five Next Match states, countdown color/pulse states, exact-score confetti (run-once), achievement/streak animations, activity feed entrance, bottom/top nav states, and full `prefers-reduced-motion` handling.
> 4. Enforce RTL with LTR isolation for scores/dates/Latin names, the mandated Hebrew terminology (never קלע/קלעה), no horizontal overflow at 375/390/430/768/1024/1440, and no layout shift from animations.
> 5. **Preserve all business logic, scoring rules, data fetching, and integrations** — do not alter data models, API calls, or invent data. Bind animations to existing state only.
> 6. Use Motion for orchestrated/looping/layout animation and CSS transitions for simple hover/press; centralize variants and motion tokens as named in §15; keep transforms-only for looping effects.
> 7. Run `lint`, `typecheck`, `test`, and `build`. Fix regressions.
> 8. Report exactly what changed: file-by-file summary, which spec items are now satisfied, and any items intentionally deferred with reasons.

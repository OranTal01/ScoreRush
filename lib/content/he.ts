/**
 * ScoreRush Hebrew content module — single source of truth for all UI copy.
 *
 * Per ARCHITECTURE.md §2 ("UI components never interpret raw provider payloads
 * and never perform domain calculations") and SCORING-RULES.md §10, every
 * scoring-related string lives here, not scattered inline in components, so
 * terminology stays consistent everywhere it appears and a future
 * English/multi-language pass is additive rather than a rewrite.
 *
 * Hard rule: never use קלע / קלעה anywhere in this codebase.
 */

export const nav = {
  home: "בית",
  predictions: "משחקים",
  leaderboard: "טבלה",
  bonuses: "בונוסים",
  groups: "קבוצות",
  bracket: "שלבים",
  profile: "פרופיל",
  admin: "ניהול",
} as const;

export const tournamentSwitcher = {
  title: "הטורנירים שלי",
  joinAnother: "הצטרפות לטורניר",
  createTournament: "יצירת טורניר",
  switchAction: "מעבר",
  activeLabel: "פעיל",
} as const;

export const common = {
  loading: "טוען…",
  emptyGeneric: "אין עדיין נתונים להצגה",
  errorGeneric: "משהו השתבש. ננסה שוב בקרוב.",
  dataDelayed: "הנתונים עשויים להיות מעודכנים בעיכוב",
  offline: "אתה במצב לא מקוון — מוצגים הנתונים האחרונים שנשמרו",
  retry: "ניסיון נוסף",
  viewAll: "לצפייה בהכול",
  points: "נק'",
  rank: "מקום",
  vs: "נגד",
} as const;

/**
 * Scoring/prediction terminology — verbatim from SCORING-RULES.md §10.
 * Never use קלע / קלעה anywhere in this codebase.
 */
export const scoring = {
  scoredGoal: "כבש", // כבש / הבקיעה — scored a goal
  scoredGoalFeminine: "הבקיעה",
  topScorer: "מלך השערים",
  topAssistProvider: "מלך הבישולים",
  topScoringTeam: "הנבחרת המבקיעה ביותר",
  exactScore: "ניחש תוצאה מדויקת",
  winnerAndDifference: "ניחש את המנצחת ואת הפרש השערים",
  winnerOnly: "ניחש את המנצחת",
  correctDraw: "ניחש נכון שהמשחק יסתיים בתיקו",
  wrongPrediction: "התחזית לא תאמה את תוצאת המשחק",
  rankUp: "עלה בדירוג",
  rankDown: "ירד בדירוג",
  pointsAccumulated: (points: number) => `צבר ${points} נק'`,
} as const;

export const home = {
  title: "בית",
  greeting: (name: string) => `שלום, ${name}`,
  rankHeroLabel: "המקום שלך",
  totalPointsLabel: 'סה"כ נקודות',
  nextMatchLabel: "המשחק הבא",
  latestResultLabel: "התוצאה האחרונה",
  leaderboardPreviewLabel: "מובילים בטבלה",
  achievementsLabel: "הישגים",
  activityFeedLabel: "פעילות אחרונה",
  tournamentLeadersLabel: "מובילי הטורניר",
  lockCountdownPrefix: "ננעל בעוד",
} as const;

export const predictions = {
  title: "משחקים",
  groupByStage: "שלב",
  matchdayLabel: (n: number) => `מחזור ${n}`,
  lockedLabel: "ננעל",
  openLabel: "פתוח לניחוש",
  liveLabel: "בשידור חי",
  finishedLabel: "הסתיים",
  emptyState: "אין משחקים להצגה בשלב זה",
} as const;

export const matchDetail = {
  backToPredictions: "משחקים",
  saveIdle: "שמירת ניחוש",
  savePressed: "שומר…",
  saveLoading: "שומר…",
  saveSuccess: "נשמר",
  saveError: "השמירה נכשלה, נסה שוב",
  editableUntilLock: "ניתן לערוך עד הנעילה",
  lockedStatic: "התחזית ננעלה",
  scoreExplanationTitle: "איך צברת נקודות",
  noPredictionSubmitted: "לא הגשת תחזית למשחק זה",
  homeLabel: "בית",
  awayLabel: "חוץ",
  yourPredictionLabel: "התחזית שלך",
  errorLocked: "התחזית ננעלה — לא ניתן לשמור יותר",
  errorNotAMember: "אינך חבר בטורניר הזה",
  errorNotFound: "המשחק לא נמצא",
  errorUnauthenticated: "יש להתחבר כדי לשמור תחזית",
  errorInvalidInput: "התוצאה שהוזנה אינה תקינה",
} as const;

export const leaderboard = {
  title: "טבלה",
  podiumTitle: "הפודיום",
  yourRow: "אתה",
  movementUp: "עלייה",
  movementDown: "ירידה",
  movementSame: "ללא שינוי",
  emptyState: "הטבלה תתעדכן עם תחילת הטורניר",
  errorUnauthenticated: "יש להתחבר כדי לצפות בטבלה",
  errorNotAMember: "אינך חבר בטורניר הזה",
  breakdownTitle: "השוואת נקודות",
  breakdownParticipantHeader: "משתתף/ת",
  matchPointsLabel: "משחקים",
  groupRankingPointsLabel: "בתים",
  bonusPointsLabel: "בונוס",
  totalPointsLabel: 'סה"כ',
} as const;

export const bonuses = {
  title: "בונוסים",
  slotsLabel: "בחירות",
  currentLeadersLabel: "מובילים כרגע",
  pointsBreakdownLabel: "פירוט נקודות",
  duplicateAllowedHint: "ניתן לבחור אותו שחקן/קבוצה ביותר מבחירה אחת",
  terminalPendingHint: "הקטגוריה תיפתר רק בסיום הטורניר",
  emptyState: "אין קטגוריות בונוס בטורניר זה",
  pickPlaceholder: "הקלידו את הבחירה שלכם",
  saveIdle: "שמירת בחירות",
  saveLoading: "שומר…",
  saveSuccess: "נשמר",
  saveError: "השמירה נכשלה, נסה שוב",
  editableUntilLock: "ניתן לערוך עד הנעילה",
  lockedLabel: "ננעל",
  errorLocked: "הקטגוריה ננעלה — לא ניתן לערוך יותר",
  errorNotAMember: "אינך חבר בטורניר הזה",
  errorInvalidInput: "הבחירות שהוזנו אינן תקינות",
  errorUnauthenticated: "יש להתחבר כדי לשמור בחירות",
} as const;

export const groups = {
  title: "קבוצות",
  groupLabel: (group: string) => `בית ${group}`,
  tableHeaders: {
    team: "קבוצה",
    played: "מש'",
    won: "נצ'",
    drawn: "תיקו",
    lost: "הפ'",
    goalDiff: "הפרש",
    points: "נק'",
  },
  predictionLabel: "הניחוש שלך לטבלה הסופית",
  finalizedLabel: "השלב הסתיים",
  emptyState: "אין שלב בתים בטורניר זה",
  moveUp: "הזזה למעלה",
  moveDown: "הזזה למטה",
  saveIdle: "שמירת ניחוש",
  saveLoading: "שומר…",
  saveSuccess: "נשמר",
  saveError: "השמירה נכשלה, נסה שוב",
  editableUntilFinalized: "ניתן לערוך עד סיום שלב הבתים",
  errorNotAMember: "אינך חבר בטורניר הזה",
  errorFinalized: "שלב הבתים כבר הסתיים — לא ניתן לערוך יותר",
  errorInvalidInput: "הסדר שנשלח אינו תקין",
  errorUnauthenticated: "יש להתחבר כדי לשמור תחזית",
} as const;

export const bracket = {
  title: "שלבי מפל",
  roundOf16: "שמינית גמר",
  quarterFinal: "רבע גמר",
  semiFinal: "חצי גמר",
  final: "גמר",
  tbd: "טרם נקבע",
} as const;

export const profile = {
  title: "פרופיל",
  rankHistoryLabel: "היסטוריית דירוג",
  achievementsLabel: "הישגים",
  streaksLabel: "רצפים",
  accuracyLabel: "דיוק תחזיות",
  editProfile: "עריכת פרופיל",
  linkedTournaments: "טורנירים מקושרים",
  roleAdmin: "מנהל/ת טורניר",
  roleParticipant: "משתתף/ת",
  rankUnchanged: "ללא שינוי מהמחזור הקודם",
} as const;

/**
 * Login screen (UX-BLUEPRINT.md §3 screen 1) — Google OAuth + magic link,
 * no password field (ARCHITECTURE.md §4, DECISIONS.md).
 */
export const auth = {
  title: "כניסה ל-ScoreRush",
  subtitle: "התחברו כדי להמשיך לטורנירים שלכם",
  googleCta: "המשך עם Google",
  divider: "או",
  emailLabel: "כתובת אימייל",
  emailPlaceholder: "you@example.com",
  magicLinkCta: "שליחת קישור התחברות",
  magicLinkSending: "שולח…",
  magicLinkSentTitle: "הקישור נשלח!",
  magicLinkSentBody: (email: string) =>
    `שלחנו קישור התחברות לכתובת ${email}. בדקו את תיבת הדואר (וגם את הספאם) ולחצו על הקישור כדי להיכנס.`,
  errorGeneric: "ההתחברות נכשלה. נסו שוב.",
  errorInvalidEmail: "כתובת האימייל אינה תקינה",
  errorCallback: "אימות ההתחברות נכשל. נסו להתחבר שוב.",
  footerNote:
    "אין צורך בסיסמה — הכניסה מתבצעת דרך Google או קישור חד־פעמי לאימייל.",
  signOut: "התנתקות",
} as const;

/**
 * Invitation landing screen (UX-BLUEPRINT.md §3 screen 3, flow A): resolves
 * a token, shows a tournament summary, confirms join.
 */
export const join = {
  title: "הצטרפות לטורניר",
  invalidToken: "קישור ההזמנה אינו תקין",
  statusExpired: "תוקף ההזמנה הזו פג",
  statusConsumed: "ההזמנה הזו כבר נוצלה",
  statusRevoked: "ההזמנה הזו בוטלה",
  confirmPrompt: (tournamentName: string) =>
    `אתם מוזמנים להצטרף לטורניר "${tournamentName}"`,
  confirmCta: "הצטרפות לטורניר",
  confirmPending: "מצטרפים…",
  signInPrompt: "יש להתחבר כדי להצטרף לטורניר",
  signInCta: "התחברות",
  successMessage: "הצטרפת בהצלחה! מעבירים אותך לדף הבית…",
  errorAlreadyMember: "אתם כבר משתתפים בטורניר הזה",
  errorWrongEmail: "ההזמנה הזו משויכת לכתובת אימייל אחרת",
  errorGeneric: "משהו השתבש בהצטרפות. נסו שוב.",
  backHome: "חזרה לדף הבית",
} as const;

export const admin = {
  overviewTitle: "סקירת ניהול",
  errorUnauthenticated: "יש להתחבר כדי לצפות בעמוד הניהול",
  errorNotAMember: "אינך חבר בטורניר הזה",
  errorNotAdmin: "עמוד זה מיועד למנהלי הטורניר בלבד",
  syncStatusLabel: "סטטוס סנכרון",
  pendingLocksLabel: "תחזיות הממתינות לנעילה",
  recentOverridesLabel: "התערבויות אחרונות",
  lastSyncLabel: "סנכרון אחרון",
  healthy: "תקין",
  degraded: "מוגבל",
  failed: "נכשל",
  noSyncYet: "טרם בוצע סנכרון",
  syncAttemptSuccess: "הצליח",
  syncAttemptFailed: "נכשל",
  reversibleLabel: "ניתן לביטול",
  flaggedMatchesLabel: "משחקים שסומנו באזהרת נרמול",
  flaggedMatchesEmpty: "אין כרגע משחקים המסומנים באזהרה",
  noSyncLogsYet: "עדיין לא היו ניסיונות סנכרון",
  createTournamentCta: "יצירת טורניר חדש",
  firstTournamentPromptTitle: "עדיין אין לך טורניר",
  firstTournamentPromptBody:
    "בתור בעל הפלטפורמה תוכל ליצור כאן טורניר חדש, כולל כללי הניקוד, קטגוריות הבונוס והפרסים שלו.",
} as const;

/**
 * Tournament creation flow — the one point where scoring/bonus/prize
 * configuration is set (DECISIONS.md "Rule editability mid-tournament":
 * locked at creation, never edited afterward, so screens #6/#7 from
 * UX-BLUEPRINT.md §4 collapse into this single creation-time flow rather
 * than separate post-creation editing screens). Platform-owner-only
 * (DECISIONS.md "Tournament creation").
 */
export const createTournament = {
  title: "יצירת טורניר חדש",
  errorNotPlatformAdmin: "רק בעל הפלטפורמה יכול ליצור טורניר חדש",
  errorUnauthenticated: "יש להתחבר כדי ליצור טורניר",

  basicsSection: "פרטי הטורניר",
  nameLabel: "שם הטורניר",
  namePlaceholder: 'לדוגמה: "ליגת האלופות 2027 — משפחת פישר"',
  competitionLabel: "מזהה התחרות",
  competitionPlaceholder: "לדוגמה: champions_league",
  competitionHint:
    "שדה חופשי, לא רשימה סגורה — כדי לתמוך בכל תחרות עתידית בלי שינוי קוד",

  providerSection: "מקור נתונים",
  providerHint:
    "אותה בחירה חלה גם על תוצאות המשחקים וגם על נתוני הבונוס (קלעים/בישולים) — football-data.org מספק את שניהם דרך אותה תחרות",
  providerFootballData: "football-data.org (אוטומטי)",
  providerManual: "ידני",
  competitionCodeLabel: "קוד התחרות ב-football-data.org",
  competitionCodePlaceholder: "לדוגמה: CL",
  seasonLabel: "עונה (אופציונלי)",

  scoringSection: "כללי ניקוד",
  exactScoreLabel: "תוצאה מדויקת",
  winnerAndDiffLabel: "מנצחת + הפרש שערים",
  winnerOnlyLabel: "מנצחת בלבד",
  wrongLabel: "תחזית שגויה",
  groupRankingLabel: "נקודות לכל מיקום נכון בטבלת הבתים",

  bonusSection: "קטגוריות בונוס",
  bonusEmptyHint: "אין עדיין קטגוריות בונוס — אפשר להוסיף למטה",
  addBonusCategory: "הוספת קטגוריית בונוס",
  bonusNameLabel: "שם הקטגוריה",
  bonusNamePlaceholder: 'לדוגמה: "מלך השערים"',
  bonusTypeLabel: "סוג",
  bonusTypePlaceholder: "לדוגמה: player",
  bonusResolvesAtLabel: "מתי מוכרעת",
  bonusResolvesOngoing: "לאורך הטורניר",
  bonusResolvesEnd: "רק בסיום הטורניר",
  bonusDuplicateStackingLabel: "אפשר לבחור אותו שם במספר משבצות",
  bonusSlotsLabel: "משבצות וניקוד",
  addBonusSlot: "הוספת משבצת",
  slotLabel: (index: number) => `משבצת ${index}`,
  removeCategory: "הסרת הקטגוריה",
  removeSlot: "הסרה",

  prizesSection: "פרסים",
  prizesEmptyHint: "אין עדיין פרסים מוגדרים — אפשר להוסיף למטה",
  addPrize: "הוספת פרס",
  prizeRankLabel: (rank: number) => `מקום ${rank}`,
  prizeDescriptionPlaceholder: 'לדוגמה: "מנוי VIP לעונה הבאה"',
  removePrize: "הסרה",

  submitCta: "יצירת הטורניר",
  submitPending: "יוצר טורניר…",
  successMessage: "הטורניר נוצר בהצלחה",
  backToAdmin: "מעבר לניהול הטורניר",

  errorInvalidInput: "יש לתקן את השדות המסומנים",
  errorGeneric: "משהו השתבש. ננסה שוב בקרוב.",
} as const;

/**
 * Participant management screen (UX-BLUEPRINT.md §4 screen #2: "Member
 * list, roles, invitation status, remove/re-invite"). Admin-only (platform
 * admin or the tournament's own tournament_admin, lib/auth/admin.ts).
 * When an invitation is bound to an email, Phase 8 (task #67) also sends a
 * real invitation email via Resend (lib/notifications/send-invitation-email.ts)
 * — the copyable link stays the primary/fallback delivery path either way,
 * since email delivery is best-effort and never blocks invitation creation.
 */
export const participantsAdmin = {
  title: "ניהול משתתפים",
  errorUnauthenticated: "יש להתחבר כדי לצפות בעמוד זה",
  errorNotAMember: "אינך חבר בטורניר הזה",
  errorNotAdmin: "עמוד זה מיועד למנהלי הטורניר בלבד",

  membersSection: "משתתפים",
  youLabel: "(אתה)",
  roleAdmin: "מנהל/ת טורניר",
  roleParticipant: "משתתף/ת",
  makeAdminCta: "הפיכה למנהל/ת",
  makeParticipantCta: "הסרת הרשאות ניהול",
  removeCta: "הסרה מהטורניר",
  removeConfirm: "להסיר את המשתתף/ת מהטורניר? לא ניתן לבטל פעולה זו.",

  invitationsSection: "הזמנות",
  invitationsEmptyHint: "אין עדיין הזמנות פעילות",
  statusPending: "ממתינה",
  statusConsumed: "נוצלה",
  statusExpired: "פגה",
  statusRevoked: "בוטלה",
  boundEmailLabel: "משויכת לאימייל:",
  openInvitationLabel: "פתוחה לכל מי שמחזיק בקישור",
  expiresLabel: "בתוקף עד",
  noExpiryLabel: "ללא תפוגה",
  revokeCta: "ביטול ההזמנה",
  revokeConfirm: "לבטל את ההזמנה? לא ניתן לבטל פעולה זו.",

  createInvitationSection: "יצירת הזמנה חדשה",
  boundEmailInputLabel: "הגבלה לכתובת אימייל (אופציונלי)",
  boundEmailPlaceholder: "name@example.com",
  createInvitationCta: "יצירת קישור הזמנה",
  createInvitationPending: "יוצר הזמנה…",
  invitationCreatedTitle: "ההזמנה נוצרה",
  invitationCreatedHint:
    "שתפו את הקישור הזה עם המוזמן/ת (בוואטסאפ, אימייל וכו') — הוא לא יוצג שוב.",
  invitationEmailSent: (email: string) => `נשלח גם אימייל אל ${email}`,
  invitationEmailFailed:
    "שליחת האימייל נכשלה — יש לשתף את הקישור למעלה באופן ידני.",
  copyLinkCta: "העתקת הקישור",
  copiedCta: "הועתק!",

  errorInvalidInput: "יש לתקן את השדות המסומנים",
  errorCannotRemoveSelf: "לא ניתן להסיר את עצמך מהטורניר",
  errorCannotChangeOwnRole: "לא ניתן לשנות את התפקיד של עצמך",
  errorNotFound: "הרשומה לא נמצאה, ייתכן שכבר טופלה",
  errorGeneric: "משהו השתבש. ננסה שוב בקרוב.",
} as const;

/**
 * The real invitation email itself (ROADMAP.md Phase 8 task #67, sent via
 * Resend — lib/notifications/send-invitation-email.ts). Separate from
 * `participantsAdmin` above, which is the *admin's own screen* copy, not
 * what the invitee receives. `tournamentName`/`joinUrl` are interpolated by
 * lib/notifications/invitation-email.ts, which also HTML-escapes them
 * before they reach `bodyHtml` — this module just supplies the templates.
 */
export const invitationEmail = {
  subject: (tournamentName: string) =>
    `הוזמנת לטורניר "${tournamentName}" ב-ScoreRush`,
  bodyHtml: (tournamentName: string, joinUrl: string) =>
    `<p>הוזמנת להצטרף לטורניר "<strong>${tournamentName}</strong>" ב-ScoreRush.</p>` +
    `<p><a href="${joinUrl}">לחצו כאן כדי להצטרף</a></p>` +
    `<p style="color:#888888;font-size:12px">אם הכפתור לא עובד, העתיקו את הקישור הבא: ${joinUrl}</p>`,
  bodyText: (tournamentName: string, joinUrl: string) =>
    `הוזמנת להצטרף לטורניר "${tournamentName}" ב-ScoreRush.\n\nלחצו על הקישור כדי להצטרף:\n${joinUrl}`,
} as const;

/**
 * Match diagnostics + provider health + full sync log (UX-BLUEPRINT.md §4
 * screens #3-5, Phase 7 task #60). Read-only — no server actions here, this
 * screen only surfaces what the sync pipeline (Phase 4) already writes.
 * Admin-only, same guard shape as the other admin/* screens.
 */
export const diagnostics = {
  title: "אבחון וסנכרון",
  errorUnauthenticated: "יש להתחבר כדי לצפות בעמוד זה",
  errorNotAMember: "אינך חבר בטורניר הזה",
  errorNotAdmin: "עמוד זה מיועד למנהלי הטורניר בלבד",
  backToDiagnostics: "אבחון וסנכרון",

  providerHealthSection: "בריאות ספק הנתונים",
  matchDataProviderLabel: "ספק תוצאות משחקים",
  bonusStatsProviderLabel: "ספק נתוני בונוס",
  lastSuccessfulSyncLabel: "סנכרון מוצלח אחרון",
  lastAttemptLabel: "ניסיון סנכרון אחרון",
  recentErrorsLabel: (errorCount: number, attemptCount: number) =>
    `${errorCount} שגיאות מתוך ${attemptCount} הניסיונות האחרונים`,
  noProviderConfig: "לא נמצאה הגדרת ספק נתונים לטורניר זה",
  neverSyncedLabel: "טרם בוצע סנכרון",

  syncLogSection: "יומן סנכרון מלא",

  matchListSection: "כל המשחקים",
  matchListEmpty: "אין עדיין משחקים בטורניר זה",
  statusScheduled: "טרם החל",
  statusLive: "בשידור חי",
  statusFinished: "הסתיים",
  statusPostponed: "נדחה",
  statusCancelled: "בוטל",
  normalizationPending: "ממתין לנרמול",
  normalizationNormalized: "מנורמל",
  normalizationFlagged: "סומן באזהרה",
  viewDetailCta: "פרטים",

  detailNotFound: "המשחק לא נמצא",
  rawPayloadSection: "המידע הגולמי מהספק",
  rawPayloadEmpty: "אין מידע גולמי — משחק שהוזן ידנית",
  normalizedResultSection: "התוצאה המנורמלת",
  regularResultLabel: "תוצאה רגילה (90 דקות)",
  extraTimeResultLabel: "אחרי הארכה",
  penaltyResultLabel: "פנדלים",
  liveScoreLabel: "תוצאה חיה",
  winnerLabel: "מנצח/ת",
  winnerDrawLabel: "תיקו",
  noResultYet: "טרם נקבעה תוצאה",
  providerMatchIdLabel: "מזהה המשחק אצל הספק",
  manualEntryLabel: "משחק שהוזן ידנית (אין מזהה ספק)",
  lastSyncedLabel: "סונכרן לאחרונה",
  warningLabel: "אזהרת נרמול",
  noWarning: "לא סומנה אזהרה",
  correctResultCta: "תיקון תוצאת המשחק",
} as const;

/**
 * Manual match-result correction + recalculation preview (Phase 7 task #61,
 * UX-BLUEPRINT.md §4 screens #8-9). SCORING-RULES.md §9: the one remaining
 * legitimate MVP use of "recalculation preview" is correcting a match
 * result, never a rules change — rules are locked at tournament creation.
 */
export const overrides = {
  title: "תיקון תוצאת משחק",
  backToMatch: "חזרה לפרטי המשחק",
  errorUnauthenticated: "יש להתחבר כדי לצפות בעמוד זה",
  errorNotAdmin: "עמוד זה מיועד למנהלי הטורניר בלבד",
  errorNotFound: "המשחק לא נמצא",

  scopeNote:
    "התצוגה המקדימה מציגה את ההשפעה על נקודות המשחק בלבד. השפעה אפשרית על דירוג הבתים תחושב בפועל רק לאחר האישור, ואינה מוצגת כאן מראש. נקודות בונוס אינן מושפעות מתוצאת משחק בודד.",

  currentResultLabel: "התוצאה הנוכחית",
  proposedResultSection: "התוצאה המתוקנת",
  homeScoreLabel: "שערי הבית",
  awayScoreLabel: "שערי החוץ",
  previewCta: "הצג תצוגה מקדימה",
  previewPending: "מחשב…",

  previewSection: "תצוגה מקדימה של השפעת התיקון",
  predictionChangesEmpty: "אף אחד עדיין לא ניחש את המשחק הזה",
  rankChangesSection: "שינויים בדירוג הכללי",
  rankChangesEmpty: "התיקון הזה לא ישנה את הדירוג של אף משתתף",

  reasonSection: "פרטי התיקון",
  reasonInputLabel: "סיבת התיקון",
  reasonPlaceholder: "לדוגמה: הספק החזיר תוצאה שגויה, אומתה מול השידור הרשמי",
  evidenceInputLabel: "קישור/הפניה לאסמכתא (אופציונלי)",
  evidencePlaceholder: "https://",
  reversibleInputLabel: "ניתן לביטול התיקון",
  applyCta: "אשר ובצע תיקון",
  applyPending: "מבצע…",
  applyConfirm: "לאשר את תיקון התוצאה? הפעולה תחשב מחדש את כל הניקוד בטורניר.",

  successTitle: "התיקון בוצע בהצלחה",
  successHint: "התוצאה עודכנה, הניקוד חושב מחדש ותמונת מצב חדשה של הדירוג נשמרה.",

  errorInvalidInput: "יש למלא את כל השדות הנדרשים",
  errorGeneric: "משהו השתבש, נסו שוב",
} as const;

/**
 * Audit log viewer (UX-BLUEPRINT.md §4 screen #11: "Full chronological log
 * of all admin actions in the tournament", Phase 7 task #62). Read-only,
 * admin-only, same guard shape as the other admin/* list screens. Merges
 * `admin_overrides` (human action record) and `score_audit_logs`
 * (field-level before/after record) into one feed — see lib/audit/log.ts's
 * doc comment for why the two are FK-uncorrelated by design.
 */
export const auditLog = {
  title: "יומן ביקורת",
  errorUnauthenticated: "יש להתחבר כדי לצפות בעמוד זה",
  errorNotAMember: "אינך חבר בטורניר הזה",
  errorNotAdmin: "עמוד זה מיועד למנהלי הטורניר בלבד",

  empty: "עדיין לא בוצעו פעולות ניהול הדורשות תיעוד בטורניר זה",

  overrideTypeLabel: "תיקון ידני",
  scoreChangeTypeLabel: "שינוי ניקוד",

  actingAdminLabel: "בוצע על ידי",
  reasonLabel: "סיבה",
  evidenceLabel: "אסמכתא",
  reversibleLabel: "ניתן לביטול",
  notReversibleLabel: "לא ניתן לביטול",
  reversedAtLabel: "בוטל בתאריך",

  entityLabels: { match: "משחק" } as Record<string, string>,
  fieldLabels: {
    regular_result: "תוצאה רגילה",
    winner: "מנצח/ת",
  } as Record<string, string>,

  winnerValueLabels: {
    home: "קבוצת הבית",
    away: "קבוצת החוץ",
    draw: "תיקו",
  } as Record<string, string>,
  winnerValueNone: "טרם נקבע",
  noValue: "—",
} as const;

/**
 * Admin notification center (UX-BLUEPRINT.md §4 screen #10: "Delivery
 * status for sent notifications", Phase 8 task #68). Read-only, same
 * guard/list-page shape as `auditLog` above — this screen only ever
 * displays what lib/notifications/list.ts's getNotificationLog already
 * reads from `notifications` (the table Phase 8 task #67's invitation
 * email flow writes to).
 */
export const notificationCenter = {
  title: "מרכז התראות",
  errorUnauthenticated: "יש להתחבר כדי לצפות בעמוד זה",
  errorNotAMember: "אינך חבר בטורניר הזה",
  errorNotAdmin: "עמוד זה מיועד למנהלי הטורניר בלבד",

  empty: "עדיין לא נשלחו התראות בטורניר זה",

  recipientLabel: "נמען",
  sentAtLabel: "נשלח בתאריך",
  errorDetailLabel: "פרטי שגיאה",

  channelLabels: {
    email: "אימייל",
    push: "פוש",
    whatsapp: "וואטסאפ",
  } as Record<string, string>,
  typeLabels: {
    invitation: "הזמנה",
  } as Record<string, string>,
  statusLabels: {
    pending: "ממתין",
    sent: "נשלח",
    failed: "נכשל",
  } as Record<string, string>,
} as const;

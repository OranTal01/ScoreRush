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
} as const;

export const bonuses = {
  title: "בונוסים",
  slotsLabel: "בחירות",
  currentLeadersLabel: "מובילים כרגע",
  pointsBreakdownLabel: "פירוט נקודות",
  duplicateAllowedHint: "ניתן לבחור אותו שחקן/קבוצה ביותר מבחירה אחת",
  terminalPendingHint: "הקטגוריה תיפתר רק בסיום הטורניר",
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
} as const;

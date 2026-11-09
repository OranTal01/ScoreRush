import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sanitizeNext } from "@/lib/auth/sanitize-next";
import { auth as content } from "@/lib/content/he";
import { LoginForm } from "./_components/login-form";

/** Login screen (UX-BLUEPRINT.md §3 screen 1). Not part of the (app) route
 * group's shared shell — signed-out visitors have no tournament context yet. */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error, next } = await searchParams;
  const safeNext = sanitizeNext(next);

  if (user) {
    redirect(safeNext);
  }

  return (
    <main className="relative flex min-h-svh flex-1 flex-col bg-[radial-gradient(ellipse_at_90%_10%,#142737_0%,transparent_55%)] px-5 sm:px-8">
      <header className="mx-auto flex w-full max-w-[1120px] items-center justify-between gap-4 py-7 sm:py-9">
        <span dir="ltr" className="text-xl font-black tracking-tight">
          Score<span className="text-[var(--interactive)]">Rush</span>
        </span>
        <span className="text-xs text-[var(--text-muted)]">
          המשחק של החבר׳ה
        </span>
      </header>
      <div className="mx-auto grid w-full max-w-[1120px] flex-1 content-center gap-7 pb-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-center lg:gap-20 lg:py-12">
        <section className="relative isolate min-w-0">
          <p className="mb-4 flex items-center gap-2 text-xs font-semibold text-[var(--gold)]">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
            כדורגל. חברים. קצת יותר עניין.
          </p>
          <h1 className="text-[38px] leading-[1.15] font-black tracking-tight sm:text-5xl lg:text-[64px]">
            החברים שלכם.
            <br />
            <span className="text-[var(--interactive)]">הליגה שלכם.</span>
          </h1>
          <p className="mt-4 max-w-md text-sm leading-7 text-[var(--text-secondary)] sm:text-base">
            הוויכוחים נשארים בקבוצה. כאן נותנים לכדורגל לדבר: מנחשים תוצאות,
            צוברים נקודות ומתחרים על המקום הראשון.
          </p>
          <div className="mt-7 hidden max-w-md grid-cols-3 gap-4 border-t border-white/10 pt-6 sm:grid">
            {[
              { n: "01", title: "מנחשים", text: "תוצאות, דירוג ובונוסים" },
              { n: "02", title: "עוקבים", text: "כל המשחקים במקום אחד" },
              { n: "03", title: "עולים בטבלה", text: "התחרות היא בין החברים" },
            ].map((item) => (
              <div key={item.n}>
                <span className="text-xs font-bold text-[var(--gold)]">
                  {item.n}
                </span>
                <h2 className="mt-2 text-sm font-bold">{item.title}</h2>
                <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-y-16 -start-24 -z-10 hidden overflow-hidden lg:block"
          >
            <div className="pitch-lines" />
          </div>
        </section>

        <section
          aria-labelledby="login-heading"
          className="w-full rounded-[24px] border border-white/10 bg-[var(--surface-card)] p-5 shadow-2xl shadow-black/20 sm:p-7"
        >
          <div className="mb-6">
            <h2 id="login-heading" className="text-xl font-extrabold">
              נכנסים למשחק
            </h2>
            <p className="mt-2 text-xs leading-6 text-[var(--text-secondary)]">
              {safeNext.startsWith("/join/")
                ? "ההזמנה שלכם מחכה. מתחברים ובוחרים איך להופיע בטבלה."
                : "יש לכם הזמנה? מתחברים ומצטרפים לליגה של החברים."}
            </p>
          </div>
          <div className="flex flex-col gap-4">
            {error && (
              <p
                role="alert"
                className="text-center text-xs font-semibold text-[var(--danger)]"
              >
                {error === "oauth"
                  ? content.errorGeneric
                  : content.errorCallback}
              </p>
            )}
            <LoginForm next={safeNext} />
          </div>
        </section>
      </div>
      <footer className="mx-auto w-full max-w-[1120px] border-t border-white/5 py-5 text-center text-[11px] leading-6 text-[var(--text-muted)]">
        ליגה פרטית. תחרות טובה. זכויות התרברבות.
      </footer>
    </main>
  );
}

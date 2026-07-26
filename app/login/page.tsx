import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sanitizeNext } from "@/lib/auth/sanitize-next";
import { auth as content } from "@/lib/content/he";
import { gradients } from "@/lib/design-tokens";
import { Card } from "@/app/_components/ui";
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
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="flex w-full flex-col gap-6 md:max-w-[400px]">
        <div className="flex flex-col items-center gap-1 text-center">
          <span className="text-xl font-black text-[var(--text-primary)]">
            ScoreRush
          </span>
          <h1 className="text-lg font-extrabold text-[var(--text-primary)]">
            {content.title}
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            {content.subtitle}
          </p>
        </div>

        <Card padding="hero" className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ background: gradients.hero }}
          />
          <div className="relative flex flex-col gap-4">
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
        </Card>
      </div>
    </main>
  );
}

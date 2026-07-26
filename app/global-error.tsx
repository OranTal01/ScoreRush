"use client";

import { common } from "@/lib/content/he";
import { colors } from "@/lib/design-tokens";
import "./globals.css";

/**
 * Last-resort error boundary for a thrown error in the ROOT layout itself
 * (app/layout.tsx) — app/error.tsx can't catch that, since it renders
 * *inside* the root layout. Per the Next.js contract, this file must
 * render its own <html>/<body> (it replaces the root layout entirely when
 * active), so it stays deliberately minimal — no fonts, no nav — this
 * path only fires if the root layout itself is broken. Phase 9 #73.
 */
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="he" dir="rtl">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: colors.bgPage,
          color: colors.textPrimary,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          role="alert"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            textAlign: "center",
            padding: 24,
          }}
        >
          <p style={{ fontSize: 14, fontWeight: 600 }}>{common.errorGeneric}</p>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: "12px 16px",
              fontSize: 12,
              fontWeight: 700,
              color: colors.textPrimary,
              background: colors.surfaceCard2,
              borderRadius: 16,
              border: "none",
            }}
          >
            {common.retry}
          </button>
        </div>
      </body>
    </html>
  );
}

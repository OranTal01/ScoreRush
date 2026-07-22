import { MobileHeader } from "../_components/nav/mobile-header";
import { TopBar } from "../_components/nav/top-bar";
import { BottomNav } from "../_components/nav/bottom-nav";

/**
 * Shared chrome for every participant/admin screen — UX-BLUEPRINT.md §2
 * navigation model. Mobile gets a sticky header + fixed bottom nav; desktop
 * gets a single top bar. Route-group layout, so it doesn't affect the URL.
 */
export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <MobileHeader />
      <TopBar />
      <main
        className="mx-auto w-full px-4 md:max-w-[var(--spacing-desktop-max-width,1320px)] md:px-7 md:py-6"
        style={{
          paddingBottom: "var(--spacing-page-padding-bottom, 90px)",
          paddingTop: 16,
        }}
      >
        {children}
      </main>
      <BottomNav />
    </>
  );
}

import "@testing-library/jest-dom/vitest";

// jsdom does not implement matchMedia. Components that gate animation on
// `prefers-reduced-motion` (see lib/motion/variants.ts) need this in tests.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList => {
    return {
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    } as MediaQueryList;
  };
}

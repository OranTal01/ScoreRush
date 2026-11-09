import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "ScoreRush",
    short_name: "ScoreRush",
    lang: "he",
    dir: "rtl",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#080B14",
    theme_color: "#080B14",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}

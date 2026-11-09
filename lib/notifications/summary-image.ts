import type { DigestStanding } from "@/lib/db/schema/push";
import { digestHighlights } from "./highlights";

export type SummaryVisual = {
  day: string;
  tournamentName: string;
  standings: DigestStanding[];
  baseline: DigestStanding[] | null;
};

/** Render locally: private standings never go to a third-party image service. */
export async function createSummaryImage(data: SummaryVisual): Promise<Blob> {
  await document.fonts.ready;
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("יצירת התמונה לא זמינה בדפדפן הזה.");
  const ctx: CanvasRenderingContext2D = context;
  const font = getComputedStyle(document.body).fontFamily || "Arial";
  const gradient = ctx.createLinearGradient(0, 0, 1080, 1350);
  gradient.addColorStop(0, "#172b39");
  gradient.addColorStop(0.5, "#121b2b");
  gradient.addColorStop(1, "#080b14");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1080, 1350);
  ctx.strokeStyle = "#2a4352";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(100, 80, 360, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(100, 80, 270, 0, Math.PI * 2);
  ctx.stroke();
  function text(
    value: string,
    x: number,
    y: number,
    size: number,
    color = "#f2f4f8",
    align: CanvasTextAlign = "right",
    max = 936,
  ) {
    ctx.textAlign = align;
    ctx.direction = "rtl";
    ctx.fillStyle = color;
    let actual = size;
    ctx.font = `700 ${actual}px ${font}`;
    while (ctx.measureText(value).width > max && actual > 19) {
      actual--;
      ctx.font = `700 ${actual}px ${font}`;
    }
    let fitted = value;
    while (ctx.measureText(fitted).width > max && fitted.length)
      fitted = fitted.slice(0, -1);
    if (fitted !== value) fitted = fitted.slice(0, -1) + "…";
    ctx.fillText(fitted, x, y);
  }
  function panel(x: number, y: number, w: number, h: number) {
    ctx.fillStyle = "#1b2839";
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 20);
    ctx.fill();
  }
  const h = digestHighlights(data.standings, data.baseline);
  text("SCORE RUSH", 72, 95, 30, "#d6b56e", "left");
  text(data.day.split("-").reverse().join("."), 1008, 95, 24, "#aab7c8");
  text("הסיפור של הערב", 1008, 202, 66);
  text(data.tournamentName, 1008, 251, 29, "#aab7c8");
  panel(72, 296, 936, 150);
  text(
    h.stars.length > 1 ? "מצטייני הערב" : "מצטיין הערב",
    972,
    342,
    24,
    "#d6b56e",
  );
  const names = h.stars.map((p) => p.name).join(" · ");
  text(names || "ערב קשוח לניחושים", 972, 403, 38, "#f2f4f8", "right", 690);
  text(`${h.maxPoints}+`, 110, 401, 48, "#d6b56e", "left", 140);
  text("הטבלה אחרי המשחקים", 1008, 513, 29);
  h.ordered.slice(0, 5).forEach((p, i) => {
    const y = 542 + i * 83;
    panel(72, y, 936, 69);
    text(String(p.rank), 970, y + 46, 30, p.rank === 1 ? "#d6b56e" : "#aab7c8");
    text(p.name, 886, y + 45, 29, "#f2f4f8", "right", 555);
    text(`${p.total} נק׳`, 110, y + 45, 31, "#7bc0e6", "left", 170);
  });
  text(
    h.movers.length
      ? `הקפיצה של הערב: ${h.movers.map((p) => p.name).join(" · ")} ↑${h.maxMove}`
      : "כל משחק יכול לשנות את התמונה.",
    1008,
    1038,
    29,
    "#a4d9bd",
  );
  text(
    h.snipers.length
      ? `בול בתוצאה: ${h.snipers.map((p) => p.name).join(" · ")} · ${h.maxExact} פגיעות`
      : "המחזור הבא הוא הזדמנות חדשה.",
    1008,
    1103,
    28,
    "#aab7c8",
  );
  text(
    h.leaders.length > 1
      ? "שוויון בפסגה. הקרב פתוח."
      : h.gap !== null
        ? `${h.gap} נקודות מפרידות בין שני הראשונים.`
        : "זה הזמן להזמין את החבר׳ה.",
    1008,
    1188,
    32,
    "#d6b56e",
  );
  text("scorerush-sigma.vercel.app", 540, 1286, 25, "#aab7c8", "center");
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("לא הצלחנו ליצור תמונה. נסו שוב.")),
      "image/png",
    ),
  );
}

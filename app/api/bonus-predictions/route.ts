import { submitBonusPrediction } from "@/app/(app)/bonuses/actions";

export const maxDuration = 30;

export async function POST(request: Request) {
  // Cookie-authenticated writes must originate from this site.
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json(
      { status: "error", code: "unauthenticated" },
      { status: 403 },
    );
  }
  try {
    const result = await submitBonusPrediction(
      { status: "idle" },
      await request.formData(),
    );
    return Response.json(result);
  } catch {
    return Response.json({ status: "error", code: "generic" }, { status: 500 });
  }
}

import { submitMatchPrediction } from "@/app/(app)/predictions/[matchId]/actions";
export const maxDuration = 30;

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return Response.json({ status: "error", code: "generic" }, { status: 403 });
  try {
    const body = await request.json();
    if (
      !body ||
      typeof body.matchId !== "string" ||
      !Number.isInteger(body.predictedHome) ||
      !Number.isInteger(body.predictedAway)
    )
      return Response.json(
        { status: "error", code: "invalid_input" },
        { status: 400 },
      );
    const form = new FormData();
    for (const key of ["matchId", "predictedHome", "predictedAway"] as const)
      form.set(key, String(body[key]));
    if (body.advance === true) form.set("advance", "1");
    const result = await submitMatchPrediction({ status: "idle" }, form);
    return Response.json(result, {
      status: result.status === "success" ? 200 : 400,
    });
  } catch {
    return Response.json({ status: "error", code: "generic" }, { status: 500 });
  }
}

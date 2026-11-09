// @vitest-environment node
import { beforeEach, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  set: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "me" } } }) },
    rpc: mocks.rpc,
  }),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: mocks.set }) }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { confirmJoinInvitation } from "./actions";
beforeEach(() => vi.clearAllMocks());
it("opens the guide in the joined tournament instead of the previously active cup", async () => {
  mocks.rpc.mockResolvedValue({
    data: { tournament_id: "new-cup" },
    error: null,
  });
  const form = new FormData();
  form.set("nickname", "אורן");
  await expect(confirmJoinInvitation("invite", form)).rejects.toThrow(
    "redirect:/welcome",
  );
  expect(mocks.set).toHaveBeenCalledWith(
    "active_tournament_id",
    "new-cup",
    expect.objectContaining({ httpOnly: true, path: "/" }),
  );
  expect(mocks.revalidate).toHaveBeenCalledWith("/", "layout");
});
it("does not advance or change tournament on a failed invitation", async () => {
  mocks.rpc.mockResolvedValue({
    data: null,
    error: { message: "Nickname already in use" },
  });
  await expect(confirmJoinInvitation("invite", new FormData())).rejects.toThrow(
    "redirect:/join/invite?error=nickname",
  );
  expect(mocks.set).not.toHaveBeenCalled();
});

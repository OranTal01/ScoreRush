import { createClient } from "@/lib/supabase/server";
import { getCurrentParticipant } from "@/lib/tournaments/current";
import { readLiveView } from "@/lib/live/read";
import { LiveBoard } from "@/app/_components/live-board";
import { EmptyState } from "@/app/_components/ui";
export const dynamic = "force-dynamic";
export default async function LivePage() {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  const current = user ? await getCurrentParticipant(client, user.id) : null;
  if (!current)
    return <EmptyState message="הצטרפו לטורניר כדי לעקוב אחרי ערב המשחקים." />;
  return (
    <LiveBoard
      key={current.participantId}
      initial={await readLiveView(client, current)}
    />
  );
}

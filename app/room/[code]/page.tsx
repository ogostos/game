import { RoomClient } from "@/components/room-client";

interface RoomPageProps {
  params: Promise<{ code: string }>;
}

export default async function RoomPage({ params }: RoomPageProps) {
  const { code } = await params;

  return (
    <main className="shell stack-xl">
      <RoomClient roomCode={code} />
    </main>
  );
}

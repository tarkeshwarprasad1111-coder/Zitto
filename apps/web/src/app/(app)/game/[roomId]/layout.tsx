import { mockRooms } from '@/lib/mock-data';

/**
 * Enumerates the room pages the static export should emit.
 *
 * This lives in a layout rather than the page because `page.tsx` is a client
 * component, and `generateStaticParams` only runs on the server.
 *
 * The list comes from `mockRooms` so it cannot drift from the rooms the lobby
 * actually links to. Once rooms come from the API this whole file goes away —
 * a server-rendered build has no need to know the routes ahead of time.
 */
export function generateStaticParams() {
  return mockRooms.map((room) => ({ roomId: room.id }));
}

export default function GameRoomLayout({ children }: { children: React.ReactNode }) {
  return children;
}

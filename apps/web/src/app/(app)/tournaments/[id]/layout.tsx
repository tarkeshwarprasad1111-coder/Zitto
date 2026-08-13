import { mockTournaments } from '@/lib/mock-data';

/**
 * Routes the static export must emit for tournament detail.
 *
 * Lives in a layout because the page is a client component and
 * `generateStaticParams` only runs on the server. The list comes from
 * `mockTournaments` so it cannot drift from the tournaments the app links to —
 * a card pointing at an unexported route is a 404, and that is exactly how the
 * home screen's tournament card broke.
 */
export function generateStaticParams() {
  return mockTournaments.map((tournament) => ({ id: tournament.id }));
}

export default function TournamentLayout({ children }: { children: React.ReactNode }) {
  return children;
}

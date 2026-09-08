/**
 * Deck layout — full-screen, no chrome.
 * Intentionally avoids the portal header/footer so slides fill the viewport.
 */
export const metadata = {
  title: 'Presentación · doscientos',
  robots: { index: false, follow: false },
}

export default function DeckLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

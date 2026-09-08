import { redirect } from 'next/navigation'

/** Compatibility route for old bookmarks; published posts now live in Social filters. */
export default function FeedPage() {
  redirect('/social?status=published')
}

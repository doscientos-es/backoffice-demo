export type DeckTapDirection = 'prev' | 'next'

export function getDeckTapDirection(
  clientX: number,
  viewportLeft: number,
  viewportWidth: number,
): DeckTapDirection {
  return clientX - viewportLeft < viewportWidth / 2 ? 'prev' : 'next'
}

/**
 * Soft-delete filter helper.
 *
 * All tables with a `deleted_at timestamptz` column should be filtered with
 * `.is("deleted_at", null)` to exclude soft-deleted rows. This helper makes
 * that intent explicit and greppable, and centralises the column name so a
 * future rename only touches one place.
 *
 * Usage:
 *   const { data } = await notDeleted(
 *     supabase.from("clients").select("id, name")
 *   );
 *
 * The helper is a thin pass-through that returns the same builder, so it
 * composes naturally with `.eq`, `.order`, `.range`, etc.
 */
export function notDeleted<B extends { is(column: string, value: null): unknown }>(
  builder: B,
): ReturnType<B['is']> {
  return builder.is('deleted_at', null) as ReturnType<B['is']>
}

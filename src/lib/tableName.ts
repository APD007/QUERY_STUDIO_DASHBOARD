/** Turns an arbitrary filename/label into a valid, predictable SQL identifier. */
export function sanitizeTableName(name: string): string {
  const base = name.replace(/\.(csv|tsv|json|xlsx?|sqlite|db)$/i, '');
  const cleaned = base.replace(/[^a-zA-Z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  return cleaned || 'dataset';
}

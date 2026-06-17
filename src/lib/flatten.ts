/** Flattens nested objects into dot-path keys; arrays are kept as JSON strings. */
export function flattenObject(obj: Record<string, unknown>, prefix = ''): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(out, flattenObject(value as Record<string, unknown>, path));
    } else if (Array.isArray(value)) {
      out[path] = JSON.stringify(value);
    } else {
      out[path] = value;
    }
  }
  return out;
}

/** Accepts an array of records, or an object whose first array-valued property holds the records. */
export function coerceToRows(input: unknown): Record<string, unknown>[] {
  if (Array.isArray(input)) {
    return input.map(row =>
      row !== null && typeof row === 'object' ? flattenObject(row as Record<string, unknown>) : { value: row }
    );
  }
  if (input !== null && typeof input === 'object') {
    const obj = input as Record<string, unknown>;
    const arrayProp = Object.values(obj).find(v => Array.isArray(v)) as unknown[] | undefined;
    if (arrayProp) return coerceToRows(arrayProp);
    return [flattenObject(obj)];
  }
  return [];
}

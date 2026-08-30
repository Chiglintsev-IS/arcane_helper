export function fieldsOf(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? { ...value } : {};
}

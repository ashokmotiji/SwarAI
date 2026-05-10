/** Normalize provider "To" / "From" values for lookup (digits only + leading +). */
export function normalizeE164(raw: string): string {
  const digits = raw.trim().replace(/\s+/g, "").replace(/\D/g, "");
  if (!digits) return "";
  return `+${digits}`;
}

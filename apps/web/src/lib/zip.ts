const ZIP5_PATTERN = /^\d{5}$/;
const ZIP9_PATTERN = /^\d{5}-\d{4}$/;

export function normalizeZipInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 9);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function isValidZipCode(value: string): boolean {
  return ZIP5_PATTERN.test(value) || ZIP9_PATTERN.test(value);
}

export function toZip5(value: string): string {
  return value.replace(/\D/g, "").slice(0, 5);
}

export function zipMatchesEvent(zipValue: string, eventZipCode: string): boolean {
  if (!zipValue.trim()) return true;
  return toZip5(zipValue) === toZip5(eventZipCode);
}

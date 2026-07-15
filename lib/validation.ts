export function normalizeEmail(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

export function isValidEmail(value: unknown): boolean {
  const email = normalizeEmail(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email) && email.length <= 254;
}

export function normalizeSaudiPhone(value: unknown): string {
  return String(value || "")
    .trim()
    .replace(/[\s()-]/g, "")
    .replace(/^00966/, "+966");
}

export function isValidSaudiPhone(value: unknown): boolean {
  const phone = normalizeSaudiPhone(value);
  return /^(?:\+9665|05)\d{8}$/.test(phone);
}

export function normalizeCommercialRegistration(value: unknown): string {
  return String(value || "").trim();
}

export function isValidCommercialRegistration(value: unknown): boolean {
  return /^\d{10}$/.test(normalizeCommercialRegistration(value));
}

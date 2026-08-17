export type AccountEmailChangePlan = "unchanged" | "pending" | "request";

export function normalizeAccountEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/** Keeps an already pending secure e-mail change from being restarted on every settings save. */
export function planAccountEmailChange(input: {
  currentEmail: string | null | undefined;
  pendingEmail: string | null | undefined;
  requestedEmail: string;
}): AccountEmailChangePlan {
  const currentEmail = normalizeAccountEmail(input.currentEmail);
  const pendingEmail = normalizeAccountEmail(input.pendingEmail);
  const requestedEmail = normalizeAccountEmail(input.requestedEmail);
  if (requestedEmail === currentEmail) return "unchanged";
  if (pendingEmail && requestedEmail === pendingEmail) return "pending";
  return "request";
}

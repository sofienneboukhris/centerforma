export type AuditInput = { email: string; success: boolean; reason?: string | null };
export type VerifiedUser = { id: string; email: string | null; role: string | null } | null;

/** Construit la ligne d'audit : l'identité ne vient que de l'utilisateur vérifié côté serveur. */
export function buildAuditRow(data: AuditInput, verified: VerifiedUser) {
  const email = data.email.trim().toLowerCase();
  const bound = !!verified && (verified.email ?? "").toLowerCase() === email;
  return {
    email,
    user_id: bound ? verified!.id : null,
    role: bound ? verified!.role : null,
    success: data.success && bound,
    reason: data.success && !bound ? "Succès non vérifié" : (data.reason ?? null),
  };
}

CREATE TABLE public.login_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  user_id uuid,
  role public.app_role,
  success boolean NOT NULL,
  reason text,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.login_audit TO authenticated;
GRANT ALL ON public.login_audit TO service_role;

ALTER TABLE public.login_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "login_audit admin read" ON public.login_audit
FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['super_admin','directeur','responsable_pedagogique','comptable']::public.app_role[]));

CREATE INDEX login_audit_created_at_idx ON public.login_audit (created_at DESC);
CREATE INDEX login_audit_email_idx ON public.login_audit (lower(email));
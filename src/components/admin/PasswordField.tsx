import { useState } from "react";
import { Eye, EyeOff, RefreshCw } from "lucide-react";
import { Field } from "./Field";

/** Génère un mot de passe fort (lettres + chiffres + symbole). */
export function generateStrongPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  const arr = new Uint32Array(10);
  crypto.getRandomValues(arr);
  for (let i = 0; i < arr.length; i++) out += chars[arr[i] % chars.length];
  return out + "!7";
}

/** Retourne un message d'erreur, ou null si le mot de passe est valide. */
export function validatePassword(value: string): string | null {
  if (!value) return "Mot de passe requis";
  if (value.length < 8) return "8 caractères minimum";
  if (!/[A-Za-z]/.test(value)) return "Au moins une lettre";
  if (!/[0-9]/.test(value)) return "Au moins un chiffre";
  return null;
}

export function PasswordField({
  value,
  onChange,
  error,
  label = "Mot de passe",
  className,
  optional,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
  label?: string;
  className?: string;
  /** Champ facultatif (modification) : vide = mot de passe inchangé. */
  optional?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <Field
      label={label}
      required={!optional}
      error={error}
      hint={
        optional
          ? "Laisser vide pour conserver le mot de passe actuel. Sinon : 8 caractères minimum, avec au moins une lettre et un chiffre."
          : "8 caractères minimum, avec au moins une lettre et un chiffre."
      }
      className={className}
    >
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={show ? "text" : "password"}
            autoComplete="new-password"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="input-base pr-10"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <button
          type="button"
          onClick={() => { onChange(generateStrongPassword()); setShow(true); }}
          title="Générer un mot de passe"
          className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Générer
        </button>
      </div>
    </Field>
  );
}

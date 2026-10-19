import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

function initialsOf(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Renders a person's photo from the private `avatars` bucket (resolving a
 * signed URL) or a full URL, falling back to initials.
 */
export function Avatar({
  path,
  name,
  className,
  variant = "primary",
}: {
  path?: string | null;
  name: string;
  className?: string;
  variant?: "primary" | "info";
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setUrl(null);
    if (!path) return;
    // URL absolue (HTTP/HTTPS), relative locale Nitro (/api/auth/avatar/view/...) ou data URL
    if (/^https?:\/\//.test(path) || path.startsWith("/") || path.startsWith("data:")) {
      setUrl(path);
      return;
    }
    // Fallback de compatibilité pour anciens chemins relatifs Supabase éventuels
    try {
      supabase.storage
        .from("avatars")
        .createSignedUrl(path, 3600)
        .then(({ data }) => {
          if (active) setUrl(data?.signedUrl ?? null);
        })
        .catch(() => {});
    } catch {
      // Ignorer
    }
    return () => {
      active = false;
    };
  }, [path]);

  const tone = variant === "info" ? "bg-info/10 text-info" : "bg-primary/10 text-primary";

  if (url) {
    return (
      <img src={url} alt={name} className={cn("shrink-0 rounded-lg object-cover", className)} />
    );
  }
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-lg text-xs font-bold",
        tone,
        className,
      )}
    >
      {initialsOf(name) || "—"}
    </span>
  );
}

import { motion } from "motion/react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  trendUp = true,
  accent = "primary",
  index = 0,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: string;
  trendUp?: boolean;
  accent?: "primary" | "info" | "success" | "warning";
  index?: number;
}) {
  const accentBg: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    info: "bg-info/10 text-info",
    success: "bg-success/10 text-success",
    warning: "bg-warning/15 text-warning",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06 }}
      className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card transition-all hover:-translate-y-1 hover:shadow-glow"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 font-display text-3xl font-extrabold tracking-tight text-foreground">
            {value}
          </p>
        </div>
        <span className={cn("grid h-12 w-12 place-items-center rounded-xl", accentBg[accent])}>
          <Icon className="h-6 w-6" />
        </span>
      </div>
      {trend && (
        <div className="mt-4 flex items-center gap-1.5 text-sm">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
              trendUp ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
            )}
          >
            {trendUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {trend}
          </span>
          <span className="text-xs text-muted-foreground">vs mois dernier</span>
        </div>
      )}
    </motion.div>
  );
}

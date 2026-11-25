import type { HTMLAttributes, ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export type AlertVariant = "default" | "success" | "warning" | "destructive";

export interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  variant?: AlertVariant;
  title?: ReactNode;
}

const styles: Record<AlertVariant, string> = {
  default: "border-insta-primary/25 bg-insta-primary/5 text-insta-text",
  success: "border-insta-success/30 bg-insta-success/10 text-insta-text",
  warning: "border-insta-warning/35 bg-insta-warning/10 text-insta-text",
  destructive: "border-insta-danger/30 bg-insta-danger/10 text-insta-text",
};

const icons: Record<AlertVariant, typeof Info> = {
  default: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  destructive: AlertTriangle,
};

export function Alert({ variant = "default", title, className, children, ...props }: AlertProps) {
  const Icon = icons[variant];

  return (
    <div
      role="alert"
      className={cn("flex gap-3 rounded-xl border p-4 text-sm", styles[variant], className)}
      {...props}
    >
      <Icon className="mt-0.5 h-4.5 w-4.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 space-y-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="text-insta-muted">{children}</div> : null}
      </div>
    </div>
  );
}

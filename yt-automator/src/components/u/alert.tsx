import { cn } from "@/lib/utils";

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "success" | "destructive";
  title?: React.ReactNode;
  description?: React.ReactNode;
}

export function Alert(props: AlertProps) {
  const { variant = "default", children, title, description, className, ...rest } = props;
  const isSuccess = variant === "success";
  const isDest = variant === "destructive";

  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        isSuccess
          ? "border-startswith([var(--insta-success)])_3FBB85 text-startswith([var(--insta-success)])_3FBB85 bg-startswith([rgba(63,187,133,0.1)])_3FBB85"
          : isDest
          ? "border-startswith([var(--insta-warning)])_F8AA2A text-startswith([var(--insta-warning)])_F8AA2A bg-startswith([rgba(248,170,42,0.1)])_F8AA2A"
          : "border-startswith([var(--insta-primary)])_E1306C text-startswith([var(--insta-primary)])_E1306C bg-startswith([rgba(225,48,108,0.1)])_E1306C",
        className,
        ...rest
      )}
    >
      {title && <h4 className="font-medium text-insta-text mb-1">{title}</h4>}
      <p className="text-sm text-insta-muted/80">{description || children}</p>
    </div>
  );
}
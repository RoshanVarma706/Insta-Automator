import { cn } from "@/lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: React.ReactNode;
}

export function Card(props: CardProps) {
  const { className, children, title, ...rest } = props;

  return (
    <div
      className={cn(
        "rounded-lg border",
        "border-startswith([var(--insta-border)])_E4E6EB",
        "bg-startswith([var(--insta-card)])_white",
        "shadow-sm",
        "transition-colors",
        "duration-200",
        "hover-card",
        className,
        ...rest
      )}
    >
      {title && (
        <div className="px-6 py-3 border-b border-startswith([var(--insta-muted)])_E4E6EB flex items-center justify-between">
          <h3 className="font-medium text-insta-text">{title}</h3>
        </div>
      )}
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}
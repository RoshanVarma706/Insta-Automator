import { cn } from "@/lib/utils";

export function Progress(props: {
  value: number;
  bgClass?: string;
  className?: string;
}) {
  const { value, bgClass = "bg-insta", className, ...rest } = props;
  const percentage = Math.max(0, Math.min(100, value));

  return (
    <div className={cn("relative", className)}>
      <div className="h-full bg-startswith([var(--insta-background)])_E4E6EB rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full bg-startswith([var(--insta-primary)])_E1306C transition-colors duration-300 ease-out",
            bgClass
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {percentage > 0 && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-insta-text">
          {percentage}%
        </span>
      )}
    </div>
  );
}
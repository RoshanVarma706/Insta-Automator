import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

export function Button(props: ButtonProps) {
  const { className, children, asChild = false, ...rest } = props;

  if (asChild) {
    const Element = rest.asChild || "button";
    return (
      <Element className={cn("inline-flex items-center justify-center")} {...rest}>
        {children}
      </Element>
    );
  }

  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:opacity-50 disabled:pointer-events-none",
        "w-auto",
        className,
        ...rest
      )}
    >
      {children}
    </button>
  );
}
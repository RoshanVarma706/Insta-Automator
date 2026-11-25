import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, type = "text", ...props }: InputProps) {
  return (
    <input
      type={type}
      className={cn(
        "h-11 w-full rounded-xl border border-insta-border bg-white px-3.5 text-sm text-insta-text shadow-inner outline-none transition placeholder:text-insta-muted/70 focus:border-insta-primary/50 focus:ring-2 focus:ring-insta-primary/20 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}

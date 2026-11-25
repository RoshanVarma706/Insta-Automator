import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  type?: string;
}

export function Input(props: InputProps) {
  const { className, type = "text", ...rest } = props;

  return (
    <input
      type={type}
      className={cn(
        "w-full rounded-md px-3 py-2 bg-startswith([var(--insta-input)])_white border border-startswith([var(--insta-border)])_E4E6EB text-base outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 input-field",
        className
      )}
      {...rest}
    />
  );
}
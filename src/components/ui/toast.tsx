import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastVariant = "default" | "success" | "destructive";

export type ToastInput = {
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
};

type ToastItem = Required<Omit<ToastInput, "duration">> & { id: number };

type ToastContextValue = {
  toast: (input: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue>({ toast: () => undefined });

export function useToast() {
  return useContext(ToastContext);
}

const styles: Record<ToastVariant, string> = {
  default: "border-insta-border bg-white",
  success: "border-insta-success/40 bg-white",
  destructive: "border-insta-danger/40 bg-white",
};

const iconStyles: Record<ToastVariant, string> = {
  default: "bg-insta-primary/10 text-insta-primary",
  success: "bg-insta-success/10 text-insta-success",
  destructive: "bg-insta-danger/10 text-insta-danger",
};

const icons = {
  default: Info,
  success: CheckCircle2,
  destructive: AlertTriangle,
} as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = Date.now() + Math.random();
      setItems((current) => [
        ...current,
        {
          id,
          title: input.title,
          description: input.description ?? "",
          variant: input.variant ?? "default",
        },
      ]);

      window.setTimeout(() => dismiss(id), input.duration ?? 4500);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div
        className="pointer-events-none fixed inset-x-4 top-4 z-50 flex flex-col items-end gap-2 sm:left-auto sm:w-96"
        aria-live="polite"
        aria-atomic="true"
      >
        {items.map((item) => {
          const Icon = icons[item.variant];

          return (
            <div
              key={item.id}
              className={cn(
                "pointer-events-auto flex w-full items-start gap-3 rounded-xl border p-3.5 shadow-lg shadow-insta-text/5 animate-float-in",
                styles[item.variant],
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                  iconStyles[item.variant],
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-insta-text">{item.title}</p>
                {item.description ? (
                  <p className="mt-0.5 text-xs leading-relaxed text-insta-muted">
                    {item.description}
                  </p>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => dismiss(item.id)}
                className="rounded-md p-1 text-insta-muted transition hover:bg-insta-bg hover:text-insta-text"
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

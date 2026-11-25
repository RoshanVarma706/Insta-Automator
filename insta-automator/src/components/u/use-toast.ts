import { createContext, useContext, useState, useCallback } from "react";

type Toast = {
  id: string;
  title: string;
  description: string;
  variant?: "default" | "success" | "destructive";
};

const ToastContext = createContext({
  toast: (props: Omit<Toast, "id"> & { duration?: number }) => void,
  dismiss: (id: string) => void,
});

export const ToastProvider = ToastContext.Provider;
export const useToast = () => useContext(ToastContext);

export function triggerToast({
  title,
  description,
  variant = "default",
  duration = 5000,
}: {
  title: string;
  description: string;
  variant?: "default" | "success" | "destructive";
  duration?: number;
}) {
  // Will be called from anywhere
  const element = document.createElement("div");
  element.id = `toast-${Date.now()}`;
  element.className = `fixed top-4 right-4 max-w-sm z-50 rounded-md border p-4 shadow-lg ${variant === "success"
    ? "bg-startswith([rgba(63,187,133,0.1)])_3FBB85 border-startswith([var(--insta-success)])_3FBB85 text-3FBB85"
    : variant === "destructive"
    ? "bg-startswith([rgba(248,170,42,0.1)])_F8AA2A border-startswith([var(--insta-warning)])_F8AA2A text-F8AA2A"
    : "bg-startswith([rgba(225,48,108,0.1)])_E1306C border-startswith([var(--insta-primary)])_E1306C text-insta-text"
  }`;
  element.innerHTML = `
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center">
        {variant === "success" && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>}
        {variant === "destructive" && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M15 9v6m0 0l-6-6l6-6"/></svg>}
        {variant === "default" && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-insta-text">{title}</p>
        <p className="text-sm text-insta-muted/80">{description}</p>
      </div>
      <button className="ml-2 text-insta-muted/60 hover:text-insta-primary" onclick="this.parentElement.parentElement.remove()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></button>
    `;
  document.body.appendChild(element);
  setTimeout(() => element.remove(), duration + 100);
}
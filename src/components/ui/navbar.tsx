import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Camera, Menu, X } from "lucide-react";
import { checkPipelineStatus, type PipelineStatus } from "@/lib/pipeline";
import { cn } from "@/lib/utils";

const links = [
  { to: "/", label: "Create", end: true },
  { to: "/dashboard", label: "Dashboard", end: false },
  { to: "/history", label: "History", end: false },
  { to: "/settings", label: "Settings", end: false },
];

function navClasses(isActive: boolean) {
  return cn(
    "rounded-lg px-3 py-2 text-sm font-semibold transition",
    isActive
      ? "bg-white text-insta-primary shadow-sm"
      : "text-insta-muted hover:bg-white/70 hover:text-insta-text",
  );
}

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<PipelineStatus>({ configured: false, igAccount: null });

  useEffect(() => {
    let active = true;
    checkPipelineStatus().then((next) => {
      if (active) setStatus(next);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-insta-border/80 bg-white/75 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4">
        <Link
          to="/"
          className="flex items-center gap-2.5"
          onClick={() => setOpen(false)}
          aria-label="Insta Auto home"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#e1306c,#fd1f1f_55%,#a855f7)] text-white shadow-sm">
            <Camera className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-base font-extrabold tracking-tight text-insta-text">
              Insta Auto
            </span>
            <span className="text-[10px] font-medium uppercase tracking-widest text-insta-muted">
              Reels on autopilot
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 rounded-xl bg-insta-bg/80 p-1 md:flex">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => navClasses(isActive)}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-insta-border bg-white px-3 py-1.5 text-xs font-semibold text-insta-muted sm:flex">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                status.configured ? "bg-insta-success" : "bg-insta-warning",
              )}
            />
            {status.configured
              ? status.igAccount
                ? `@${status.igAccount.username}`
                : "Live"
              : "Setup keys"}
          </span>

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-insta-border bg-white text-insta-text md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open ? (
        <nav className="border-t border-insta-border bg-white px-4 py-3 md:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-1">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "rounded-lg px-3 py-2.5 text-sm font-semibold transition",
                    isActive
                      ? "bg-insta-primary/10 text-insta-primary"
                      : "text-insta-muted hover:bg-insta-bg hover:text-insta-text",
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </div>
        </nav>
      ) : null}
    </header>
  );
}

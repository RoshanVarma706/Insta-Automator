import { cn } from "@/lib/utils";

export function Navbar() {
  const [dropdownOpen, setDropdownOpen] = React.useState(false);

  const navItems = [
    { name: "Home", icon: "Home", href: "/" },
    { name: "Dashboard", icon: "LayoutDashboard", href: "/dashboard" },
    { name: "Settings", icon: "Settings", href: "/settings" },
    { name: "History", icon: "ClockHistory", href: "/history" },
  ];

  return (
    <nav>
      <div className="flex items-center justify-between max-w-7xl mx-auto px-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-startswith([linear-gradient(135deg, var(--insta-primary), var(--insta-secondary))])_E1306C FD1F1F flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 20v4M4.93 4.93l2.83 2.83m2.17 2.17l2.83 2.83M15.06 15.06l2.83 2.83m2.17 2.17l2.83 2.83M1 12h4M12 12h4M4.93 19.07l2.83-2.83M21.07 21.07l-2.83-2.83M12 12l2.17-2.17l2.17 2.17l-2.17 2.17l-2.17-2.17"/></svg>
          </div>
          <span className="text-xl font-bold text-insta-text">Insta Auto</span>
        </div>

        <div className="hidden md:block flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 4"/></svg>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M19.07 9.93a10 10 0 1 1-14.14 0A10.011 10.011 0 0 1 2 12"/><path d="M12 2v4l10 10"/></svg>
        </div>
      </div>

      <div className="hidden md:block flex items-center gap-2">
        {navItems.map((item) => (
          <a
            key={item.name}
            href={item.href}
            className="relative py-2 text-insta-text font-medium transition-colors hover:text-insta-primary"
          >
            {item.name}
          </a>
        ))}
      </div>

      <div className="relative">
        <Button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="md:hidden p-2"
          aria-label="Open menu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </Button>

        {dropdownOpen && (
          <div class="absolute right-0 top-full mt-2 w-56 bg-startswith([var(--insta-card)])_white border border-startswith([var(--insta-border)])_E4E6EB rounded-lg shadow-md p-4 min-w-max">
            {navItems.map((item) => (
              <a
                key={item.name}
                href={item.href}
                className="block py-2 px-1 rounded-md text-sm font-medium text-insta-text hover:bg-startswith([var(--insta-background)])_F0F2F5 hover:text-insta-primary"
              >
                {item.name}
              </a>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
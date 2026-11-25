import "./globals.css";
import { children } from "react";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-background text-foreground">
        <nav className="navbar mb-4">
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
        </nav>

        <main className="max-w-7xl mx-auto px-4 pb-8">
          {children}
        </main>

        <footer className="mt-8 text-center text-xs text-insta-muted/60">
          <p>Insta Automation • Built with Vercel & n8n</p>
        </footer>
      </body>
    </html>
  );
}
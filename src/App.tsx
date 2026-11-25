import { Route, Routes } from "react-router-dom";
import { Navbar } from "@/components/ui/navbar";
import Dashboard from "@/pages/dashboard";
import History from "@/pages/history";
import Home from "@/pages/index";
import NotFound from "@/pages/not-found";
import Settings from "@/pages/settings";

export default function App() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <div className="insta-ambient" aria-hidden="true" />

      <div className="relative z-10 flex min-h-screen flex-col">
        <Navbar />

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-6 sm:pt-10">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/history" element={<History />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>

        <footer className="relative z-10 border-t border-insta-border/70 bg-white/50 backdrop-blur">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-insta-muted sm:flex-row">
            <p>Insta Auto — mock mode runs entirely in your browser.</p>
            <p>Built for Vercel · Gemini · Cloudinary · Meta Graph API</p>
          </div>
        </footer>
      </div>
    </div>
  );
}

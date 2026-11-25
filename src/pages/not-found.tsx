import { Link } from "react-router-dom";
import { ArrowLeft, Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center py-24 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-insta-primary/10 text-insta-primary">
        <Compass className="h-7 w-7" />
      </span>

      <h1 className="mt-5 text-2xl font-extrabold tracking-tight">Page not found</h1>
      <p className="mt-2 text-sm text-insta-muted">
        The page you are looking for does not exist or was moved.
      </p>

      <Link
        to="/"
        className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#e1306c,#fd1f1f_55%,#a855f7)] px-5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to create
      </Link>
    </div>
  );
}

/**
 * Shared types for Vercel serverless functions.
 * Keeps every endpoint consistent without pulling in @vercel/node.
 */

export type ApiRequest = {
  method?: string;
  body?: unknown;
  query?: Record<string, string | string[]>;
};

export type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

/** Type-safe body parser — handles string, object, or undefined. */
export function parseBody(body: unknown): Record<string, unknown> {
  if (!body) return {};

  if (typeof body === "string") {
    try {
      const parsed = JSON.parse(body);
      return typeof parsed === "object" && parsed !== null
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }

  return typeof body === "object" ? (body as Record<string, unknown>) : {};
}

/** Sends a JSON error and returns void so endpoints can `return fail(res, 400, "…")`. */
export function fail(res: ApiResponse, status: number, error: string) {
  res.status(status).json({ ok: false, error });
}

/** Extracts a readable message from Error instances, Cloudinary plain objects, or strings. */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const obj = err as Record<string, unknown>;
    if (typeof obj.message === "string") return obj.message;
    if (obj.error && typeof obj.error === "object") {
      const inner = obj.error as Record<string, unknown>;
      if (typeof inner.message === "string") return inner.message;
    }
    try {
      return JSON.stringify(err);
    } catch {
      return "Unknown error";
    }
  }
  return String(err);
}

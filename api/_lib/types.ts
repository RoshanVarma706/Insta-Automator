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

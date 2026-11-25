import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";

type Handler = (
  req: { method?: string; body?: unknown; query?: Record<string, string | string[]> },
  res: {
    status: (code: number) => unknown;
    json: (body: unknown) => void;
    setHeader: (name: string, value: string) => void;
  },
) => Promise<void> | void;

async function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function createApiMiddleware(loadModule: (filePath: string) => Promise<{ default: Handler }>) {
  const apiDir = fileURLToPath(new URL("./api", import.meta.url));

  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (!req.url?.startsWith("/api/")) return next();

    const parsed = new URL(req.url, "http://localhost");
    const routeName = parsed.pathname.replace(/^\/api\//, "").replace(/\/+$/, "");

    if (!routeName || routeName.startsWith("_")) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: false, error: "Not found" }));
      return;
    }

    const filePath = path.join(apiDir, `${routeName}.ts`);
    if (!fs.existsSync(filePath)) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: false, error: `API route /api/${routeName} not found` }));
      return;
    }

    try {
      const mod = await loadModule(filePath);
      const rawBody = req.method === "POST" ? await readRequestBody(req) : undefined;
      const query: Record<string, string> = {};
      parsed.searchParams.forEach((value, key) => {
        query[key] = value;
      });

      const apiRes = {
        status(code: number) {
          res.statusCode = code;
          return apiRes;
        },
        setHeader(name: string, value: string) {
          res.setHeader(name, value);
        },
        json(body: unknown) {
          if (!res.headersSent) {
            res.setHeader("Content-Type", "application/json");
          }
          res.end(JSON.stringify(body));
        },
      };

      await mod.default({ method: req.method, body: rawBody, query }, apiRes);
      if (!res.writableEnded) res.end();
    } catch (err) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  };
}

function localApiPlugin(): Plugin {
  return {
    name: "local-vercel-api",
    configureServer(server) {
      server.middlewares.use(
        createApiMiddleware((filePath) => server.ssrLoadModule(filePath) as Promise<{ default: Handler }>),
      );
    },
    configurePreviewServer(server) {
      server.middlewares.use(
        createApiMiddleware(async (filePath) => {
          const esbuild = await import("esbuild");
          const cacheDir = path.resolve(path.dirname(filePath), "..", "node_modules", ".vite-api");
          fs.mkdirSync(cacheDir, { recursive: true });
          const outFile = path.join(cacheDir, `${path.basename(filePath, ".ts")}.mjs`);
          await esbuild.build({
            entryPoints: [filePath],
            bundle: true,
            platform: "node",
            format: "esm",
            outfile: outFile,
            packages: "external",
          });
          return import(`${pathToFileURL(outFile).href}?t=${Date.now()}`) as Promise<{
            default: Handler;
          }>;
        }),
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), localApiPlugin()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5173,
  },
});

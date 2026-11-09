import { build } from "esbuild";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
const output = "/tmp/scorerush-ui-review";
await mkdir(output, { recursive: true });
await build({
  entryPoints: [
    process.env.UI_REVIEW_SAVE
      ? "e2e/save-preview.tsx"
      : process.env.UI_REVIEW_LIVE
        ? "e2e/live-preview.tsx"
        : "e2e/competitive-preview.tsx",
  ],
  outfile: `${output}/app.js`,
  bundle: true,
  platform: "browser",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"development"' },
  plugins: [
    {
      name: "next-test-stubs",
      setup(b) {
        b.onResolve({ filter: /actions$/ }, (args) => {
          if (
            args.importer.includes("nickname-form") ||
            args.importer.includes("prediction-form")
          )
            return { path: args.path, namespace: "test-actions" };
        });
        b.onLoad({ filter: /.*/, namespace: "test-actions" }, () => ({
          loader: "js",
          contents:
            'export async function saveNickname(_,form){return {savedName:form.get("nickname")};} export async function submitMatchPrediction(_,form){return {status:"success",predictedHome:Number(form.get("predictedHome")),predictedAway:Number(form.get("predictedAway"))};}',
        }));
        b.onResolve({ filter: /^next\/(link|navigation)$/ }, (args) => ({
          path: args.path,
          namespace: "test-next",
        }));
        b.onLoad({ filter: /.*/, namespace: "test-next" }, (args) => ({
          loader: "jsx",
          contents: args.path.endsWith("link")
            ? 'import React from "react"; export default function Link({children,prefetch,...props}) { return <a {...props}>{children}</a>; }'
            : "export function usePathname(){ return location.pathname; } export function useRouter(){return {push(href){history.pushState({},'',href);window.dispatchEvent(new PopStateEvent('popstate'));}};}",
          resolveDir: process.cwd(),
        }));
      },
    },
  ],
});
const chunkDir = ".next/static/chunks";
const styles = (await readdir(chunkDir)).filter((f) => f.endsWith(".css"));
const css = (
  await Promise.all(styles.map((f) => readFile(`${chunkDir}/${f}`, "utf8")))
)
  .join("\n")
  .replaceAll("/_next/static/media/", "/fonts/")
  .replaceAll("../media/", "/fonts/");
await writeFile(`${output}/app.css`, css);
const html =
  '<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><style>body{font-family:Rubik,Arial,sans-serif}body,*{box-sizing:border-box}</style><div id="root"></div><script src="/app.js"></script></html>';
createServer(async (req, res) => {
  if (req.method !== "GET") {
    res.writeHead(405);
    res.end("Verification server never saves predictions");
    return;
  }
  const path = req.url.split("?")[0];
  if (path === "/sw.js") {
    res.setHeader("Content-Type", "application/javascript");
    res.end(
      'self.addEventListener("install",()=>self.skipWaiting()); self.addEventListener("activate",event=>event.waitUntil(self.clients.claim()));',
    );
    return;
  }
  if (path === "/api/push") {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ publicKey: null }));
    return;
  }
  if (path === "/app.js" || path === "/app.css") {
    res.setHeader(
      "Content-Type",
      path.endsWith("js") ? "application/javascript" : "text/css",
    );
    res.end(await readFile(output + path));
  } else if (path.startsWith("/fonts/")) {
    const filename = path.slice(7);
    if (!/^[a-zA-Z0-9_.-]+$/.test(filename)) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.setHeader("Content-Type", "font/woff2");
    res.end(await readFile(".next/static/media/" + filename));
  } else {
    res.setHeader("Content-Type", "text/html");
    res.end(html);
  }
}).listen(4173, "127.0.0.1", () =>
  console.log("Isolated UI review: http://127.0.0.1:4173 — no database access"),
);

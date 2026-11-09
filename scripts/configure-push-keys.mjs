import { appendFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import webpush from "web-push";
const cli = process.env.SCORERUSH_VERCEL_CLI;
if (!cli) throw new Error("Provide SCORERUSH_VERCEL_CLI path");
let publicKey = process.env.VAPID_PUBLIC_KEY,
  privateKey = process.env.VAPID_PRIVATE_KEY;
if (!publicKey && !privateKey) {
  ({ publicKey, privateKey } = webpush.generateVAPIDKeys());
  await appendFile(
    ".env.local",
    `\nVAPID_PUBLIC_KEY=${publicKey}\nVAPID_PRIVATE_KEY=${privateKey}\n`,
    { mode: 0o600 },
  );
}
if (!publicKey || !privateKey)
  throw new Error("Incomplete existing key pair; refusing rotation");
for (const [name, value] of [
  ["VAPID_PUBLIC_KEY", publicKey],
  ["VAPID_PRIVATE_KEY", privateKey],
]) {
  const code = await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        cli,
        "env",
        "add",
        name,
        "production",
        "--sensitive",
        "--yes",
        "--scope",
        "world-cup-friends",
      ],
      { stdio: ["pipe", "ignore", "pipe"] },
    );
    child.stderr.on("data", () => {});
    child.on("error", reject);
    child.on("exit", resolve);
    child.stdin.end(value);
  });
  if (code !== 0)
    throw new Error(
      `Could not add ${name}; inspect existing configuration before retrying`,
    );
  console.log(`${name} securely configured for production`);
}

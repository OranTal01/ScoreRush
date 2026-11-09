import { expect, it } from "vitest";
import { runtimeDatabaseUrl } from "./connection";
it("uses the transaction pooler without changing credentials, host or database", () => {
  const input =
    "postgres://user:pass%40word@aws-0-example.pooler.supabase.com:5432/postgres?sslmode=require";
  const result = new URL(runtimeDatabaseUrl(input));
  const before = new URL(input);
  expect(result.port).toBe("6543");
  for (const key of [
    "username",
    "password",
    "hostname",
    "pathname",
    "search",
  ] as const)
    expect(result[key]).toBe(before[key]);
});
it("leaves local and already configured transaction connections untouched", () => {
  for (const url of [
    "postgres://postgres:local@127.0.0.1:55439/scorerush_settings",
    "postgres://user:local@aws-0-example.pooler.supabase.com:6543/postgres",
    "postgres://user:local@db.example.supabase.co:5432/postgres",
  ])
    expect(runtimeDatabaseUrl(url)).toBe(url);
});

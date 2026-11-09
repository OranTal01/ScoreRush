/** Supabase's shared transaction pooler is intended for short-lived Vercel
 * functions. Preserve direct/local URLs and credentials exactly; only switch
 * the documented shared-pooler session port to its transaction counterpart. */
export function runtimeDatabaseUrl(value: string): string {
  const url = new URL(value);
  if (
    url.hostname.endsWith(".pooler.supabase.com") &&
    (!url.port || url.port === "5432")
  ) {
    url.port = "6543";
    return url.toString();
  }
  return value;
}

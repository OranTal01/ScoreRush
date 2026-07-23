// Vitest-only stub for the `server-only` package. Next's bundler resolves
// `server-only` to a no-op under the "react-server" export condition;
// Vitest has no such condition, so without this alias any module that does
// `import "server-only"` (directly or transitively) throws immediately when
// a test imports it — see ARCHITECTURE.md §11 and the `server-only` guard
// used throughout lib/db, lib/sync, lib/providers/football-data, lib/env.
// This file intentionally has no exports; it exists only to be imported for
// its (absent) side effects, mirroring the package's real no-op behavior.
export {};

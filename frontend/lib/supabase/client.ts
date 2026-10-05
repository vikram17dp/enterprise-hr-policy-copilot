import { createBrowserClient } from "@supabase/ssr";

// Module-level singleton: every apiFetch used to build a brand-new Supabase
// client, so concurrent calls each parsed storage and, with an expired access
// token, each started its OWN refresh request against GoTrue (a refresh storm
// that delayed every API call before it was even dispatched). One shared
// client means one in-memory session and one refresh lock.
// The builder wrapper pins the exact inferred client type so the memoized
// singleton keeps the same typing as a direct createBrowserClient() call.
function buildClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}

let client: ReturnType<typeof buildClient> | undefined;

export function createClient() {
  client ??= buildClient();
  return client;
}

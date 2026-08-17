import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import type { Database } from "./database.types";

export async function updateSupabaseSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const accountsEnabled =
    process.env.ACCOUNT_BACKEND_PROVIDER === "supabase" &&
    process.env.ACCOUNTS_ENABLED === "true";

  if (!accountsEnabled || !supabaseUrl || !supabaseKey) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        }
      }
    }
  );

  // A local dev server must remain usable when the configured Supabase
  // project is unreachable. Production still validates and refreshes claims
  // synchronously below.
  if (process.env.NODE_ENV === "development") return response;

  // Validates the JWT and refreshes an expired session when necessary.
  await supabase.auth.getClaims();

  return response;
}

import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";

/** Supabase client using Clerk JWT (enable Third Party Auth in Supabase + JWT template named "supabase"). */
export async function createClerkSupabaseClient() {
  const { getToken, userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error("Missing Supabase URL or anon key");
  }
  const jwt = await getToken({ template: "supabase" });
  if (!jwt) {
    throw new Error('Missing Clerk JWT template "supabase" — see README');
  }
  return createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

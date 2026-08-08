import { createClient } from "@supabase/supabase-js";

// Trims trailing slashes and '/rest/v1' if included by mistake in .env
const rawUrl = (import.meta.env["VITE_SUPABASE_URL"] as string | undefined) || "";
const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");

const supabaseAnonKey = (import.meta.env["VITE_SUPABASE_ANON_KEY"] as string | undefined) || "";

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes("sua-url-do-projeto")) {
  console.warn(
    "[RiccOS - Supabase Warning]: As credenciais VITE_SUPABASE_URL e/ou VITE_SUPABASE_ANON_KEY não estão configuradas corretamente no seu arquivo .env.",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

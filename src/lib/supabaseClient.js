import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Null until VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are set (see .env.example).
// Callers must check for null and fall back to the bundled snapshot data.
export const supabase = url && anonKey ? createClient(url, anonKey) : null;

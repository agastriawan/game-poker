import { createClient, SupabaseClient } from "@supabase/supabase-js";

const FALLBACK_SUPABASE_URL = "https://qdewxnbieoqjaesziemc.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkZXd4bmJpZW9xamFlc3ppZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0ODI0NjYsImV4cCI6MjEwOTA1ODQ2Nn0.OeYDU5RGjxGqX_cp80o0iukHaFQubfyo18hmnmVW_Tc";

const envUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const envKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();

const supabaseUrl =
  envUrl && envUrl.startsWith("https://") && !envUrl.includes("your-project-id")
    ? envUrl
    : FALLBACK_SUPABASE_URL;

// Gunakan key valid jika envKey kosong atau jika envKey tidak sengaja memakai contoh key lama yang tidak valid
const supabaseAnonKey =
  envKey && !envKey.endsWith("4uL7Y81zZ7cQ")
    ? envKey
    : FALLBACK_SUPABASE_ANON_KEY;

export function isSupabaseConfigured(): boolean {
  return (
    Boolean(supabaseUrl) &&
    Boolean(supabaseAnonKey) &&
    supabaseUrl.startsWith("https://") &&
    !supabaseUrl.includes("your-project-id")
  );
}

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      realtime: {
        params: {
          eventsPerSecond: 20,
        },
      },
    });
  }
  return supabaseInstance;
}


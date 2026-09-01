export const LEAGUE_ID =
  import.meta.env.VITE_SLEEPER_LEAGUE_ID || "1398145266615345152";

export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || "https://iimmjxnjkkzejwgxofsk.supabase.co";

// Supabase publishable keys are intentionally safe for browser clients. RLS remains authoritative.
export const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_UPTYCbZFE3ZN5P6GdS0ZcQ_LCntNs7k";

export const PUBLIC_SITE_URL =
  import.meta.env.VITE_PUBLIC_SITE_URL || "https://sleeper-draft-night-dashboard.vercel.app";

export const TEAM_ACCENTS = [
  ["#1f9bfe", "#b7ff3c"],
  ["#ef4444", "#f97316"],
  ["#22c55e", "#a3e635"],
  ["#a855f7", "#38bdf8"],
  ["#f59e0b", "#f43f5e"],
  ["#14b8a6", "#60a5fa"],
];

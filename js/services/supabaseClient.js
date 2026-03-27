import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://bcfnqbhrfjaqjdcwynqw.supabase.co";

const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjZm5xYmhyZmphcWpkY3d5bnF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwOTQ5OTksImV4cCI6MjA4ODY3MDk5OX0.wR7mM5FMCgOvQqqmBu4FAbSKU6luu_sQ4NTbRhaD58U"; // pegá la misma

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

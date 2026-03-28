import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

import { SUPABASE_KEY, SUPABASE_URL } from "../config.js";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

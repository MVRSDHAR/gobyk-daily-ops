import { createClient } from '@supabase/supabase-js';

// These two values come from your Supabase project settings.
// They are safe to expose in the browser — Row Level Security
// is what actually protects the data, not secrecy of this key.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

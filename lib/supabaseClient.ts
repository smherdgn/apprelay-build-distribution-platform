
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL or Anon Key is missing. Check your .env.local file.");
}

// Allow TypeScript to infer the client type, which will correctly include the "apprelay" schema.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: {
    schema: 'apprelay',
  }
});

// For server-side operations requiring elevated privileges, you might create another client
// using the service role key. Be careful where you use this.
// export const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!, { db: { schema: 'apprelay' } });
// Ensure SUPABASE_SERVICE_ROLE_KEY is only used in server-side code (API routes).
import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database";
import { createSupabasePersistenceClient } from "./persistence-client-options.ts";

export { SupabasePersistenceConfigurationError } from "@/lib/supabase/persistence-client-options";

export function createSupabasePersistenceServerClient() {
  return createSupabasePersistenceClient(
    {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    },
    (supabaseUrl, secretKey, options) =>
      createClient<Database>(supabaseUrl, secretKey, options),
  );
}

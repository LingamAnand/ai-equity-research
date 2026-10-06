export interface SupabasePersistenceEnvironment {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
}

export interface SupabasePersistenceClientOptions {
  auth: {
    autoRefreshToken: false;
    persistSession: false;
    detectSessionInUrl: false;
  };
}

export interface SupabasePersistenceClientFactory<TClient> {
  (
    supabaseUrl: string,
    secretKey: string,
    options: SupabasePersistenceClientOptions,
  ): TClient;
}

export class SupabasePersistenceConfigurationError extends Error {
  constructor() {
    super(
      "Supabase persistence is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY on the server.",
    );
    this.name = "SupabasePersistenceConfigurationError";
  }
}

export function createSupabasePersistenceClient<TClient>(
  environment: SupabasePersistenceEnvironment,
  clientFactory: SupabasePersistenceClientFactory<TClient>,
): TClient {
  const supabaseUrl = environment.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secretKey = environment.SUPABASE_SECRET_KEY?.trim();

  if (!supabaseUrl || !secretKey) {
    throw new SupabasePersistenceConfigurationError();
  }

  return clientFactory(supabaseUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

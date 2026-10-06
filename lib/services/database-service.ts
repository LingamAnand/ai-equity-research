import "server-only";

import {
  SupabaseDatabaseRepository,
} from "@/lib/repositories/supabase-database-repository";

const repository = new SupabaseDatabaseRepository();

export class DatabaseService {
  checkSupabaseConnection() {
    return repository.checkConnection();
  }
}

export const databaseService = new DatabaseService();

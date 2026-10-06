export type PersistenceOperationType =
  | "INSERT"
  | "UPDATE"
  | "UPSERT"
  | "SELECT";

export interface PersistenceFailureContext {
  repositoryOperation: string;
  targetTable: string;
  operationType: PersistenceOperationType;
}

export function persistenceErrorCode(error: unknown): string {
  if (typeof error !== "object" || error === null) {
    return "unavailable";
  }

  if ("code" in error) {
    const code = error.code;
    if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) {
      return code;
    }
  }
  if ("postgresErrorCode" in error) {
    const code = error.postgresErrorCode;
    if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) {
      return code;
    }
  }
  return "unavailable";
}

export function logPersistenceFailure(
  error: unknown,
  context: PersistenceFailureContext,
): void {
  console.warn("[supabase] Persistence was skipped.", {
    repositoryOperation: context.repositoryOperation,
    targetTable: context.targetTable,
    operationType: context.operationType,
    postgresErrorCode: persistenceErrorCode(error),
    persistenceSkipped: true,
  });
}

export async function runBestEffortPersistence<T>(
  context: PersistenceFailureContext,
  action: () => Promise<T>,
): Promise<T | undefined> {
  try {
    return await action();
  } catch (error) {
    logPersistenceFailure(error, context);
    return undefined;
  }
}

import type { Company } from "@/lib/types/financial";
import type { FundamentalsHistory } from "@/lib/types/fundamentals";

export interface FundamentalsProvider {
  getFundamentals(ticker: string): Promise<FundamentalsHistory | null>;
  getCompany?(ticker: string): Promise<Company | null>;
  searchCompanies?(query: string): Promise<Company[]>;
}

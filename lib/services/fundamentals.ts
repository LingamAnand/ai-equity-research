import { HdfcBankFundamentalsProvider } from "@/lib/providers/hdfc-bank-fundamentals-provider";
import { RoutedFundamentalsProvider } from "@/lib/providers/routed-fundamentals-provider";
import { SecEdgarFundamentalsProvider } from "@/lib/providers/sec-edgar-fundamentals-provider";
import { FundamentalsService } from "@/lib/services/fundamentals-service";

const fundamentalsProvider = new RoutedFundamentalsProvider(
  new HdfcBankFundamentalsProvider(),
  new SecEdgarFundamentalsProvider(),
);

export const fundamentalsService = new FundamentalsService(
  fundamentalsProvider,
);

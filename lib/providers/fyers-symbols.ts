export interface FyersEquityInstrument {
  ticker: string;
  name: string;
  symbol: string;
  exchange: "NSE";
  currency: "INR";
}

export interface FyersIndexInstrument {
  symbol: string;
  appSymbol: string;
  label: string;
  currency: "INR";
}

export const fyersEquityInstruments: readonly FyersEquityInstrument[] = [
  {
    ticker: "HDFCBANK.NS",
    name: "HDFC Bank Limited",
    symbol: "NSE:HDFCBANK-EQ",
    exchange: "NSE",
    currency: "INR",
  },
  {
    ticker: "ICICIBANK.NS",
    name: "ICICI Bank Limited",
    symbol: "NSE:ICICIBANK-EQ",
    exchange: "NSE",
    currency: "INR",
  },
  {
    ticker: "SBIN.NS",
    name: "State Bank of India",
    symbol: "NSE:SBIN-EQ",
    exchange: "NSE",
    currency: "INR",
  },
  {
    ticker: "RELIANCE.NS",
    name: "Reliance Industries Limited",
    symbol: "NSE:RELIANCE-EQ",
    exchange: "NSE",
    currency: "INR",
  },
  {
    ticker: "TCS.NS",
    name: "Tata Consultancy Services Limited",
    symbol: "NSE:TCS-EQ",
    exchange: "NSE",
    currency: "INR",
  },
  {
    ticker: "INFY.NS",
    name: "Infosys Limited",
    symbol: "NSE:INFY-EQ",
    exchange: "NSE",
    currency: "INR",
  },
];

export const fyersOverviewInstruments: readonly FyersIndexInstrument[] = [
  {
    symbol: "NSE:NIFTY50-INDEX",
    appSymbol: "^NSEI",
    label: "NIFTY 50",
    currency: "INR",
  },
  {
    symbol: "BSE:SENSEX-INDEX",
    appSymbol: "^BSESN",
    label: "SENSEX",
    currency: "INR",
  },
  {
    symbol: "NSE:NIFTYBANK-INDEX",
    appSymbol: "^NSEBANK",
    label: "NIFTY BANK",
    currency: "INR",
  },
  {
    symbol: "NSE:INDIAVIX-INDEX",
    appSymbol: "^INDIAVIX",
    label: "INDIA VIX",
    currency: "INR",
  },
];

const symbolAliases = new Map<string, string>();

function addAliases(symbol: string, aliases: string[]): void {
  for (const alias of aliases) {
    symbolAliases.set(alias.trim().toLocaleUpperCase(), symbol);
  }
}

for (const instrument of fyersEquityInstruments) {
  addAliases(instrument.symbol, [
    instrument.ticker,
    instrument.ticker.replace(/\.NS$/, ""),
    instrument.name,
    instrument.symbol,
  ]);
}

for (const instrument of fyersOverviewInstruments) {
  const shortName = instrument.label.replace(/\s+/g, "");
  addAliases(instrument.symbol, [
    instrument.appSymbol,
    instrument.label,
    shortName,
    instrument.symbol,
  ]);
}

export function normalizeFyersSymbol(identifier: string): string | null {
  return symbolAliases.get(identifier.trim().toLocaleUpperCase()) ?? null;
}

export function resolveFyersEquityInstrument(
  identifier: string,
): FyersEquityInstrument | null {
  const symbol = normalizeFyersSymbol(identifier);
  return fyersEquityInstruments.find(
    (instrument) => instrument.symbol === symbol,
  ) ?? null;
}

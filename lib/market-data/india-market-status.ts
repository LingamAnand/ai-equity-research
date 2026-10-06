import type { MarketTradingStatus } from "../types/financial.ts";

export type IndiaEquitySessionStatus = MarketTradingStatus | "PRE_OPEN";

export interface IndiaMarketStatus {
  status: IndiaEquitySessionStatus;
  localDate: string;
  localTime: string;
  isHoliday: boolean;
  calendarYearSupported: boolean;
}

// NSE/CMTR/71775 plus the NSE municipal-election holiday notification for 2026.
// Circular: https://nsearchives.nseindia.com/content/circulars/CMTR71775.pdf
export const NSE_2026_HOLIDAYS = [
  "2026-01-15",
  "2026-01-26",
  "2026-03-03",
  "2026-03-26",
  "2026-03-31",
  "2026-04-03",
  "2026-04-14",
  "2026-05-01",
  "2026-05-27",
  "2026-06-26",
  "2026-09-14",
  "2026-10-02",
  "2026-10-20",
  "2026-11-08",
  "2026-11-24",
  "2026-12-25",
] as const;

const nseHolidaySet: ReadonlySet<string> = new Set(NSE_2026_HOLIDAYS);

function indiaDateParts(date: Date): {
  year: string;
  month: string;
  day: string;
  weekday: string;
  hour: number;
  minute: number;
} {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  const hour = Number(values.get("hour"));
  const minute = Number(values.get("minute"));

  if (
    !values.get("year") ||
    !values.get("month") ||
    !values.get("day") ||
    !values.get("weekday") ||
    !Number.isInteger(hour) ||
    !Number.isInteger(minute)
  ) {
    throw new RangeError("Could not resolve the date in the India time zone.");
  }

  return {
    year: values.get("year")!,
    month: values.get("month")!,
    day: values.get("day")!,
    weekday: values.get("weekday")!,
    hour,
    minute,
  };
}

export function getIndiaMarketStatus(date: Date = new Date()): IndiaMarketStatus {
  if (Number.isNaN(date.valueOf())) {
    throw new RangeError("A valid date is required to determine market status.");
  }

  const parts = indiaDateParts(date);
  const localDate = `${parts.year}-${parts.month}-${parts.day}`;
  const localTime = `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
  const isHoliday =
    nseHolidaySet.has(localDate) || parts.weekday === "Sat" || parts.weekday === "Sun";
  const calendarYearSupported = parts.year === "2026";

  if (isHoliday) {
    return {
      status: "CLOSED",
      localDate,
      localTime,
      isHoliday: true,
      calendarYearSupported,
    };
  }

  const minutesSinceMidnight = parts.hour * 60 + parts.minute;
  if (minutesSinceMidnight >= 9 * 60 && minutesSinceMidnight < 9 * 60 + 15) {
    return {
      status: calendarYearSupported ? "PRE_OPEN" : "UNKNOWN",
      localDate,
      localTime,
      isHoliday: false,
      calendarYearSupported,
    };
  }
  if (minutesSinceMidnight >= 9 * 60 + 15 && minutesSinceMidnight < 15 * 60 + 30) {
    return {
      status: calendarYearSupported ? "OPEN" : "UNKNOWN",
      localDate,
      localTime,
      isHoliday: false,
      calendarYearSupported,
    };
  }
  return {
    status: "CLOSED",
    localDate,
    localTime,
    isHoliday: false,
    calendarYearSupported,
  };
}

export function compactNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value ?? 0);
}

export function percent(value: number): string {
  return `${Math.round(value)}%`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function normalizeDateKey(value: string): string {
  return value.slice(0, 10);
}

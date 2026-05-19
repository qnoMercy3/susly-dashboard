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

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear());

  return `${day}.${month}.${year}`;
}

export function normalizeDateKey(value: string): string {
  return value.slice(0, 10);
}

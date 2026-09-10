export type QuickBooksCustomer = {
  Id: string;
  DisplayName: string;
  PrimaryEmailAddr?: { Address?: string };
};

const BACKSLASH = String.fromCharCode(92);
const QUOTE = String.fromCharCode(39);

export function escapeQboQueryValue(value: string): string {
  return value
    .split(BACKSLASH)
    .join(BACKSLASH + BACKSLASH)
    .split(QUOTE)
    .join(BACKSLASH + QUOTE);
}

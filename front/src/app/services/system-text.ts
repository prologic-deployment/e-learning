/** Presentation-only cleanup for system messages from older stored notifications. */
export function plainSystemText(value: unknown): string {
  return typeof value === 'string'
    ? value.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '').trim()
    : '';
}

export const accentPalettes = [
  { value: 'amber', title: 'Amber' },
  { value: 'blue', title: 'Blue' },
  { value: 'teal', title: 'Teal' },
  { value: 'mint', title: 'Mint' },
  { value: 'lavender', title: 'Lavender' },
  { value: 'rose', title: 'Rose' },
] as const;

export function resolveAccent(value: unknown): string {
  return accentPalettes.find(palette => palette.value === value)?.value ?? 'amber';
}

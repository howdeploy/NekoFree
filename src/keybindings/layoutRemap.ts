/**
 * Map a single Cyrillic character from the standard Russian ЙЦУКЕН layout
 * to the physical QWERTY US key it sits on. Returns the input unchanged
 * for anything outside the mapping.
 *
 * Used only for keybinding matching — it lets shortcuts like ctrl+v fire
 * when the OS layout is Russian and the app receives ctrl+м. Text input
 * into the prompt goes through a separate path and keeps the original
 * character.
 */
const CYRILLIC_TO_QWERTY: Record<string, string> = {
  'й': 'q', 'ц': 'w', 'у': 'e', 'к': 'r', 'е': 't', 'н': 'y', 'г': 'u',
  'ш': 'i', 'щ': 'o', 'з': 'p', 'х': '[', 'ъ': ']',
  'ф': 'a', 'ы': 's', 'в': 'd', 'а': 'f', 'п': 'g', 'р': 'h', 'о': 'j',
  'л': 'k', 'д': 'l', 'ж': ';', 'э': "'",
  'я': 'z', 'ч': 'x', 'с': 'c', 'м': 'v', 'и': 'b', 'т': 'n', 'ь': 'm',
  'б': ',', 'ю': '.',
  'ё': '`',
}

export function remapLayoutChar(input: string): string {
  if (input.length !== 1) return input
  const lower = input.toLowerCase()
  const mapped = CYRILLIC_TO_QWERTY[lower]
  return mapped ?? input
}

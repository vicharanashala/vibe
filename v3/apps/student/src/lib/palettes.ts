/**
 * The selectable themes. Colours themselves live in styles.css (one block per
 * palette, light and dark); this is the list the pickers show, plus the colours
 * the generated course covers and avatars use.
 */
export const PALETTES = [
  {
    id: 'coral',
    name: 'Coral',
    description: 'Warm cream with a coral accent',
    swatches: ['#fffbf1', '#fff2d0', '#ffb2b2', '#e36a6a'],
    art: ['#9e3f3f', '#e36a6a', '#ffb2b2', '#f2c46d', '#fff2d0'],
  },
  {
    id: 'ocean',
    name: 'Ocean',
    description: 'Calm blues, crisp and familiar',
    swatches: ['#f9f7f7', '#dbe2ef', '#3f72af', '#112d4e'],
    art: ['#112d4e', '#3f72af', '#6c9bd8', '#dbe2ef', '#f9f7f7'],
  },
  {
    id: 'sage',
    name: 'Sage',
    description: 'Soft greens, easy on the eyes',
    swatches: ['#f1f3e0', '#d2dcb6', '#a1bc98', '#778873'],
    art: ['#4e5f4a', '#778873', '#a1bc98', '#d2dcb6', '#f1f3e0'],
  },
  {
    id: 'indigo',
    name: 'Indigo',
    description: 'Bright white with a vivid indigo',
    swatches: ['#ffffff', '#e0e7ff', '#818cf8', '#4f46e5'],
    art: ['#312e81', '#4f46e5', '#8b5cf6', '#14b8a6', '#e0e7ff'],
  },
  {
    id: 'mocha',
    name: 'Mocha',
    description: 'Paper and coffee tones',
    swatches: ['#f8ede3', '#dfd3c3', '#d0b8a8', '#8d7b68'],
    art: ['#5a4636', '#8d7b68', '#d0b8a8', '#dfd3c3', '#f8ede3'],
  },
  {
    id: 'teal',
    name: 'Teal night',
    description: 'Graphite greys with a teal accent',
    swatches: ['#eeeeee', '#00adb5', '#393e46', '#222831'],
    art: ['#222831', '#393e46', '#00adb5', '#7fd6da', '#eeeeee'],
  },
] as const;

export type PaletteId = (typeof PALETTES)[number]['id'];

export const DEFAULT_PALETTE: PaletteId = 'coral';

export function isPaletteId(value: unknown): value is PaletteId {
  return PALETTES.some((p) => p.id === value);
}

export function paletteById(id: PaletteId) {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0];
}

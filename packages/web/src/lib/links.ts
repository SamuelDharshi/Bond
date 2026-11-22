/** Public project links shown in the BCH BLAZE banner and the deck. Environment values override them. */
const clean = (v: string | undefined) => v?.trim() || undefined;

const SITE = clean(import.meta.env.VITE_SITE_URL) ?? 'https://bond.luffyy.tech';

export const LINKS = {
  site: SITE,
  /** The short presentation (an animated deck page on this site). */
  presentation: clean(import.meta.env.VITE_BLAZE_PRESENTATION_URL) ?? `${SITE}/deck`,
  source: clean(import.meta.env.VITE_BLAZE_SOURCE_URL) ?? 'https://github.com/SamuelDharshi/Bond',
  /** The demo video. */
  video: clean(import.meta.env.VITE_BLAZE_VIDEO_URL) ?? 'https://youtu.be/y4FgGXowskw',
  /** Token-aware cashaddr that receives EMBER2026 community-choice votes. */
  ember: clean(import.meta.env.VITE_BLAZE_EMBER_ADDRESS) ?? 'bitcoincash:zz5cymmtgzxttwhqmf3a0zh0q47ng8897c9zu4ntxw',
} as const;

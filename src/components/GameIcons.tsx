/**
 * Game-style icons, filled and chunky like Duolingo's: the pink energy battery, the blue gem, the
 * orange flame, the gold chest, and the white glyphs drawn on the round lesson nodes.
 */
type P = { size?: number; className?: string };

export const Energy = ({ size = 26, className }: P) => (
  <svg width={size * 1.3} height={size} viewBox="0 0 34 26" className={className} aria-hidden="true">
    <rect x="1.5" y="2" width="27" height="22" rx="6" fill="#ff7ad9" stroke="#e05bbd" strokeWidth="2.5" />
    <rect x="29.5" y="9" width="3.5" height="8" rx="1.6" fill="#e05bbd" />
    <path d="M4 7c4-3 10-3 12-2" stroke="#ffc2ef" strokeWidth="2.6" strokeLinecap="round" fill="none" />
    <path d="M17.5 5 10 14.5h5.5L13.5 21 21 11.5h-5.5z" fill="#fff" />
  </svg>
);

export const Gem = ({ size = 26, className }: P) => (
  <svg width={size} height={size} viewBox="0 0 26 26" className={className} aria-hidden="true">
    <path d="M13 1.5 23.5 7.5v11L13 24.5 2.5 18.5v-11z" fill="#1cb0f6" />
    <path d="M13 1.5 23.5 7.5 13 13.5 2.5 7.5z" fill="#84d8ff" />
    <path d="M13 13.5v11l10.5-6v-11z" fill="#1899d6" />
    <path d="M6 7.6 13 3.6" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".8" />
  </svg>
);

export const Flame = ({ size = 26, className, lit = true }: P & { lit?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 26 26" className={className} aria-hidden="true">
    <path d="M13 1.5c1 4.5 7.5 7 7.5 13.5a7.5 7.5 0 0 1-15 0c0-3.5 2-5.5 3.5-7 .3 2 1.3 3.2 2.6 3.7C11 8.5 11.8 4.5 13 1.5z" fill={lit ? '#ff9600' : '#e5e5e5'} />
    <path d="M13 12.5c.6 2.3 3.8 3.4 3.8 6.5a3.8 3.8 0 0 1-7.6 0c0-2.2 1.6-3.2 2.4-4 .2 1 .7 1.5 1.2 1.7-.2-1.5 0-2.8.2-4.2z" fill={lit ? '#ffc800' : '#cecece'} />
  </svg>
);

export const Chest = ({ size = 72, open = false, className }: P & { open?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 72 72" className={className} aria-hidden="true">
    <ellipse cx="36" cy="66" rx="26" ry="4" fill="#000" opacity=".08" />
    {open ? (
      <>
        <path d="M10 22h52l-4-14H14z" fill="#ffc800" stroke="#e5a800" strokeWidth="3" strokeLinejoin="round" />
        <rect x="10" y="30" width="52" height="32" rx="4" fill="#a8641c" />
        <rect x="14" y="30" width="44" height="10" fill="#7a4512" />
      </>
    ) : (
      <>
        <path d="M10 30c0-11 7-18 26-18s26 7 26 18z" fill="#ffc800" stroke="#e5a800" strokeWidth="3" strokeLinejoin="round" />
        <rect x="10" y="30" width="52" height="32" rx="4" fill="#ffc800" stroke="#e5a800" strokeWidth="3" />
      </>
    )}
    <rect x="8" y="28" width="56" height="8" rx="3" fill="#ffd94a" stroke="#e5a800" strokeWidth="3" />
    <rect x="16" y="36" width="5" height="26" fill="#e5a800" />
    <rect x="51" y="36" width="5" height="26" fill="#e5a800" />
    <rect x="29" y="31" width="14" height="14" rx="3" fill="#fff4c2" stroke="#e5a800" strokeWidth="2.5" />
    <circle cx="36" cy="37" r="2.4" fill="#a8641c" />
    <rect x="35" y="38" width="2" height="4" fill="#a8641c" />
  </svg>
);

/* White glyphs for the lesson nodes (drawn at 36px on a 72px disc). */
const G = ({ children, size = 34 }: { children: React.ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="#fff" aria-hidden="true">{children}</svg>
);
export const GlyphStar = () => <G><path d="m18 3 4.6 9.5 10.4 1.4-7.6 7.2 1.9 10.3L18 26.5l-9.3 4.9 1.9-10.3L3 13.9l10.4-1.4z" /></G>;
export const GlyphBook = () => <G><path d="M4 7c4.5-1.5 9-1 12.5 1.5V30C13 27.5 8.5 27 4 28.5zM32 7c-4.5-1.5-9-1-12.5 1.5V30c3.5-2.5 8-3 12.5-1.5z" /></G>;
export const GlyphHeadphones = () => <G><path d="M6 21v-3a12 12 0 0 1 24 0v3h-3v-3a9 9 0 0 0-18 0v3z" /><rect x="4" y="19" width="8" height="12" rx="3.5" /><rect x="24" y="19" width="8" height="12" rx="3.5" /></G>;
export const GlyphDumbbell = () => <G><rect x="3" y="12" width="5" height="12" rx="2" /><rect x="8" y="9" width="5" height="18" rx="2" /><rect x="13" y="16" width="10" height="4" /><rect x="23" y="9" width="5" height="18" rx="2" /><rect x="28" y="12" width="5" height="12" rx="2" /></G>;
export const GlyphTrophy = () => <G><path d="M10 4h16v9a8 8 0 0 1-16 0z" /><path d="M10 7H5v3a6 6 0 0 0 6 6M26 7h5v3a6 6 0 0 1-6 6" fill="none" stroke="#fff" strokeWidth="3" /><rect x="16" y="20" width="4" height="6" /><rect x="11" y="26" width="14" height="5" rx="2" /></G>;
export const GlyphNote = () => <G><path d="M14 6l16-3v18.5a5 5 0 1 1-3-4.6V9.5l-10 2V25a5 5 0 1 1-3-4.6z" /></G>;
export const GlyphHand = () => <G><path d="M11 17V8a2.2 2.2 0 0 1 4.4 0v7.5V5.5a2.2 2.2 0 0 1 4.4 0v10V7.5a2.2 2.2 0 0 1 4.4 0v10.5-6a2.2 2.2 0 0 1 4.4 0V21a11 11 0 0 1-11 11h-1a9 9 0 0 1-7.4-3.9L5 22.5a2.3 2.3 0 0 1 3.6-2.8z" /></G>;
export const GlyphKeys = () => <G><rect x="3" y="7" width="30" height="22" rx="3" /><g fill="#000" opacity=".2"><rect x="9" y="7" width="3.5" height="12" /><rect x="16.2" y="7" width="3.5" height="12" /><rect x="23.5" y="7" width="3.5" height="12" /></g><path d="M10.5 19v10M18 19v10M25.5 19v10" stroke="#000" strokeOpacity=".2" strokeWidth="1.2" /></G>;
export const GlyphLock = () => <G><rect x="7" y="16" width="22" height="16" rx="4" /><path d="M11.5 16v-4a6.5 6.5 0 0 1 13 0v4" fill="none" stroke="#fff" strokeWidth="3.5" /></G>;
export const GlyphCrown = () => <G><path d="M4 11l7 6 7-11 7 11 7-6-3 18H7z" /></G>;

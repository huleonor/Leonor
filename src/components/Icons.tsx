import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

const base = ({ size = 18, ...rest }: P) => ({
  width: size, height: size, viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, ...rest,
});

export const IconBack = (p: P) => <svg {...base(p)}><path d="M12.5 4 6.5 10l6 6" /></svg>;
export const IconPlay = (p: P) => <svg {...base(p)}><path d="M6 3.8v12.4L16 10z" fill="currentColor" /></svg>;
export const IconPause = (p: P) => <svg {...base(p)}><path d="M6.5 4v12M13.5 4v12" strokeWidth={2.6} /></svg>;
export const IconRestart = (p: P) => <svg {...base(p)}><path d="M4 10a6 6 0 1 0 1.8-4.3" /><path d="M4 3.5v3.2h3.2" /></svg>;
export const IconBack5 = (p: P) => <svg {...base(p)}><path d="M9.5 5 4.5 10l5 5M15.5 5l-5 5 5 5" /></svg>;
export const IconGear = (p: P) => (
  <svg {...base(p)}>
    <circle cx="10" cy="10" r="2.6" />
    <path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4" />
  </svg>
);
export const IconMic = (p: P) => <svg {...base(p)}><rect x="7.2" y="2.5" width="5.6" height="9.5" rx="2.8" /><path d="M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v2.5" /></svg>;
export const IconBluetooth = (p: P) => <svg {...base(p)}><path d="m5.5 6.5 9 7-4.5 4v-15l4.5 4-9 7" /></svg>;
export const IconKeys = (p: P) => (
  <svg {...base(p)}>
    <rect x="2.5" y="4.5" width="15" height="11" rx="1.5" />
    <path d="M6.2 4.5v6.5M10 4.5v6.5M13.8 4.5v6.5M4.4 15.5v-4.5M8.1 15.5v-4.5M11.9 15.5v-4.5M15.6 15.5v-4.5" strokeWidth={1.3} />
  </svg>
);
export const IconImport = (p: P) => <svg {...base(p)}><path d="M10 3v9.5M6 8.5l4 4 4-4M3.5 13.5v3h13v-3" /></svg>;
export const IconTrash = (p: P) => <svg {...base(p)}><path d="M4 6h12M8 6V4h4v2M5.5 6l.8 10.5h7.4L14.5 6" /></svg>;
export const IconClose = (p: P) => <svg {...base(p)}><path d="m5 5 10 10M15 5 5 15" /></svg>;
export const IconFalling = (p: P) => (
  <svg {...base(p)}>
    <rect x="4" y="2.5" width="3.4" height="7" rx="1" fill="currentColor" stroke="none" />
    <rect x="12.4" y="5.5" width="3.4" height="5" rx="1" fill="currentColor" stroke="none" />
    <path d="M2.5 13.5h15M2.5 17.5h15M7 13.5v4M10 13.5v4M13 13.5v4" strokeWidth={1.3} />
  </svg>
);
export const IconSheet = (p: P) => (
  <svg {...base(p)}>
    <path d="M2.5 5.5h15M2.5 8.5h15M2.5 11.5h15M2.5 14.5h15" strokeWidth={1.1} />
    <ellipse cx="7" cy="13" rx="2" ry="1.5" fill="currentColor" stroke="none" transform="rotate(-20 7 13)" />
    <path d="M8.8 12.6V4.5" />
    <ellipse cx="13.5" cy="10" rx="2" ry="1.5" fill="currentColor" stroke="none" transform="rotate(-20 13.5 10)" />
    <path d="M15.3 9.6V2.8" />
  </svg>
);
export const IconHeadphones = (p: P) => <svg {...base(p)}><path d="M3.5 13v-2.5a6.5 6.5 0 0 1 13 0V13" /><rect x="3" y="12" width="3.5" height="5" rx="1.2" /><rect x="13.5" y="12" width="3.5" height="5" rx="1.2" /></svg>;

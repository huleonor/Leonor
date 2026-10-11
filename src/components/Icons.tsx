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
export const IconLock = (p: P) => <svg {...base(p)}><rect x="4.5" y="9" width="11" height="8" rx="1.8" /><path d="M7 9V6.5a3 3 0 0 1 6 0V9" /></svg>;
export const IconStar = (p: P) => <svg {...base(p)}><path d="m10 2.8 2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L2.8 8.1l5-.7z" fill="currentColor" /></svg>;
export const IconHome = (p: P) => <svg {...base(p)}><path d="M3.5 9 10 3.5 16.5 9v7.5h-4.3v-4.5H7.8v4.5H3.5z" /></svg>;
export const IconMusic = (p: P) => <svg {...base(p)}><path d="M7.5 15V4.5l9-1.8V13" /><circle cx="5.5" cy="15" r="2" /><circle cx="14.5" cy="13" r="2" /></svg>;
export const IconChart = (p: P) => <svg {...base(p)}><path d="M3.5 16.5h13M5.5 13.5v-3M9 13.5V6M12.5 13.5V9M16 13.5V4" strokeWidth={2} /></svg>;
export const IconFlame = (p: P) => (
  <svg {...base(p)}>
    <path d="M10 2.5c.6 2.7 4.8 4.5 4.8 9a4.8 4.8 0 0 1-9.6 0c0-2.2 1.2-3.6 2.3-4.6.3 1.3 1 2.1 1.9 2.4C8.7 7 9.2 4.6 10 2.5z" fill="currentColor" stroke="none" />
  </svg>
);
export const IconPlus = (p: P) => <svg {...base(p)}><path d="M10 4v12M4 10h12" strokeWidth={2.2} /></svg>;
export const IconCheck = (p: P) => <svg {...base(p)}><path d="m4.5 10.5 3.5 3.5 7.5-8" strokeWidth={2.2} /></svg>;
export const IconMore = (p: P) => <svg {...base(p)}><circle cx="4.5" cy="10" r="1.4" fill="currentColor" stroke="none" /><circle cx="10" cy="10" r="1.4" fill="currentColor" stroke="none" /><circle cx="15.5" cy="10" r="1.4" fill="currentColor" stroke="none" /></svg>;
export const IconEdit = (p: P) => <svg {...base(p)}><path d="M12.8 3.8 16.2 7.2 7.5 15.9H4.1v-3.4z" /></svg>;
export const IconHand = (p: P) => <svg {...base(p)}><path d="M6.5 10.5V5.2a1.2 1.2 0 0 1 2.4 0v4.3M8.9 9V3.8a1.2 1.2 0 0 1 2.4 0V9M11.3 9V4.6a1.2 1.2 0 0 1 2.4 0v6.6M13.7 9.5a1.2 1.2 0 0 1 2.4 0v1.8a5.7 5.7 0 0 1-5.7 5.7H9.6a5 5 0 0 1-4-2l-2-2.8a1.2 1.2 0 0 1 1.9-1.4l1 1.3" /></svg>;
export const IconSpeed = (p: P) => <svg {...base(p)}><path d="M3.5 14a6.5 6.5 0 1 1 13 0" /><path d="m10 14 3.2-4.2" strokeWidth={2} /></svg>;
export const IconSpeaker = (p: P) => <svg {...base(p)}><path d="M3.5 7.5h3l4-3.5v12l-4-3.5h-3z" /><path d="M13.5 7.2a4 4 0 0 1 0 5.6M15.8 5a7 7 0 0 1 0 10" /></svg>;
export const IconCap = (p: P) => <svg {...base(p)}><path d="m10 3.5 8 4-8 4-8-4z" /><path d="M5.5 9.3v4.2c1.2 1.4 2.8 2 4.5 2s3.3-.6 4.5-2V9.3M18 7.5v4.5" /></svg>;
export const IconNotes = (p: P) => <svg {...base(p)}><path d="M2.5 5h6M2.5 8.5h6M2.5 12h4" /><path d="M10.5 15V5.5l7-1.5v9.5" /><circle cx="8.8" cy="15.2" r="1.8" /><circle cx="15.8" cy="13.6" r="1.8" /></svg>;
export const IconFeedback = (p: P) => <svg {...base(p)}><circle cx="6.5" cy="6.5" r="3.5" /><path d="m4.9 6.6 1.2 1.2 2-2.2" /><path d="M10.5 16V8l6.5-1.5v8" /><circle cx="8.8" cy="16" r="1.7" /><circle cx="15.3" cy="14.6" r="1.7" /></svg>;
export const IconMagic = (p: P) => <svg {...base(p)}><path d="M9 3.5v13M6.5 6 9 3.5 11.5 6M6.5 14 9 16.5l2.5-2.5" /><path d="M15 3v3M13.5 4.5h3M15.5 13v2.5M14.2 14.2h2.6" /></svg>;
export const IconAutoScroll = (p: P) => <svg {...base(p)}><path d="m6.5 6 3.5-3 3.5 3M6.5 9.5 10 6.5l3.5 3M6.5 11 10 14l3.5-3M6.5 14.5 10 17.5l3.5-3" /></svg>;
export const IconExit = (p: P) => <svg {...base(p)}><path d="M11.5 4h-7v12h7" /><path d="M8.5 10h9M14.5 7l3 3-3 3" /></svg>;
export const IconChevronUp = (p: P) => <svg {...base(p)}><path d="m4.5 12.5 5.5-5.5 5.5 5.5" strokeWidth={2.4} /></svg>;
export const IconChevronDown = (p: P) => <svg {...base(p)}><path d="m4.5 7.5 5.5 5.5 5.5-5.5" strokeWidth={2.4} /></svg>;
export const IconArrowLeft = (p: P) => <svg {...base(p)}><path d="M16 10H4.5M9 5 4 10l5 5" strokeWidth={2.2} /></svg>;
export const IconArrowRight = (p: P) => <svg {...base(p)}><path d="M4 10h11.5M11 5l5 5-5 5" strokeWidth={2.2} /></svg>;
export const IconStop = (p: P) => <svg {...base(p)}><rect x="5" y="5" width="10" height="10" rx="2" fill="currentColor" /></svg>;

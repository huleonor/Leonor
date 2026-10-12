import type { ReactNode } from 'react';

/** The app's logo: the penguin with the round glasses. The only character in the app for now. */
export function Logo({ size = 40, className = '' }: { size?: number; className?: string }) {
  return <img src="/icons/logo.png" width={size} height={size} alt="Hugo's Piano" className={`logo ${className}`} draggable={false} />;
}

/** A big icon on a tinted disc, the illustration for sheets and empty states. */
export function Spot({ children, tone = 'blue', size = 96 }: { children: ReactNode; tone?: 'blue' | 'energy' | 'star' | 'flame' | 'ok'; size?: number }) {
  return <span className={`spot spot-${tone}`} style={{ width: size, height: size }} aria-hidden="true">{children}</span>;
}

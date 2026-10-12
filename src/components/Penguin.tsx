/** Pip, the app's penguin. Seven poses cut from the character sheet, each with a little life. */
export type Pose = 'wave' | 'read' | 'cheer' | 'keys' | 'wink' | 'idle' | 'grad';
export type Motion = 'bob' | 'wave' | 'jump' | 'sway' | 'pop' | 'none';

const DEFAULT_MOTION: Record<Pose, Motion> = { wave: 'wave', read: 'sway', cheer: 'jump', keys: 'bob', wink: 'sway', idle: 'bob', grad: 'jump' };

interface Props { pose: Pose; size?: number; motion?: Motion; className?: string; label?: string; }

export function Penguin({ pose, size = 120, motion, className = '', label }: Props) {
  return (
    <img
      src={`/mascot/${pose}.png`}
      width={size}
      height={size}
      alt={label ?? ''}
      aria-hidden={label ? undefined : true}
      draggable={false}
      className={`penguin m-${motion ?? DEFAULT_MOTION[pose]} ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

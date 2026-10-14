/**
 * The penguin he plays as: the app's only character, drawn from plain shapes (circles and
 * ellipses, Duolingo's geometric style) so it stays crisp at any size, from the tab bar to the
 * profile header. Colours come from the avatar tokens in styles.css.
 */
import type { Look } from '../lib/profile';

interface Props { look: Look; size?: number; /** A round coloured backdrop, for small places like the tab bar. */ framed?: boolean; className?: string; }

const f = (v: string) => ({ fill: `var(--${v})` });

export function Penguin({ look, size = 120, framed = false, className }: Props) {
  const body = f(`av-body-${look.body}`);
  return (
    <svg className={`penguin-av ${className ?? ''}`} viewBox="0 0 200 200" width={size} height={size} aria-hidden="true">
      {framed && <circle cx="100" cy="100" r="100" style={f(`av-bg-${look.bg}`)} />}
      <g className="pv-body">
        {/* Feet and flippers */}
        <ellipse cx="78" cy="186" rx="18" ry="8" style={f('flame')} />
        <ellipse cx="122" cy="186" rx="18" ry="8" style={f('flame')} />
        <ellipse cx="46" cy="134" rx="15" ry="34" transform="rotate(22 46 134)" style={body} />
        <ellipse cx="154" cy="134" rx="15" ry="34" transform="rotate(-22 154 134)" style={body} />
        {/* Body, belly, head */}
        <ellipse cx="100" cy="126" rx="58" ry="64" style={body} />
        <ellipse cx="100" cy="140" rx="40" ry="46" style={f('surface')} />
        <circle cx="100" cy="74" r="50" style={body} />
        {/* The white face, heart-shaped */}
        <circle cx="84" cy="74" r="22" style={f('surface')} />
        <circle cx="116" cy="74" r="22" style={f('surface')} />
        <ellipse cx="100" cy="88" rx="36" ry="24" style={f('surface')} />
        {/* Eyes, cheeks, beak */}
        <ellipse className="pv-eye" cx="85" cy="78" rx="9" ry="11" style={f('av-eye')} />
        <ellipse className="pv-eye" cx="115" cy="78" rx="9" ry="11" style={f('av-eye')} />
        <circle cx="88" cy="73" r="3.5" style={f('surface')} />
        <circle cx="118" cy="73" r="3.5" style={f('surface')} />
        <circle cx="70" cy="96" r="6" style={f('av-cheek')} />
        <circle cx="130" cy="96" r="6" style={f('av-cheek')} />
        <path d="M89 92 Q100 86 111 92 Q106 104 100 106 Q94 104 89 92Z" style={f('flame')} />
      </g>
      {look.extra === 'glasses' && (
        <g className="pv-extra" style={{ fill: 'none', stroke: 'var(--av-eye)', strokeWidth: 5 }}>
          <circle cx="85" cy="78" r="16" /><circle cx="115" cy="78" r="16" /><path d="M99 76 h2" />
        </g>
      )}
      {look.extra === 'headphones' && (
        <g className="pv-extra">
          <path d="M50 78 A50 50 0 0 1 150 78" style={{ fill: 'none', stroke: 'var(--go)', strokeWidth: 10, strokeLinecap: 'round' }} />
          <rect x="38" y="66" width="18" height="32" rx="9" style={f('go-edge')} />
          <rect x="144" y="66" width="18" height="32" rx="9" style={f('go-edge')} />
        </g>
      )}
      {look.extra === 'beanie' && (
        <g className="pv-extra">
          <path d="M56 50 A44 40 0 0 1 144 50 Z" style={f('flame')} />
          <rect x="52" y="44" width="96" height="14" rx="7" style={f('flame-edge')} />
          <circle cx="100" cy="12" r="10" style={f('flame')} />
        </g>
      )}
      {look.extra === 'bowtie' && (
        <g className="pv-extra">
          <path d="M100 124 L78 112 L78 136 Z" style={f('miss')} />
          <path d="M100 124 L122 112 L122 136 Z" style={f('miss')} />
          <circle cx="100" cy="124" r="6" style={f('miss-edge')} />
        </g>
      )}
      {look.extra === 'crown' && (
        <g className="pv-extra">
          <path d="M68 34 L78 10 L90 28 L100 4 L110 28 L122 10 L132 34 Z" style={f('star')} />
          <rect x="68" y="30" width="64" height="10" rx="4" style={f('star-edge')} />
        </g>
      )}
    </svg>
  );
}

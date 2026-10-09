import { memo } from 'react';
import { cn } from '@/lib/utils';

/**
 * A flat illustrated landscape standing in for a destination photo. The app has no image source,
 * so the scene is chosen deterministically from the city name: the same city always draws the
 * same picture, and no network request or stored asset is involved. Decorative only.
 */

type SceneKind = 'mountains' | 'skyline' | 'coast' | 'karst';

interface Palette {
  sky: string;
  sun: string;
  far: string;
  near: string;
  ground: string;
  water: string;
}

const PALETTES: Palette[] = [
  { sky: '#F3DCCB', sun: '#F7B28A', far: '#A9A3BF', near: '#6F6A92', ground: '#3B3A5C', water: '#5E7FA8' },
  { sky: '#D6E8F2', sun: '#FFE7A8', far: '#7DB39A', near: '#4F8B70', ground: '#2F4A63', water: '#3E8FB0' },
  { sky: '#F9E3B8', sun: '#F7B28A', far: '#D9A35A', near: '#B7792B', ground: '#8A5A12', water: '#4E8FA8' },
  { sky: '#DDEBDD', sun: '#FFE3A3', far: '#8DB5AC', near: '#4F7F72', ground: '#36615A', water: '#6FA8B8' },
  { sky: '#DCE8F3', sun: '#FFE3A3', far: '#7F95B5', near: '#4E6A8F', ground: '#2E4468', water: '#9CC3DD' },
  { sky: '#F6D9D2', sun: '#F7B28A', far: '#8E9CC0', near: '#6C7FA6', ground: '#3B4A6B', water: '#6E93BF' },
];

const KINDS: SceneKind[] = ['mountains', 'skyline', 'coast', 'karst'];

function hash(value: string) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function sceneFor(name: string): { kind: SceneKind; palette: Palette } {
  const h = hash(name.trim().toLowerCase());
  return { kind: KINDS[h % KINDS.length], palette: PALETTES[Math.floor(h / KINDS.length) % PALETTES.length] };
}

function SceneBody({ kind, p }: { kind: SceneKind; p: Palette }) {
  switch (kind) {
    case 'mountains':
      return (
        <>
          <path d="M0 92 46 46 76 70 120 28 162 74 196 54 240 86V150H0z" fill={p.far} />
          <path d="M120 28 131 40 125 39 120 44 114 39 108 41z" fill="#FFFFFF" />
          <path d="M0 112 60 82 110 104 170 80 240 104V150H0z" fill={p.near} />
          <rect y="136" width="240" height="14" fill={p.water} />
        </>
      );
    case 'skyline':
      return (
        <>
          <path d="M0 96 34 72 62 88 100 60 140 90 176 70 240 92V150H0z" fill={p.far} />
          <path d="M58 118Q96 82 134 118z" fill={p.near} />
          <path d="M96 92V64" stroke={p.ground} strokeWidth="2.5" />
          <rect x="91" y="66" width="10" height="5" rx="2" fill={p.ground} />
          <path d="M0 150v-30h14v-12h12v8h10v-16h14v18h10v-6h16v38zM150 150v-34h12v-14h14v10h12v-18h16v24h10v-10h14v42z" fill={p.ground} />
          <rect y="140" width="240" height="10" fill={p.water} />
        </>
      );
    case 'coast':
      return (
        <>
          <path d="M0 104 50 80 96 96 150 72 240 98V150H0z" fill={p.far} />
          <rect y="112" width="240" height="38" fill={p.water} />
          <path d="M24 128h46M120 138h60M186 124h34" stroke="#FFFFFF" strokeOpacity="0.45" strokeWidth="3" strokeLinecap="round" />
          <path d="M150 120h34l-6 8h-22z" fill={p.ground} />
          <path d="M166 120v-18" stroke={p.ground} strokeWidth="2" />
          <path d="M168 104l12 14h-12z" fill="#FFFFFF" />
        </>
      );
    case 'karst':
    default:
      return (
        <>
          <path d="M108 120c0-34 10-52 24-52s22 26 22 52zM176 120c0-30 10-46 22-46s18 22 18 46z" fill={p.far} />
          <path d="M10 124C10 76 26 40 46 40s28 46 28 84zM70 124c0-26 8-40 18-40s14 18 14 40z" fill={p.near} />
          <rect y="118" width="240" height="32" fill={p.water} />
          <path d="M120 128h30l-5 7h-20z" fill={p.ground} />
        </>
      );
  }
}

export const DestinationScene = memo(function DestinationScene({ name, className }: { name: string; className?: string }) {
  const { kind, palette } = sceneFor(name);
  return (
    <svg
      viewBox="0 0 240 150"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      className={cn('block h-full w-full', className)}
    >
      <rect width="240" height="150" fill={palette.sky} />
      <circle cx={kind === 'karst' ? 196 : 186} cy="40" r="17" fill={palette.sun} />
      <SceneBody kind={kind} p={palette} />
    </svg>
  );
});

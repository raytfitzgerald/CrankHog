// Sir Loin's head, in profile, facing the way he's going.
//
// Drawn round (0, 0) at radius 12, exactly like CoachHead and RiderHead, so he
// drops into anything that takes a head: the ride-along Cyclist, the riders on
// the Home velodrome, an avatar slot. That's the whole trick — he gets the
// bike, the pedalling legs and the bobbing for free.
//
// He is a brand asset, so his colours are the same in both themes (BRAND.md),
// and his outline is Night rather than `ink`: his hide and tusks are fixed, so
// an outline that flipped with the theme would vanish into the tusks at night.
//
// The layout is what keeps him readable at 24 px. The snout sits low, at mouth
// height, and is drawn behind the skull so its seam never shows. The tusks
// come up from beside it into clear air, where nothing else is — that stops
// them reading as one white smear, which is what happens whenever they cross
// the snout. The cap is a casquette: the peak reads small, and the ear can
// flop over it.

const INK = 'var(--color-night)'
const HIDE = 'var(--color-hog)'
const SHADE = 'var(--color-hog-shade)'
const TUSK = 'var(--color-tusk)'

export function HogHead({ cap = true }: { cap?: boolean }) {
  return (
    <g>
      {/* skull and snout as one silhouette: no seam to hide */}
      <path
        d="M-11 -2 C-11 -8 -7.2 -11.2 -2.4 -11.2 C1.4 -11.2 3.8 -9 4.6 -6 C5.2 -3.6 6.2 -1.8 8 -1.1 L9.6 -0.3 A3.6 3.6 0 0 1 9.6 6.3 L7.6 6.7 C6.6 8.5 4.2 9.9 -0.4 10 C-6.6 10.1 -11 6.2 -11 -2 Z"
        fill={HIDE}
        stroke={INK}
        strokeWidth={1.3}
        strokeLinejoin="round"
      />
      {/* the nose on the end of the snout */}
      <ellipse cx={10.2} cy={3} rx={1.5} ry={2.5} fill={SHADE} stroke={INK} strokeWidth={1} />
      <ellipse cx={10.5} cy={2} rx={0.42} ry={0.7} fill={INK} />
      <ellipse cx={10.5} cy={4} rx={0.42} ry={0.7} fill={INK} />
      {/* the tusks, up out of the jaw into clear air: far one, then near */}
      <path d="M4.2 6.8 L6.2 5.8 Q7.6 2.6 7.2 -1.2 Q5.4 2.6 4.2 6.8 Z" fill={TUSK} stroke={INK} strokeWidth={0.9} strokeLinejoin="round" />
      <path d="M6 6.8 L8.6 5.4 Q10.4 1.4 9.8 -3.6 Q7.2 1.2 6 6.8 Z" fill={TUSK} stroke={INK} strokeWidth={1} strokeLinejoin="round" />
      {cap && (
        <path
          d="M-11.2 -2.2 C-11.2 -9.2 -7.4 -12.4 -2.4 -12.4 C1.8 -12.4 4.8 -10 5.6 -6.4 L7.4 -6.9 L7 -4.6 L5.2 -5 L-11 -0.6 Z"
          fill="var(--color-accent)"
          stroke={INK}
          strokeWidth={1.2}
          strokeLinejoin="round"
        />
      )}
      {/* eye, small and unimpressed */}
      <circle cx={-0.4} cy={-2.6} r={1.5} fill={INK} />
      <circle cx={0.1} cy={-3.1} r={0.5} fill="var(--color-board)" />
      {/* the ear, flopping back over the cap */}
      <path d="M-5.4 -9.6 L-12.8 -11.4 Q-12.8 -4.8 -7.4 -3.6 Q-4.8 -5.2 -5.4 -9.6 Z" fill={SHADE} stroke={INK} strokeWidth={1.2} strokeLinejoin="round" />
    </g>
  )
}

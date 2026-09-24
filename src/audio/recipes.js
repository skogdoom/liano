// Sound recipes: each sound described as data, turned into Web Audio nodes by
// player.js. Times are seconds from the start of the sound.
//
// A recipe is { name, duration, voices }. A voice has
//   source:   { kind: 'osc', wave, freq, vibrato? } or { kind: 'noise' }
//   filters:  serial filters { type, freq, q }, or
//   formants: parallel band-pass filters { freq, q, gain } for vowels, freq and gain
//             envelopes
//   gain:     envelope
// An envelope (or a frequency) is a list of points { t, v, ramp }, where ramp is
// 'set', 'linear' or 'exp' (exponential ramps need values above zero).

const SILENT = 0.0001;

// Vowel formants for a small, high voice: centre frequencies in Hz and levels. The
// "ee" is bright: strong upper formants, including a fourth that is almost absent
// from the round, dark "oo".
// The two upper "ee" formants sit on the 3rd and 4th harmonics of the steady "eee"
// pitch, which is what makes it ring bright. The second stays just off the 2nd
// harmonic, which would otherwise dominate.
const EE_PITCH = 1180; // Hz, steady through the "eee"
const OO = { f1: 330, f2: 800, f3: 2400, f4: 3500, g3: 0.3, g4: 0.05 };
const EE = { f1: 290, f2: 2500, f3: 3 * EE_PITCH, f4: 4 * EE_PITCH, g3: 1.5, g4: 1.3 };
const OO_END = 0.18; // the "oo" holds until here...
const EE_START = 0.36; // ...then glides through "w" into the "ee"

// A formant frequency or level held on the "oo", then gliding to the "ee".
function glide(from, to) {
  return [
    { t: 0, v: from, ramp: 'set' },
    { t: OO_END, v: from, ramp: 'linear' },
    { t: EE_START, v: to, ramp: 'exp' },
  ];
}

// "Ooweeee": a voice starting low on "oo", sliding up through "w" into a long "eee"
// held on one pitch. (Named "wheee" in the code.)
export function wheee() {
  return {
    name: 'wheee',
    duration: 1,
    voices: [
      {
        source: {
          kind: 'osc',
          wave: 'sawtooth',
          // Rises with the glide and reaches the "ee" pitch as the vowel does, then holds.
          freq: [
            { t: 0, v: 500, ramp: 'set' },
            { t: OO_END, v: 560, ramp: 'linear' },
            { t: EE_START, v: EE_PITCH, ramp: 'exp' },
          ],
          vibrato: { rate: 6, depth: 18 },
        },
        formants: [
          { freq: glide(OO.f1, EE.f1), q: 4, gain: glide(0.6, 0.6) },
          { freq: glide(OO.f2, EE.f2), q: 8, gain: glide(1, 1) },
          { freq: glide(OO.f3, EE.f3), q: 10, gain: glide(OO.g3, EE.g3) },
          { freq: glide(OO.f4, EE.f4), q: 12, gain: glide(OO.g4, EE.g4) },
        ],
        // Quieter than the level suggests is needed: the bright "ee" sits where
        // hearing is most sensitive.
        gain: [
          { t: 0, v: SILENT, ramp: 'set' },
          { t: 0.06, v: 0.105, ramp: 'linear' },
          { t: EE_START, v: 0.13, ramp: 'linear' },
          { t: 0.72, v: 0.105, ramp: 'linear' },
          { t: 1, v: SILENT, ramp: 'exp' },
        ],
      },
    ],
  };
}

// Base pitch of the bong for each obstacle type: a deep rock, a mid branch, a
// higher thorn bush.
export const BONG_PITCH = { rock: 110, branch: 165, thornBush: 247 };
const BONG_PARTIALS = [
  { ratio: 1, level: 0.5, decay: 1.2 },
  { ratio: 2.76, level: 0.25, decay: 0.8 },
  { ratio: 5.4, level: 0.12, decay: 0.5 },
  { ratio: 8.93, level: 0.06, decay: 0.3 },
];

// "Bong": a struck bell, with inharmonic partials that die away at different rates.
export function bong(obstacleType) {
  const base = BONG_PITCH[obstacleType] ?? BONG_PITCH.rock;
  return {
    name: 'bong',
    duration: 1.2,
    voices: BONG_PARTIALS.map(({ ratio, level, decay }) => ({
      source: { kind: 'osc', wave: 'sine', freq: [{ t: 0, v: base * ratio, ramp: 'set' }] },
      gain: [
        { t: 0, v: SILENT, ramp: 'set' },
        { t: 0.005, v: level, ramp: 'linear' },
        { t: decay, v: SILENT, ramp: 'exp' },
      ],
    })),
  };
}

// "Crash": a burst of noise closing down, over a falling thud.
export function crash() {
  return {
    name: 'crash',
    duration: 0.8,
    voices: [
      {
        source: { kind: 'noise' },
        filters: [
          {
            type: 'lowpass',
            q: 0.7,
            freq: [
              { t: 0, v: 3200, ramp: 'set' },
              { t: 0.6, v: 260, ramp: 'exp' },
            ],
          },
        ],
        gain: [
          { t: 0, v: SILENT, ramp: 'set' },
          { t: 0.01, v: 0.5, ramp: 'linear' },
          { t: 0.8, v: SILENT, ramp: 'exp' },
        ],
      },
      {
        source: {
          kind: 'osc',
          wave: 'sine',
          freq: [
            { t: 0, v: 130, ramp: 'set' },
            { t: 0.4, v: 38, ramp: 'exp' },
          ],
        },
        gain: [
          { t: 0, v: SILENT, ramp: 'set' },
          { t: 0.01, v: 0.7, ramp: 'linear' },
          { t: 0.5, v: SILENT, ramp: 'exp' },
        ],
      },
    ],
  };
}

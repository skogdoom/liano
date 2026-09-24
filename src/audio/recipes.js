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

// A single sung vowel for a small, high voice: formant centre frequencies (Hz) and
// the level of the third. "ih" as in "hit", or "ee" as in "teach". A low-pass on the
// source keeps the buzz of the upper harmonics out, so it sounds soft, not harsh.
// `level` evens out loudness between the vowels.
export const WHEEE_VOWELS = {
  ih: { f1: 430, f2: 2400, f3: 3000, g3: 0.45, level: 0.85 },
  ee: { f1: 310, f2: 2700, f3: 3300, g3: 0.5, level: 1.36 },
};
export const WHEEE_VOWEL = 'ih';
const WHEEE_PITCH = 1180; // Hz, steady throughout
const SOFTEN_ABOVE = 4000; // Hz, low-pass on the source

const constant = (v) => [{ t: 0, v, ramp: 'set' }];

// "Wheee": one long vowel on a steady pitch, with a little vibrato.
export function wheee(vowel = WHEEE_VOWEL) {
  const v = WHEEE_VOWELS[vowel];
  return {
    name: 'wheee',
    duration: 0.9,
    voices: [
      {
        source: { kind: 'osc', wave: 'sawtooth', freq: constant(WHEEE_PITCH), vibrato: { rate: 6, depth: 18 } },
        filters: [{ type: 'lowpass', q: 0.7, freq: constant(SOFTEN_ABOVE) }],
        formants: [
          { freq: constant(v.f1), q: 4, gain: constant(0.6) },
          { freq: constant(v.f2), q: 7, gain: constant(1) },
          { freq: constant(v.f3), q: 9, gain: constant(v.g3) },
        ],
        gain: [
          { t: 0, v: SILENT, ramp: 'set' },
          { t: 0.05, v: 0.2 * v.level, ramp: 'linear' },
          { t: 0.62, v: 0.17 * v.level, ramp: 'linear' },
          { t: 0.9, v: SILENT, ramp: 'exp' },
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

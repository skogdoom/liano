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

// Vowel formants for a small, high voice: centre frequencies (Hz) and the level of
// the third. The "oo" is round and dark; the end vowel is either "ee" (as in "see")
// or the rounder, warmer "ih" (as in "hit"). A low-pass on the source keeps the
// buzz of the upper harmonics out, so the voice sounds happy rather than harsh.
const OO = { f1: 330, f2: 800, f3: 2400, g3: 0.25 };
// `level` evens out loudness: the "ih" formants fall between the few harmonics of so
// high a voice, so it needs more gain to sound as loud.
export const END_VOWELS = {
  ee: { f1: 290, f2: 2300, f3: 3000, g3: 0.5, level: 1 },
  ih: { f1: 430, f2: 2000, f3: 2600, g3: 0.45, level: 2.3 },
};
export const WHEEE_VOWEL = 'ee';
const EE_PITCH = 1180; // Hz, steady through the end vowel
const SOFTEN_ABOVE = 4000; // Hz, low-pass on the source
const OO_END = 0.18; // the "oo" holds until here...
const EE_START = 0.36; // ...then glides through "w" into the end vowel

// A formant frequency or level held on the "oo", then gliding to the end vowel.
function glide(from, to) {
  return [
    { t: 0, v: from, ramp: 'set' },
    { t: OO_END, v: from, ramp: 'linear' },
    { t: EE_START, v: to, ramp: 'exp' },
  ];
}

// "Ooweeee": a voice starting low on "oo", sliding up through "w" into a long "eee"
// (or "iii") held on one pitch. (Named "wheee" in the code.)
export function wheee(vowel = WHEEE_VOWEL) {
  const end = END_VOWELS[vowel];
  return {
    name: 'wheee',
    duration: 1,
    voices: [
      {
        source: {
          kind: 'osc',
          wave: 'sawtooth',
          // Rises with the glide and reaches the end pitch as the vowel does, then holds.
          freq: [
            { t: 0, v: 500, ramp: 'set' },
            { t: OO_END, v: 560, ramp: 'linear' },
            { t: EE_START, v: EE_PITCH, ramp: 'exp' },
          ],
          vibrato: { rate: 6, depth: 18 },
        },
        filters: [{ type: 'lowpass', q: 0.7, freq: [{ t: 0, v: SOFTEN_ABOVE, ramp: 'set' }] }],
        formants: [
          { freq: glide(OO.f1, end.f1), q: 4, gain: glide(0.6, 0.6) },
          { freq: glide(OO.f2, end.f2), q: 7, gain: glide(1, 1) },
          { freq: glide(OO.f3, end.f3), q: 9, gain: glide(OO.g3, end.g3) },
        ],
        gain: [
          { t: 0, v: SILENT, ramp: 'set' },
          { t: 0.06, v: 0.16, ramp: 'linear' },
          { t: EE_START, v: 0.2 * end.level, ramp: 'linear' },
          { t: 0.72, v: 0.16 * end.level, ramp: 'linear' },
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

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

// Sung vowels: formant centre frequencies (Hz) and the levels of the second and
// third formants. "ih" as in "hit", "ee" as in "teach", "oo" as in "food" and "aa"
// as in "father". A wide "body" band on the pitch itself gives the voice warmth,
// and a low-pass keeps the buzz of the upper harmonics out.
const VOWELS = {
  ih: { f1: 430, f2: 2400, f3: 3000, g2: 0.5, g3: 0.15 },
  ee: { f1: 310, f2: 2700, f3: 3300, g2: 0.5, g3: 0.15 },
  oo: { f1: 330, f2: 800, f3: 2400, g2: 0.5, g3: 0.05 },
  // At an 800 Hz pitch there are few harmonics to shape, so, as high singers do, the
  // "aa" formants sit on the 2nd and 3rd harmonics (1600, 2400 Hz) instead of their
  // speaking values (about 1220 and 2800 Hz). That is what tells it apart from "oo".
  aa: { f1: 850, f2: 1600, f3: 2400, g2: 2.4, g3: 0.8 },
};

// The wheee variants: the vowels sung in turn, each held and then gliding into the
// next, and a level that evens out loudness between the variants.
export const WHEEE_VARIANTS = {
  ih: { vowels: ['ih'], level: 0.56 },
  ee: { vowels: ['ee'], level: 0.59 },
  ooaa: { vowels: ['oo', 'aa', 'oo', 'aa'], level: 0.35 },
};
export const WHEEE_VOWEL = 'ih';
const WHEEE_PITCH = 800; // Hz, steady throughout
const WHEEE_DURATION = 0.9;
const VOWEL_GLIDE = 0.1; // s, from one vowel into the next
const SOFTEN_ABOVE = 3000; // Hz, low-pass on the source

const constant = (v) => [{ t: 0, v, ramp: 'set' }];

// One formant property over a vowel sequence: each vowel gets an equal share of
// the duration, holding and then gliding into the next one.
function vowelEnvelope(vowels, key) {
  const share = WHEEE_DURATION / vowels.length;
  const env = constant(VOWELS[vowels[0]][key]);
  for (let i = 1; i < vowels.length; i++) {
    env.push({ t: i * share - VOWEL_GLIDE, v: VOWELS[vowels[i - 1]][key], ramp: 'linear' });
    env.push({ t: i * share, v: VOWELS[vowels[i]][key], ramp: 'exp' });
  }
  return env;
}

// "Wheee": sung vowels on a steady pitch, with a slow vibrato.
export function wheee(variant = WHEEE_VOWEL) {
  const { vowels, level } = WHEEE_VARIANTS[variant];
  const formant = (key) => vowelEnvelope(vowels, key);
  return {
    name: 'wheee',
    duration: WHEEE_DURATION,
    voices: [
      {
        // A slow vibrato, about ±1.5% of the pitch.
        source: { kind: 'osc', wave: 'sawtooth', freq: constant(WHEEE_PITCH), vibrato: { rate: 4, depth: 12 } },
        filters: [{ type: 'lowpass', q: 0.7, freq: constant(SOFTEN_ABOVE) }],
        formants: [
          { freq: constant(WHEEE_PITCH), q: 1, gain: constant(1) }, // body
          { freq: formant('f1'), q: 4, gain: constant(0.6) },
          { freq: formant('f2'), q: 7, gain: formant('g2') },
          { freq: formant('f3'), q: 9, gain: formant('g3') },
        ],
        gain: [
          { t: 0, v: SILENT, ramp: 'set' },
          { t: 0.05, v: 0.2 * level, ramp: 'linear' },
          { t: 0.62, v: 0.17 * level, ramp: 'linear' },
          { t: WHEEE_DURATION, v: SILENT, ramp: 'exp' },
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

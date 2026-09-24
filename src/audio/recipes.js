// Sound recipes: each sound described as data, turned into Web Audio nodes by
// player.js. Times are seconds from the start of the sound.
//
// A recipe is { name, duration, voices }. A voice has
//   source:   { kind: 'osc', wave, freq, vibrato? } or { kind: 'noise' }
//   filters:  serial filters { type, freq, q }, or
//   formants: parallel band-pass filters { freq, q, gain } for vowels, freq an envelope
//   gain:     envelope
// An envelope (or a frequency) is a list of points { t, v, ramp }, where ramp is
// 'set', 'linear' or 'exp' (exponential ramps need values above zero).

const SILENT = 0.0001;

// Vowel formants (centre frequencies in Hz) for a small, high voice.
const OO = { f1: 330, f2: 800, f3: 2400 };
const EE = { f1: 290, f2: 2300, f3: 3000 };
const OO_END = 0.18; // the "oo" holds until here...
const EE_START = 0.36; // ...then glides through "w" into the "ee"

// A formant held on the "oo", then gliding to the "ee".
function glide(from, to) {
  return [
    { t: 0, v: from, ramp: 'set' },
    { t: OO_END, v: from, ramp: 'linear' },
    { t: EE_START, v: to, ramp: 'exp' },
  ];
}

// "Ooweeee": a voice starting low on "oo", sliding up through "w" into a long "eee"
// that slowly falls back. (Named "wheee" in the code.)
export function wheee() {
  return {
    name: 'wheee',
    duration: 1,
    voices: [
      {
        source: {
          kind: 'osc',
          wave: 'sawtooth',
          freq: [
            { t: 0, v: 380, ramp: 'set' },
            { t: OO_END, v: 430, ramp: 'linear' },
            { t: 0.42, v: 900, ramp: 'exp' },
            { t: 0.95, v: 640, ramp: 'exp' },
          ],
          vibrato: { rate: 6, depth: 14 },
        },
        formants: [
          { freq: glide(OO.f1, EE.f1), q: 4, gain: 0.6 },
          { freq: glide(OO.f2, EE.f2), q: 8, gain: 1 },
          { freq: glide(OO.f3, EE.f3), q: 10, gain: 0.4 },
        ],
        gain: [
          { t: 0, v: SILENT, ramp: 'set' },
          { t: 0.06, v: 0.4, ramp: 'linear' },
          { t: EE_START, v: 0.6, ramp: 'linear' },
          { t: 0.72, v: 0.5, ramp: 'linear' },
          { t: 1, v: SILENT, ramp: 'exp' },
        ],
      },
    ],
  };
}

// "Swish": a short burst of air, band-passed and sweeping up.
export function swish() {
  return {
    name: 'swish',
    duration: 0.3,
    voices: [
      {
        source: { kind: 'noise' },
        filters: [
          {
            type: 'bandpass',
            q: 1.4,
            freq: [
              { t: 0, v: 450, ramp: 'set' },
              { t: 0.26, v: 2400, ramp: 'exp' },
            ],
          },
        ],
        gain: [
          { t: 0, v: SILENT, ramp: 'set' },
          // Band-passed noise is quiet; this lands it a little under the other sounds.
          { t: 0.09, v: 0.7, ramp: 'linear' },
          { t: 0.3, v: SILENT, ramp: 'exp' },
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

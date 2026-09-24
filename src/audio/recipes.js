// Sound recipes: each sound described as data, turned into Web Audio nodes by
// player.js. Times are seconds from the start of the sound.
//
// A recipe is { name, duration, voices }. A voice has
//   source:   { kind: 'osc', wave, freq, vibrato? } or { kind: 'noise' }
//   filters:  serial filters { type, freq, q }, or
//   formants: parallel band-pass filters { freq, q, gain } (for the vowel)
//   gain:     envelope
// An envelope (or a frequency) is a list of points { t, v, ramp }, where ramp is
// 'set', 'linear' or 'exp' (exponential ramps need values above zero).

const SILENT = 0.0001;

// "Wheee": a voice sliding up and back down through an "ee" vowel.
export function wheee() {
  return {
    name: 'wheee',
    duration: 0.75,
    voices: [
      {
        source: {
          kind: 'osc',
          wave: 'sawtooth',
          freq: [
            { t: 0, v: 520, ramp: 'set' },
            { t: 0.28, v: 900, ramp: 'exp' },
            { t: 0.72, v: 620, ramp: 'exp' },
          ],
          vibrato: { rate: 6.5, depth: 14 },
        },
        // "ee": low first formant, high second and third.
        formants: [
          { freq: 300, q: 4, gain: 0.5 },
          { freq: 2300, q: 9, gain: 1 },
          { freq: 3000, q: 10, gain: 0.5 },
        ],
        gain: [
          { t: 0, v: SILENT, ramp: 'set' },
          { t: 0.04, v: 0.55, ramp: 'linear' },
          { t: 0.5, v: 0.45, ramp: 'linear' },
          { t: 0.75, v: SILENT, ramp: 'exp' },
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

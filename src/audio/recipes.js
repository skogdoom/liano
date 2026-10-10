// Sound recipes: each sound described as data, turned into Web Audio nodes by
// player.js. Times are seconds from the start of the sound.
//
// A recipe is { name, duration, voices }. A voice has
//   source:   { kind: 'osc', wave, freq } or { kind: 'noise' }
//   filters:  serial filters { type, freq, q }
//   gain:     envelope
// An envelope (or a frequency) is a list of points { t, v, ramp }, where ramp is
// 'set', 'linear' or 'exp' (exponential ramps need values above zero).

const SILENT = 0.0001;

// Base pitch of the bong for each obstacle type: a deep rock (and, deeper, a temple), a
// mid branch, a beehive,
// a higher thorn bush; among the moving ones a low snake, a higher spider, a purple
// bird, a blue bird, a bird and the highest, the bat.
export const BONG_PITCH = {
  temple: 98,
  rock: 110,
  snake: 131,
  branch: 165,
  beehive: 196,
  thornBush: 247,
  spider: 294,
  purpleBird: 311,
  circleBat: 277,
  blueBird: 349,
  bird: 392,
  bat: 466,
};
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

// "Pling": a banana taken. Two quick, soft bell notes a fifth apart (E6, then B6), each
// with a faint octave above, fading in about half a second. Quieter than the deaths.
export const PLING_NOTES = [
  { at: 0, freq: 1319 },
  { at: 0.08, freq: 1976 },
];
const PLING_PARTIALS = [
  { ratio: 1, level: 0.22, decay: 0.5 },
  { ratio: 2, level: 0.05, decay: 0.2 },
];

export function pling() {
  return {
    name: 'pling',
    duration: 0.7,
    voices: PLING_NOTES.flatMap(({ at, freq }) =>
      PLING_PARTIALS.map(({ ratio, level, decay }) => ({
        source: { kind: 'osc', wave: 'sine', freq: [{ t: 0, v: freq * ratio, ramp: 'set' }] },
        gain: [
          { t: 0, v: SILENT, ramp: 'set' },
          ...(at > 0 ? [{ t: at, v: SILENT, ramp: 'linear' }] : []),
          { t: at + 0.004, v: level, ramp: 'linear' },
          { t: at + decay, v: SILENT, ramp: 'exp' },
        ],
      })),
    ),
  };
}

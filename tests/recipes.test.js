import { describe, it, expect } from 'vitest';
import { wheee, bong, crash, BONG_PITCH, WHEEE_VOWELS } from '../src/audio/recipes.js';

const recipes = {
  'wheee (ih)': wheee('ih'),
  'wheee (ee)': wheee('ee'),
  'bong (rock)': bong('rock'),
  'bong (branch)': bong('branch'),
  'bong (thornBush)': bong('thornBush'),
  crash: crash(),
};

function envelopes(voice) {
  const list = [['gain', voice.gain]];
  if (voice.source.freq) list.push(['source freq', voice.source.freq]);
  for (const f of voice.filters ?? []) list.push(['filter freq', f.freq]);
  for (const f of voice.formants ?? []) list.push(['formant freq', f.freq], ['formant gain', f.gain]);
  return list;
}

describe('sound recipes', () => {
  for (const [label, recipe] of Object.entries(recipes)) {
    describe(label, () => {
      it('has a name, a duration and at least one voice', () => {
        expect(typeof recipe.name).toBe('string');
        expect(recipe.duration).toBeGreaterThan(0);
        expect(recipe.duration).toBeLessThanOrEqual(1.5);
        expect(recipe.voices.length).toBeGreaterThan(0);
      });

      it('schedules points in order, within the duration, starting with a set', () => {
        for (const voice of recipe.voices) {
          for (const [, env] of envelopes(voice)) {
            expect(env[0]).toMatchObject({ t: 0, ramp: 'set' });
            for (let i = 1; i < env.length; i++) expect(env[i].t).toBeGreaterThan(env[i - 1].t);
            expect(env[env.length - 1].t).toBeLessThanOrEqual(recipe.duration);
          }
        }
      });

      it('never ramps exponentially to zero or below (Web Audio throws)', () => {
        for (const voice of recipe.voices) {
          for (const [, env] of envelopes(voice)) {
            for (const p of env) if (p.ramp === 'exp') expect(p.v).toBeGreaterThan(0);
            // An exponential ramp also needs a non-zero starting value.
            for (let i = 1; i < env.length; i++) if (env[i].ramp === 'exp') expect(env[i - 1].v).toBeGreaterThan(0);
          }
        }
      });

      it('starts and ends silent, without clipping', () => {
        for (const voice of recipe.voices) {
          expect(voice.gain[0].v).toBeLessThan(0.001);
          expect(voice.gain[voice.gain.length - 1].v).toBeLessThan(0.001);
          for (const p of voice.gain) expect(p.v).toBeLessThanOrEqual(1);
        }
      });

      it('stays in the audible range', () => {
        for (const voice of recipe.voices) {
          for (const [name, env] of envelopes(voice)) {
            if (name.endsWith('gain')) continue;
            for (const p of env) {
              expect(p.v).toBeGreaterThanOrEqual(20);
              expect(p.v).toBeLessThanOrEqual(12000);
            }
          }
        }
      });
    });
  }

  for (const vowel of Object.keys(WHEEE_VOWELS)) {
    it(`sings one steady "${vowel}" vowel on one pitch`, () => {
      const voice = wheee(vowel).voices[0];
      expect(voice.source.freq).toHaveLength(1);
      for (const f of voice.formants) {
        expect(f.freq).toHaveLength(1);
        expect(f.gain).toHaveLength(1);
      }
      // Front vowels: low first formant, high second.
      const [f1, f2] = voice.formants.map((f) => f.freq[0].v);
      expect(f1).toBeLessThan(500);
      expect(f2).toBeGreaterThan(2000);
    });
  }

  it('makes "ee" (teach) higher and tighter than "ih" (hit)', () => {
    const [ih1, ih2] = wheee('ih').voices[0].formants.map((f) => f.freq[0].v);
    const [ee1, ee2] = wheee('ee').voices[0].formants.map((f) => f.freq[0].v);
    expect(ee1).toBeLessThan(ih1);
    expect(ee2).toBeGreaterThan(ih2);
  });

  it('keeps the buzz of the upper harmonics out (soft, not harsh)', () => {
    for (const vowel of Object.keys(WHEEE_VOWELS)) {
      const voice = wheee(vowel).voices[0];
      const lowpass = voice.filters.find((f) => f.type === 'lowpass');
      expect(lowpass.freq.every((p) => p.v <= 5000)).toBe(true);
    }
  });

  it('pitches the bong by obstacle type, rock lowest', () => {
    const base = (type) => bong(type).voices[0].source.freq[0].v;
    expect(base('rock')).toBe(BONG_PITCH.rock);
    expect(base('rock')).toBeLessThan(base('branch'));
    expect(base('branch')).toBeLessThan(base('thornBush'));
    expect(base('unknown')).toBe(BONG_PITCH.rock);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { createStartup, hideLoading } from '../src/startup.js';

function document() {
  const loading = { hidden: false };
  return { loading, documentElement: { dataset: {} }, getElementById: () => loading };
}

describe('startup readiness', () => {
  it('keeps loading active until the prepared frame and publishes readiness once', async () => {
    const doc = document(), startup = createStartup(doc);
    const abort = vi.fn();
    doc.defaultView = { __loadingErrorController: { abort } };
    expect(startup.complete).toBe(false);
    expect(doc.loading.hidden).toBe(false);
    expect(doc.documentElement.dataset.ready).toBeUndefined();
    startup.finish(); startup.finish();
    expect(await startup.ready).toBe(true);
    expect(startup.complete).toBe(true);
    expect(doc.loading.hidden).toBe(true);
    expect(doc.documentElement.dataset.ready).toBe('true');
    expect(abort).toHaveBeenCalledOnce();
    expect(doc.defaultView.__loadingErrorController).toBeUndefined();
  });

  it('a load/setup failure removes the indicator and cannot later become ready', async () => {
    const doc = document(), startup = createStartup(doc);
    startup.fail(); startup.finish(); startup.fail();
    expect(await startup.ready).toBe(false);
    expect(startup.failed).toBe(true);
    expect(startup.complete).toBe(false);
    expect(doc.loading.hidden).toBe(true);
    expect(doc.documentElement.dataset.ready).toBeUndefined();
  });

  it('error screens can also remove the shell before the game module exists', () => {
    const doc = document();
    hideLoading(doc);
    expect(doc.loading.hidden).toBe(true);
    expect(() => hideLoading({ getElementById: () => null })).not.toThrow();
  });
});

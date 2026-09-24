import { describe, it, expect } from 'vitest';
import { createPause, RESUME_GRACE_MS } from '../src/pause.js';
import { createInput } from '../src/input.js';

function fakeDocument(visibilityState = 'visible') {
  const doc = new EventTarget();
  doc.visibilityState = visibilityState;
  return doc;
}

function setVisibility(doc, state) {
  doc.visibilityState = state;
  doc.dispatchEvent(new Event('visibilitychange'));
}

// MediaQueryList stand-in for "(orientation: portrait) and (pointer: coarse)".
function fakeQuery(matches = false) {
  const query = new EventTarget();
  query.matches = matches;
  return query;
}

function setMatches(query, matches) {
  query.matches = matches;
  query.dispatchEvent(new Event('change'));
}

function clock() {
  let t = 1000;
  return { now: () => t, advance: (ms) => (t += ms) };
}

describe('pause', () => {
  it('starts unpaused on a visible page', () => {
    const pause = createPause(new EventTarget(), fakeDocument());
    expect(pause.paused).toBe(false);
    expect(pause.reason).toBeNull();
  });

  it('starts paused on a hidden page or an upright phone', () => {
    expect(createPause(new EventTarget(), fakeDocument('hidden')).paused).toBe(true);
    const upright = createPause(new EventTarget(), fakeDocument(), { portrait: fakeQuery(true) });
    expect(upright.paused).toBe(true);
    expect(upright.reason).toBe('portrait');
  });

  it('pauses on window blur and resumes on focus', () => {
    const win = new EventTarget();
    const pause = createPause(win, fakeDocument());
    win.dispatchEvent(new Event('blur'));
    expect(pause.paused).toBe(true);
    expect(pause.reason).toBe('unfocused');
    win.dispatchEvent(new Event('focus'));
    expect(pause.paused).toBe(false);
  });

  it('pauses while the page is hidden', () => {
    const doc = fakeDocument();
    const pause = createPause(new EventTarget(), doc);
    setVisibility(doc, 'hidden');
    expect(pause.paused).toBe(true);
    setVisibility(doc, 'visible');
    expect(pause.paused).toBe(false);
  });

  it('pauses while a touch device is held upright', () => {
    const portrait = fakeQuery();
    const pause = createPause(new EventTarget(), fakeDocument(), { portrait });
    setMatches(portrait, true);
    expect(pause.reason).toBe('portrait');
    setMatches(portrait, false);
    expect(pause.paused).toBe(false);
  });

  it('reports portrait over unfocused when both apply', () => {
    const win = new EventTarget();
    const portrait = fakeQuery();
    const pause = createPause(win, fakeDocument(), { portrait });
    win.dispatchEvent(new Event('blur'));
    setMatches(portrait, true);
    expect(pause.reason).toBe('portrait');
    setMatches(portrait, false);
    expect(pause.reason).toBe('unfocused');
  });

  it('stays paused until every reason has cleared', () => {
    const win = new EventTarget();
    const doc = fakeDocument();
    const pause = createPause(win, doc);
    win.dispatchEvent(new Event('blur'));
    setVisibility(doc, 'hidden');
    setVisibility(doc, 'visible');
    expect(pause.paused).toBe(true);
    win.dispatchEvent(new Event('focus'));
    expect(pause.paused).toBe(false);
  });

  it('can be held for other reasons, with the same resume grace', () => {
    const win = new EventTarget();
    const c = clock();
    const pause = createPause(win, fakeDocument(), { now: c.now });
    pause.hold('graphics', true);
    expect(pause.paused).toBe(true);
    expect(pause.reason).toBe('graphics');
    win.dispatchEvent(new Event('blur'));
    pause.hold('graphics', false);
    expect(pause.reason).toBe('unfocused');
    win.dispatchEvent(new Event('focus'));
    expect(pause.paused).toBe(false);
    expect(pause.acceptsInput()).toBe(false);
    c.advance(RESUME_GRACE_MS);
    expect(pause.acceptsInput()).toBe(true);
    pause.hold('graphics', false); // releasing twice is harmless
    expect(pause.paused).toBe(false);
  });

  it('stops listening after destroy', () => {
    const win = new EventTarget();
    const portrait = fakeQuery();
    const pause = createPause(win, fakeDocument(), { portrait });
    pause.destroy();
    win.dispatchEvent(new Event('blur'));
    setMatches(portrait, true);
    expect(pause.paused).toBe(false);
  });
});

describe('input after resuming', () => {
  it('accepts input while running, not while paused or just after resuming', () => {
    const win = new EventTarget();
    const c = clock();
    const pause = createPause(win, fakeDocument(), { now: c.now });
    expect(pause.acceptsInput()).toBe(true);

    win.dispatchEvent(new Event('blur'));
    expect(pause.acceptsInput()).toBe(false);
    c.advance(5000);
    win.dispatchEvent(new Event('focus'));
    expect(pause.acceptsInput()).toBe(false);
    c.advance(RESUME_GRACE_MS - 1);
    expect(pause.acceptsInput()).toBe(false);
    c.advance(1);
    expect(pause.acceptsInput()).toBe(true);
  });

  it('does not start the grace period when nothing was paused', () => {
    const win = new EventTarget();
    const c = clock();
    const pause = createPause(win, fakeDocument(), { now: c.now });
    win.dispatchEvent(new Event('focus'));
    expect(pause.acceptsInput()).toBe(true);
  });

  describe('as main.js wires it', () => {
    function setup() {
      const win = new EventTarget();
      const canvas = new EventTarget();
      const c = clock();
      const pause = createPause(win, fakeDocument(), { now: c.now });
      const input = createInput(win, canvas, { accepts: () => pause.acceptsInput() });
      const tap = () =>
        canvas.dispatchEvent(Object.assign(new Event('pointerdown', { cancelable: true }), { pointerType: 'touch', button: 0 }));
      return { win, c, input, tap };
    }

    it('drops taps made while paused and the tap that resumes the game', () => {
      const { win, c, input, tap } = setup();
      win.dispatchEvent(new Event('blur'));
      tap();
      win.dispatchEvent(new Event('focus'));
      tap(); // the click/tap that brought focus back
      expect(input.consumePress()).toBe(false);
      c.advance(RESUME_GRACE_MS);
      tap();
      expect(input.consumePress()).toBe(true);
    });

    it('drops the resuming tap even if the next frame comes after the grace period', () => {
      // Slow devices can take longer than the grace period to run the next frame.
      const { win, c, input, tap } = setup();
      win.dispatchEvent(new Event('blur'));
      win.dispatchEvent(new Event('focus'));
      tap();
      c.advance(RESUME_GRACE_MS * 3);
      expect(input.consumePress()).toBe(false);
    });
  });
});

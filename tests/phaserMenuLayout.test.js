import { describe, expect, it } from 'vitest';
import { layoutFor } from '../src/layout.js';
import { configMenuLayout, panelPoint, resultsMenuLayout, titleMenuLayout, visibleMenuArea } from '../src/render/menuLayout.js';

describe('Phaser menus in the visible browser area', () => {
  const screens = [
    [375, 812, 600, { top: 47, bottom: 34 }],
    [375, 667, 480, { top: 20, bottom: 20 }],
    [320, 480, 400, { top: 20 }],
    [812, 375, 250, { left: 44, right: 44, bottom: 21 }],
    [812, 375, 220, { left: 44, right: 44, bottom: 21 }],
    [844, 390, 300, { left: 44, right: 44, bottom: 21 }],
    [1280, 720, 720, {}],
  ];
  for (const [width, height, visibleHeight, insets] of screens) for (const fixed of [false, true]) for (const mobile of [false, true]) {
    it(`fits ${width}×${height}, visible height ${visibleHeight}, fixed=${fixed}, mobile=${mobile}, with usable buttons`, () => {
      const win = { innerWidth: width, innerHeight: height,
        visualViewport: { width, height: visibleHeight, offsetTop: 0, offsetLeft: 0 } };
      const area = visibleMenuArea(win, insets);
      const layout = layoutFor(width, height, undefined, { fixed });
      const title = titleMenuLayout(layout, area, { mobile }), config = configMenuLayout(layout, area);
      const results = resultsMenuLayout(layout, area);
      expect(title.modes).toHaveLength(mobile ? 0 : 3);
      for (const menu of [title, config, results]) {
        const x = layout.x + menu.x * layout.scale, y = layout.y + menu.y * layout.scale;
        expect(x - menu.width * menu.cssScale / 2).toBeGreaterThanOrEqual(area.x - 1e-8);
        expect(x + menu.width * menu.cssScale / 2).toBeLessThanOrEqual(area.x + area.width + 1e-8);
        expect(y - menu.height * menu.cssScale / 2).toBeGreaterThanOrEqual(area.y - 1e-8);
        expect(y + menu.height * menu.cssScale / 2).toBeLessThanOrEqual(area.y + area.height + 1e-8);
      }
      for (const hit of [...title.modes, ...title.settings].map((item) => item.hit)
        .concat([title.startHit, title.configHit])) {
        expect(hit.h * title.cssScale).toBeGreaterThanOrEqual(44);
        expect(hit.w * title.cssScale).toBeGreaterThanOrEqual(44);
      }
      for (const hit of config.items.map((item) => item.hit).concat([config.backHit])) {
        expect(hit.h * config.cssScale).toBeGreaterThanOrEqual(44);
        expect(hit.w * config.cssScale).toBeGreaterThanOrEqual(44);
      }
      for (const hit of [results.replayHit, results.menuHit]) {
        expect(hit.h * results.cssScale).toBeGreaterThanOrEqual(44);
        expect(hit.w * results.cssScale).toBeGreaterThanOrEqual(44);
      }
      expect(results.menu.y).toBeGreaterThan(results.replay.y);
      expect(results.menuHit.y).toBeGreaterThan(results.replayHit.y + results.replayHit.h);
    });
  }

  it('uses visual viewport offsets and safe areas instead of the hidden layout viewport', () => {
    expect(visibleMenuArea({ innerWidth: 375, innerHeight: 812,
      visualViewport: { width: 375, height: 500, offsetLeft: 0, offsetTop: 30 } },
    { top: 47, bottom: 34 })).toEqual({ x: 8, y: 85, width: 359, height: 403 });
  });

  it('hit tests using the panel scale even in letterboxed two-player portrait views', () => {
    const layout = layoutFor(375, 812, undefined, { fixed: true });
    const area = visibleMenuArea({ innerWidth: 375, innerHeight: 812 });
    const menu = titleMenuLayout(layout, area);
    const view = { x: menu.x, y: menu.y, scaleX: menu.scale, scaleY: menu.scale };
    const point = panelPoint(layout, { left: 10, top: 20 }, view,
      10 + layout.x + (menu.x + 50 * menu.scale) * layout.scale,
      20 + layout.y + (menu.y + 57 * menu.scale) * layout.scale);
    expect(point.x).toBeCloseTo(50, 10);
    expect(point.y).toBeCloseTo(57, 10);
  });
});

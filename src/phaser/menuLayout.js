// Menu geometry in logical panel units, fitted to CSS pixels independently of
// the gameplay viewport. Safari can show less than window.innerHeight.
const MARGIN = 8;
const MIN_SCALE = 0.65;
const clamp = (value, low, high) => Math.max(low, Math.min(value, high));

export function visibleMenuArea(win, insets = {}) {
  const vv = win.visualViewport;
  const x = clamp(vv?.offsetLeft ?? 0, 0, win.innerWidth);
  const y = clamp(vv?.offsetTop ?? 0, 0, win.innerHeight);
  const right = Math.min(win.innerWidth, x + (vv?.width ?? win.innerWidth));
  const bottom = Math.min(win.innerHeight, y + (vv?.height ?? win.innerHeight));
  const left = x + (insets.left ?? 0) + MARGIN;
  const top = y + (insets.top ?? 0) + MARGIN;
  return { x: left, y: top,
    width: Math.max(1, right - (insets.right ?? 0) - MARGIN - left),
    height: Math.max(1, bottom - (insets.bottom ?? 0) - MARGIN - top) };
}

function placement(layout, area, width, height) {
  const desired = Math.max(MIN_SCALE, layout.scale * layout.ui);
  const cssScale = Math.min(desired, area.width / width, area.height / height);
  const preferred = layout.panels.title;
  const x = clamp(layout.x + preferred.x * layout.scale,
    area.x + width * cssScale / 2, area.x + area.width - width * cssScale / 2);
  const y = clamp(layout.y + preferred.y * layout.scale,
    area.y + height * cssScale / 2, area.y + area.height - height * cssScale / 2);
  return { x: (x - layout.x) / layout.scale, y: (y - layout.y) / layout.scale,
    scale: cssScale / layout.scale, cssScale, width, height, shiftY: 0 };
}

const hit = (x, y, w, h) => ({ x: x - w / 2, y: y - h / 2, w, h });

export function titleMenuLayout(layout, area, { mobile = false } = {}) {
  const fullHeight = mobile ? 450 : 540;
  const compact = area.height < fullHeight * MIN_SCALE && area.width >= 740 * MIN_SCALE;
  const condensed = !compact && area.height < fullHeight * MIN_SCALE;
  const width = compact ? 740 : Math.min(520, area.width / MIN_SCALE);
  const height = compact ? 300 : condensed ? (mobile ? 400 : 450) : fullHeight;
  const at = placement(layout, area, width, height);
  const column = compact ? 400 / 3 : (width - 32) / 3;
  const xs = compact ? [1 / 6, 1 / 2, 5 / 6].map((u) => width / 2 - 400 + u * 400)
    : [-column, 0, column];
  const modeY = compact ? -91 : condensed ? -43 : -30;
  const settingsY = compact ? -5 : mobile ? (condensed ? -14 : 20) : condensed ? 32 : 57;
  const actionX = compact ? -210 : 0;
  const startY = compact ? 105 : mobile ? (condensed ? 78 : 105) : condensed ? 112 : 145;
  const configX = compact ? 170 : 0;
  const configY = compact ? 105 : mobile ? (condensed ? 152 : 178) : condensed ? 186 : 218;
  return { ...at, compact, condensed,
    name: { x: actionX, y: compact ? -99 : mobile ? (condensed ? -167 : -166) : condensed ? -192 : -203,
      size: compact ? 62 : condensed ? 54 : mobile ? 70 : 76 },
    tagline: { x: actionX, y: compact ? -37 : mobile ? (condensed ? -112 : -106) : condensed ? -137 : -135,
      size: compact ? 20 : condensed ? 19 : 21 },
    control: { x: actionX, y: compact ? 22 : mobile ? (condensed ? -72 : -53) : condensed ? -99 : -84, size: compact ? 16 : 18 },
    prompt: { x: actionX, y: startY, size: compact ? 24 : 28 },
    config: { x: configX, y: configY, size: 22 },
    keys: { x: configX, y: compact ? 143 : 253, size: 12 },
    version: { x: width / 2 - 16, y: -height / 2 + 24 },
    modes: mobile ? [] : xs.map((x) => ({ x, y: modeY, hit: hit(x, modeY, column - 6, compact ? 74 : 72) })),
    settings: xs.map((x) => ({ x, y: settingsY, hit: hit(x, settingsY, column - 6, compact ? 74 : condensed ? 72 : 80) })),
    startHit: hit(actionX, startY, compact ? 300 : width - 32, compact ? 74 : 68),
    configHit: hit(configX, configY, compact ? 400 : width - 32, compact ? 74 : 68),
  };
}

export function configMenuLayout(layout, area) {
  const compact = area.height < 520 * MIN_SCALE && area.width >= 740 * MIN_SCALE;
  const condensed = !compact && area.height < 520 * MIN_SCALE;
  const width = compact ? 740 : Math.min(440, area.width / MIN_SCALE);
  const height = compact ? 300 : condensed ? 450 : 520;
  const at = placement(layout, area, width, height);
  const points = compact ? [[60, -77], [260, -77], [60, 15], [260, 15]]
    : [[0, condensed ? -95 : -90], [0, condensed ? -20 : -15], [0, condensed ? 50 : 60], [0, condensed ? 120 : 139]];
  const back = compact ? { x: -210, y: 108 } : { x: 0, y: condensed ? 190 : 223 };
  return { ...at, compact, condensed,
    heading: { x: compact ? -210 : 0, y: compact ? -85 : condensed ? -185 : -194, size: compact ? 46 : 52 },
    subtitle: { x: compact ? -210 : 0, y: compact ? -28 : condensed ? -141 : -146, size: 22 },
    hint: { x: compact ? -210 : 0, y: compact ? 34 : 181, size: compact ? 16 : 12 },
    back,
    backHit: hit(back.x, back.y, compact ? 300 : width - 32, compact ? 74 : 68),
    items: points.map(([x, y]) => ({ x, y, hit: hit(x, y, compact ? 190 : width - 32,
      condensed || !compact && y === 139 ? 68 : 74) })),
  };
}

export function panelPoint(layout, rect, view, clientX, clientY) {
  return { x: ((clientX - rect.left - layout.x) / layout.scale - view.x) / view.scaleX,
    y: ((clientY - rect.top - layout.y) / layout.scale - view.y) / view.scaleY };
}


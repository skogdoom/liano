import { TILE_EDGE, atlasScaleFor } from '../art/catalog.js';

// The pre-rendered art in the Phaser version (PHASER_PLAN.md, section 5): loading the
// atlases built into public/art/ (scripts/build-art.mjs) and making pieces from them.
// public/art/pieces.json, the catalog, says per piece where its frames are, its anchor
// and its zoom at each atlas scale.

const BASE = `${import.meta.env.BASE_URL}art/`;
export const CATALOG = 'art.catalog';
const atlasKey = (set) => `art.${set}`;
const tileKey = (key) => `tile.${key}`;
const BLEND_ADD = 1; // Phaser.BlendModes.ADD

// Queues the catalog on a scene's loader.
export function queueCatalog(load) {
  load.json(CATALOG, `${BASE}pieces.json`);
}

// Queues the catalog and then, once it is in, the sets of atlases at `scale` (for pages
// that load everything at once: the parity page, the bench).
export function queueArt(load, scale, sets = ['boot', 'main']) {
  load.once(`filecomplete-json-${CATALOG}`, (key, type, catalog) => {
    for (const set of sets) queueSet(load, catalog, set, scale);
  });
  queueCatalog(load);
}

// Queues a set of atlases ('boot' or 'main') at `scale`, and its tiles.
export function queueSet(load, catalog, set, scale) {
  load.multiatlas(atlasKey(set), `${BASE}${set}@${scale}x.json`, BASE);
  for (const [key, piece] of Object.entries(catalog.pieces)) {
    if (piece.set === set && piece.kind === 'tile') load.image(tileKey(key), `${BASE}${piece.at[scale].image}`);
  }
}

// The art at one atlas scale: makes pieces, each in its own units (an image's origin is
// the piece's pivot, its scale 1/zoom), so rigs place them as the drawing code placed the
// shapes.
export class Art {
  constructor(catalog, scale) {
    this.catalog = catalog;
    this.scale = scale;
    // Per key: { frames, anchor, zoom, size } at this scale.
    this.table = Object.fromEntries(Object.entries(catalog.pieces).map(([key, p]) => [key, p.at[scale]]));
  }

  // The atlas scale for a screen of `density` device pixels per world unit.
  static scaleFor(density) {
    return atlasScaleFor(density);
  }

  piece(key) {
    const p = this.catalog.pieces[key];
    if (!p) throw new Error(`No piece called ${key}`);
    return p;
  }

  at(key) {
    this.piece(key);
    return this.table[key];
  }

  // World units per atlas pixel of a piece.
  unit(key) {
    return 1 / this.at(key).zoom;
  }

  // A piece (frame `frame`) as an Image, not yet added to a display list. It remembers
  // its piece (`artKey`), for tint().
  image(scene, key, frame = 0) {
    const p = this.piece(key);
    const at = this.table[key];
    const image = scene.make
      .image({ key: atlasKey(p.set), frame: at.frames[frame] }, false)
      .setOrigin(at.anchor[0], at.anchor[1])
      .setScale(1 / at.zoom);
    image.artKey = key;
    return image;
  }

  // A piece whose light is added to what is behind it (the temple's glow).
  glow(scene, key, frame = 0) {
    return this.image(scene, key, frame).setBlendMode(BLEND_ADD);
  }

  // Stretches an image of a flat piece (or the part of it from `from` to `to`, in units
  // across its box) over the rect { x, y, w, h }. A picture stretched far blends its edge
  // pixels with the transparent space round it, so a pixel is cut off each edge first.
  stretch(image, key, { x, y, w, h }, { from = [0, 0], to = null } = {}) {
    const { box } = this.piece(key);
    const { zoom } = this.at(key);
    const [fx, fy] = [from[0] * zoom + 1, from[1] * zoom + 1];
    const [tx, ty] = to ? [to[0] * zoom - 1, to[1] * zoom - 1] : [box.w * zoom - 1, box.h * zoom - 1];
    image.setOrigin(0, 0).setCrop(fx, fy, tx - fx, ty - fy);
    const [sx, sy] = [w / (tx - fx), h / (ty - fy)];
    return image.setScale(sx, sy).setPosition(x - fx * sx, y - fy * sy);
  }

  // A piece that repeats downwards (the temple's base and stairs): copies stacked from its
  // origin down to `height` units below it, the last one cropped there. Images, not yet
  // added; each sits where the drawing put that repeat.
  column(scene, key, height, frame = 0) {
    const { box } = this.piece(key);
    const { zoom } = this.at(key);
    const images = [];
    for (let y = 0; y < height; y += box.h) {
      const image = this.image(scene, key, frame).setPosition(0, y);
      const left = height - y;
      if (left < box.h) image.setCrop(0, 0, image.frame.width, Math.round(left * zoom));
      images.push(image);
    }
    return images;
  }

  // A 9-slice piece (a panel) as a NineSlice of `width` × `height` units, its box's size:
  // the corners keep their size, the edges and the middle stretch. Its origin is the box's
  // top left corner.
  nineSlice(scene, key, width, height) {
    const p = this.piece(key);
    const at = this.table[key];
    const z = at.zoom;
    const { left, right, top, bottom } = p.slices;
    const panel = scene.make.nineslice(
      {
        key: atlasKey(p.set),
        frame: at.frames[0],
        width: width * z,
        height: height * z,
        leftWidth: left * z,
        rightWidth: right * z,
        topHeight: top * z,
        bottomHeight: bottom * z,
      },
      false,
    );
    panel.setOrigin(0, 0).setScale(1 / z);
    panel.artKey = key;
    return panel;
  }

  // Tints the pieces among `objects` that take the stage tint with `color` (the others
  // keep their own colours: the obstacles, the temple's fire). Containers are gone into.
  tint(objects, color) {
    for (const object of objects) {
      if (object.list) this.tint(object.list, color);
      else if (object.artKey && this.piece(object.artKey).tint) {
        // A strip (a Rope) has no tint: it takes a colour per point.
        if (object.setTint) object.setTint(color);
        else object.setColors(color);
      }
    }
  }

  // Shows frame `frame` of a flipbook piece on an image made by image().
  setFrame(image, key, frame) {
    return image.setFrame(this.at(key).frames[frame], false, false);
  }

  // A strip piece as a Rope, not yet added; bend() lays it along a path.
  rope(scene, key) {
    const p = this.piece(key);
    const at = this.table[key];
    const rope = scene.make.rope({ key: atlasKey(p.set), frame: at.frames[0], points: 2 }, false).setScale(1 / at.zoom);
    rope.artKey = key;
    return rope;
  }

  // Lays a strip piece's rope along `points` (in world units).
  bend(rope, key, points) {
    bendStrip(rope, this.at(key), points, this.piece(key).length);
  }

  // A tile piece repeating sideways over `width` units, its top where its box's top is.
  // Its image has `zoom` pixels per unit: the sprite is that much larger, scaled down.
  tile(scene, key, width) {
    const p = this.piece(key);
    const { zoom } = this.at(key);
    const tile = scene.make.tileSprite({ x: 0, y: p.box.y, width: width * zoom, height: p.box.h * zoom, key: tileKey(key) }, false).setOrigin(0, 0).setScale(1 / zoom);
    // Only the rows between the image's edge rows (see TILE_EDGE).
    tile.tilePositionY = TILE_EDGE;
    tile.artKey = key;
    return tile;
  }

  // One copy of a tile, using the same standalone texture as tile(). Moving copies
  // keeps backdrop movement in the scene transform instead of a wrapping shader. Crop off
  // the duplicate edge rows, with the visible top still at the piece's box.y.
  tileCopy(scene, key) {
    const { box } = this.piece(key);
    const { zoom } = this.at(key);
    const image = scene.make.image({ key: tileKey(key) }, false)
      .setOrigin(0, 0).setScale(1 / zoom)
      .setCrop(0, TILE_EDGE, box.w * zoom, box.h * zoom)
      .setPosition(0, box.y - TILE_EDGE / zoom);
    image.artKey = key;
    return image;
  }

  // Sets a tile's width (units) and scroll: the tile at `x` units across it shows first.
  setTile(tile, key, { width = null, x = 0 }) {
    const { zoom } = this.at(key);
    if (width !== null) tile.setSize(width * zoom, tile.height);
    tile.tilePositionX = x * zoom;
    return tile;
  }
}

// Bends a strip piece (straight along +x, `length` units from its origin) along `points`,
// on a Rope made from it. The points are extended past each end by the piece's margins,
// and the strip is laid along them by distance: a Rope spreads its texture evenly over
// its points instead, which would squash the round caps into the short end segments.
export function bendStrip(rope, info, points, length) {
  const { zoom, anchor } = info;
  const frameUnits = rope.frame.width / zoom;
  const before = anchor[0] * frameUnits;
  const after = frameUnits - before - length;
  const ext = (a, b, by) => {
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    return { x: a.x + ((a.x - b.x) / len) * by, y: a.y + ((a.y - b.y) / len) * by };
  };
  const all = [ext(points[0], points[1], before), ...points, ext(points[points.length - 1], points[points.length - 2], after)];
  rope.setPoints(all.map((p) => ({ x: p.x * zoom, y: p.y * zoom })));
  // Along the path the strip's own length is spread over the path's (a bowed rope is a
  // little longer than straight); the margins keep their size.
  const along = [0];
  for (let i = 1; i < points.length; i++) along.push(along[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  const total = along[along.length - 1];
  const shares = [0, ...along.map((d) => (before + (length * d) / total) / frameUnits), 1];
  const { u0, u1 } = rope.frame;
  shares.forEach((share, i) => {
    rope.uv[i * 4] = rope.uv[i * 4 + 2] = u0 + (u1 - u0) * share;
  });
}

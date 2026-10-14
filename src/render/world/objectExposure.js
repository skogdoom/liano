export const OBJECT_EXPOSURE_CSS = 3;
export const OBJECT_SHUTTER = 0.5;

// Rendering history only. Motion is measured after the native camera/container
// transforms, so moving obstacles and camera movement both contribute correctly.
export class ObjectExposure {
  constructor(config = { enabled: true, limitCSS: OBJECT_EXPOSURE_CSS }) {
    this.config = config;
    this.history = new WeakMap();
    this.frame = 0;
    this.generation = 0;
  }

  reset() { this.generation++; }

  begin(dt, pixelRatio) {
    this.frame++;
    this.dt = dt;
    this.pixelRatio = pixelRatio;
    this.maximumCSS = 0;
    this.images = 0;
  }

  sample(image, quad) {
    let data = this.history.get(image);
    if (!data) {
      data = { frame: -1, generation: -1, x: 0, y: 0, determinant: 0, dx: 0, dy: 0, attributes: new Float32Array(6) };
      this.history.set(image, data);
    }
    // Snapshots/multiple submissions in one frame must reuse the same history.
    if (data.frame === this.frame && data.generation === this.generation) return data;
    const x = (quad[0] + quad[2] + quad[4] + quad[6]) / 4;
    const y = (quad[1] + quad[3] + quad[5] + quad[7]) / 4;
    const determinant = (quad[6] - quad[0]) * (quad[3] - quad[1]) - (quad[7] - quad[1]) * (quad[2] - quad[0]);
    let dx = x - data.x, dy = y - data.y;
    const distance = Math.hypot(dx, dy);
    const continuous = data.frame === this.frame - 1 && data.generation === this.generation && determinant * data.determinant > 0;
    if (!continuous || !this.config.enabled || this.dt <= 0 || this.dt > 0.05 ||
      this.pixelRatio <= 0 || distance < 0.5 || distance > 80 * this.pixelRatio) dx = dy = 0;
    else {
      const width = Math.min(distance * OBJECT_SHUTTER, this.config.limitCSS * this.pixelRatio);
      const factor = width / distance;
      dx *= factor; dy *= factor;
      this.maximumCSS = Math.max(this.maximumCSS, width / this.pixelRatio);
      this.images++;
    }
    data.frame = this.frame; data.generation = this.generation;
    data.x = x; data.y = y; data.determinant = determinant; data.dx = dx; data.dy = dy;
    return data;
  }
}

// Expand the quad enough to retain blurred silhouettes. Invert its affine screen
// basis to express screen travel in UV units, including rotated/scaled/cropped art.
// The original frame bounds travel as vertex data: sampling never wraps an atlas.
export function expandExposure(quad, uv, dx, dy, attributes) {
  const { u0, v0, u1, v1 } = uv;
  attributes[0] = attributes[1] = 0;
  // Canvas textures can have inverted UVs; the velocity keeps that sign, while
  // the sampling boundary must always be ordered.
  attributes[2] = Math.min(u0, u1); attributes[3] = Math.min(v0, v1);
  attributes[4] = Math.max(u0, u1); attributes[5] = Math.max(v0, v1);
  if (dx === 0 && dy === 0) return;
  const bx = quad[6] - quad[0], by = quad[7] - quad[1];
  const cx = quad[2] - quad[0], cy = quad[3] - quad[1];
  const determinant = bx * cy - by * cx;
  if (Math.abs(determinant) < 1e-8) return;
  const x = (dx * cy - dy * cx) / determinant;
  const y = (dy * bx - dx * by) / determinant;
  attributes[0] = x * (u1 - u0);
  attributes[1] = y * (v1 - v0);
  const ex = Math.abs(x) / 2, ey = Math.abs(y) / 2;
  for (let i = 0; i < 4; i++) {
    const sx = i < 2 ? -ex : ex, sy = i === 0 || i === 3 ? -ey : ey;
    quad[i * 2] += bx * sx + cx * sy;
    quad[i * 2 + 1] += by * sx + cy * sy;
  }
  uv.u0 -= ex * (u1 - u0); uv.u1 += ex * (u1 - u0);
  uv.v0 -= ey * (v1 - v0); uv.v1 += ey * (v1 - v0);
}

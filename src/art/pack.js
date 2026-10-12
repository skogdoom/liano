// Packs rectangles into atlas pages, each at most `width` × `maxHeight`, with `padding` px
// between cells and round the edges: tallest first, each where it sits lowest on the
// skyline of the cells already placed (leftmost of the lowest), so short cells fill the
// space beside tall ones. Returns the pages ({ width, height, cells }) with each cell's x
// and y set (cells keep their other fields). Heights round up to a multiple of 4. Cells
// marked `first` are packed before the others, so they are on the first page: it throws
// if they do not all fit there.
export function pack(cells, { width, maxHeight, padding = 2 }) {
  const order = (a, b) => b.h - a.h || b.w - a.w;
  const sorted = [...cells.filter((c) => c.first).sort(order), ...cells.filter((c) => !c.first).sort(order)];
  const pages = [];
  let page = null;
  // The skyline: segments { x, w, y } across the page, y the lowest free row.
  let skyline = null;
  const newPage = () => {
    page = { width, height: 0, cells: [] };
    pages.push(page);
    skyline = [{ x: padding, w: width - 2 * padding, y: padding }];
  };
  // Where a cell w wide starting at segment i would sit: the highest y under it.
  const fitAt = (i, w) => {
    let y = 0;
    let room = 0;
    for (let j = i; j < skyline.length && room < w; j++) {
      y = Math.max(y, skyline[j].y);
      room += skyline[j].w;
    }
    return room >= w ? y : Infinity;
  };
  const place = (w, h) => {
    let best = null;
    for (let i = 0; i < skyline.length; i++) {
      const y = fitAt(i, w);
      if (y + h <= maxHeight - padding && (!best || y < best.y)) best = { i, y };
    }
    return best;
  };
  const raise = ({ i, y }, w, h) => {
    const x = skyline[i].x;
    const top = y + h;
    const end = x + w;
    const next = [];
    for (const s of skyline) {
      const sEnd = s.x + s.w;
      if (sEnd <= x || s.x >= end) next.push(s);
      else {
        if (s.x < x) next.push({ x: s.x, w: x - s.x, y: s.y });
        if (sEnd > end) next.push({ x: end, w: sEnd - end, y: s.y });
      }
    }
    next.push({ x, w, y: top });
    next.sort((a, b) => a.x - b.x);
    // Merge neighbours at the same height.
    skyline = next.reduce((out, s) => {
      const last = out[out.length - 1];
      if (last && last.y === s.y && last.x + last.w === s.x) last.w += s.w;
      else out.push({ ...s });
      return out;
    }, []);
    return x;
  };
  for (const cell of sorted) {
    if (cell.w + 2 * padding > width || cell.h + 2 * padding > maxHeight) {
      throw new Error(`pack: ${cell.name ?? 'a cell'} (${cell.w} × ${cell.h}) does not fit a ${width} × ${maxHeight} page`);
    }
    if (!page) newPage();
    // The cell and the padding after it.
    const [w, h] = [cell.w + padding, cell.h + padding];
    let spot = place(w, h);
    if (!spot) {
      if (cell.first) throw new Error(`pack: ${cell.name ?? 'a cell'} must be on the first page, which is full`);
      newPage();
      spot = place(w, h);
    }
    const x = raise(spot, w, h);
    page.cells.push({ ...cell, x, y: spot.y });
    page.height = Math.max(page.height, Math.ceil((spot.y + h) / 4) * 4);
  }
  return pages;
}

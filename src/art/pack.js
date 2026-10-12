// Packs rectangles into atlas pages: shelves, tallest first, left to right, each page at
// most `width` × `maxHeight`, `padding` px between cells and round the edges. Returns the
// pages ({ width, height, cells }) with each cell's x and y set (cells keep their other
// fields). Heights round up to a multiple of 4.
export function pack(cells, { width, maxHeight, padding = 2 }) {
  const sorted = [...cells].sort((a, b) => b.h - a.h || b.w - a.w);
  const pages = [];
  let page = null;
  let x = 0;
  let y = 0;
  let shelf = 0;
  const newPage = () => {
    page = { width, height: 0, cells: [] };
    pages.push(page);
    x = padding;
    y = padding;
    shelf = 0;
  };
  for (const cell of sorted) {
    if (cell.w + 2 * padding > width || cell.h + 2 * padding > maxHeight) {
      throw new Error(`pack: ${cell.name ?? 'a cell'} (${cell.w} × ${cell.h}) does not fit a ${width} × ${maxHeight} page`);
    }
    if (!page) newPage();
    if (x + cell.w + padding > width) {
      x = padding;
      y += shelf + padding;
      shelf = 0;
    }
    if (y + cell.h + padding > maxHeight) newPage();
    page.cells.push({ ...cell, x, y });
    x += cell.w + padding;
    shelf = Math.max(shelf, cell.h);
    page.height = Math.ceil((y + shelf + padding) / 4) * 4;
  }
  return pages;
}

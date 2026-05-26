const fs = require("node:fs");
const path = require("node:path");

const SIZE = 256;
const pixels = new Uint8ClampedArray(SIZE * SIZE * 4);

function setPixel(x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) {
    return;
  }

  const index = (y * SIZE + x) * 4;

  pixels[index] = r;
  pixels[index + 1] = g;
  pixels[index + 2] = b;
  pixels[index + 3] = a;
}

function fillRect(x, y, width, height, color) {
  for (let yy = y; yy < y + height; yy += 1) {
    for (let xx = x; xx < x + width; xx += 1) {
      setPixel(xx, yy, color.r, color.g, color.b, color.a);
    }
  }
}

function fillRoundedRect(x, y, width, height, radius, color) {
  for (let yy = y; yy < y + height; yy += 1) {
    for (let xx = x; xx < x + width; xx += 1) {
      const left = xx - x;
      const right = x + width - 1 - xx;
      const top = yy - y;
      const bottom = y + height - 1 - yy;
      const dx = Math.max(radius - Math.min(left, right), 0);
      const dy = Math.max(radius - Math.min(top, bottom), 0);

      if (dx * dx + dy * dy <= radius * radius) {
        setPixel(xx, yy, color.r, color.g, color.b, color.a);
      }
    }
  }
}

function fillCircle(cx, cy, radius, color) {
  for (let yy = cy - radius; yy <= cy + radius; yy += 1) {
    for (let xx = cx - radius; xx <= cx + radius; xx += 1) {
      const dx = xx - cx;
      const dy = yy - cy;

      if (dx * dx + dy * dy <= radius * radius) {
        setPixel(xx, yy, color.r, color.g, color.b, color.a);
      }
    }
  }
}

function drawLine(x1, y1, x2, y2, width, color) {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));

  for (let step = 0; step <= steps; step += 1) {
    const t = steps === 0 ? 0 : step / steps;
    const x = Math.round(x1 + (x2 - x1) * t);
    const y = Math.round(y1 + (y2 - y1) * t);

    fillCircle(x, y, Math.floor(width / 2), color);
  }
}

function drawBookIcon() {
  const green = { r: 22, g: 116, b: 71, a: 255 };
  const greenDark = { r: 14, g: 87, b: 55, a: 255 };
  const cream = { r: 249, g: 246, b: 233, a: 255 };
  const page = { r: 255, g: 252, b: 242, a: 255 };
  const gold = { r: 248, g: 184, b: 54, a: 255 };

  fillRoundedRect(18, 18, 220, 220, 42, green);
  fillRoundedRect(34, 34, 188, 188, 30, greenDark);
  fillRoundedRect(54, 70, 70, 116, 8, cream);
  fillRoundedRect(132, 70, 70, 116, 8, cream);
  fillRect(120, 76, 16, 108, { r: 204, g: 224, b: 206, a: 255 });
  fillRoundedRect(64, 82, 48, 92, 5, page);
  fillRoundedRect(144, 82, 48, 92, 5, page);
  drawLine(76, 102, 110, 102, 4, green);
  drawLine(76, 122, 108, 122, 4, green);
  drawLine(76, 142, 106, 142, 4, green);
  drawLine(148, 104, 180, 104, 4, green);
  drawLine(150, 124, 184, 124, 4, green);
  fillRoundedRect(92, 152, 74, 52, 13, gold);
  fillCircle(108, 166, 5, greenDark);
  drawLine(132, 162, 132, 192, 5, greenDark);
  drawLine(122, 170, 142, 170, 5, greenDark);
  drawLine(122, 184, 142, 184, 5, greenDark);
}

function createIco() {
  drawBookIcon();

  const xorBytes = SIZE * SIZE * 4;
  const maskStride = Math.ceil(SIZE / 32) * 4;
  const maskBytes = maskStride * SIZE;
  const dibBytes = 40 + xorBytes + maskBytes;
  const ico = Buffer.alloc(6 + 16 + dibBytes);
  let offset = 0;

  ico.writeUInt16LE(0, offset);
  offset += 2;
  ico.writeUInt16LE(1, offset);
  offset += 2;
  ico.writeUInt16LE(1, offset);
  offset += 2;
  ico.writeUInt8(0, offset);
  offset += 1;
  ico.writeUInt8(0, offset);
  offset += 1;
  ico.writeUInt8(0, offset);
  offset += 1;
  ico.writeUInt8(0, offset);
  offset += 1;
  ico.writeUInt16LE(1, offset);
  offset += 2;
  ico.writeUInt16LE(32, offset);
  offset += 2;
  ico.writeUInt32LE(dibBytes, offset);
  offset += 4;
  ico.writeUInt32LE(22, offset);
  offset += 4;
  ico.writeUInt32LE(40, offset);
  offset += 4;
  ico.writeInt32LE(SIZE, offset);
  offset += 4;
  ico.writeInt32LE(SIZE * 2, offset);
  offset += 4;
  ico.writeUInt16LE(1, offset);
  offset += 2;
  ico.writeUInt16LE(32, offset);
  offset += 2;
  ico.writeUInt32LE(0, offset);
  offset += 4;
  ico.writeUInt32LE(xorBytes, offset);
  offset += 4;
  ico.writeInt32LE(2835, offset);
  offset += 4;
  ico.writeInt32LE(2835, offset);
  offset += 4;
  ico.writeUInt32LE(0, offset);
  offset += 4;
  ico.writeUInt32LE(0, offset);
  offset += 4;

  for (let y = SIZE - 1; y >= 0; y -= 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const source = (y * SIZE + x) * 4;

      ico.writeUInt8(pixels[source + 2], offset);
      offset += 1;
      ico.writeUInt8(pixels[source + 1], offset);
      offset += 1;
      ico.writeUInt8(pixels[source], offset);
      offset += 1;
      ico.writeUInt8(pixels[source + 3], offset);
      offset += 1;
    }
  }

  return ico;
}

const outputDir = path.join(__dirname, "..", "build");

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, "icon.ico"), createIco());
console.log("Generated build/icon.ico");

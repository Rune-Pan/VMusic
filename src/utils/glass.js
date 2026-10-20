// Web approximation of Liquid Glass. The map contains geometry, never remote image pixels.
export function createLensMap(width, height, radius = 28) {
  const scale = Math.min(1, 480 / Math.max(width, height))
  const w = Math.max(2, Math.round(width * scale))
  const h = Math.max(2, Math.round(height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const context = canvas.getContext('2d')
  if (!context) return ''
  const pixels = context.createImageData(w, h)
  const r = Math.min(radius * scale, w / 2, h / 2)
  const edge = Math.max(3, 18 * scale)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const qx = Math.abs(x - w / 2) - (w / 2 - r)
      const qy = Math.abs(y - h / 2) - (h / 2 - r)
      const ax = Math.max(qx, 0)
      const ay = Math.max(qy, 0)
      const length = Math.hypot(ax, ay)
      const distance = length + Math.min(Math.max(qx, qy), 0) - r
      const bend = Math.pow(Math.max(0, 1 - Math.abs(distance) / edge), 2)
      const nx = length
        ? (ax / length) * Math.sign(x - w / 2)
        : qx > qy
          ? Math.sign(x - w / 2)
          : 0
      const ny = length
        ? (ay / length) * Math.sign(y - h / 2)
        : qy >= qx
          ? Math.sign(y - h / 2)
          : 0
      const index = (y * w + x) * 4
      pixels.data[index] = 128 + nx * bend * 115
      pixels.data[index + 1] = 128 + ny * bend * 115
      pixels.data[index + 2] = 128
      pixels.data[index + 3] = 255
    }
  }
  context.putImageData(pixels, 0, 0)
  return canvas.toDataURL()
}

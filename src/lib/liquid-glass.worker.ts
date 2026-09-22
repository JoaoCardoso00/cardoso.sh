// Builds and encodes the glass maps off the main thread. A slider drag asks
// for a new set on every tick; doing the pixel loops and PNG encoding here
// keeps the page responsive while it catches up.
import { renderGlassMaps } from './liquid-glass'
import type { Bitmap, GlassMapRequest } from './liquid-glass'

function encode({ data, width, height }: Bitmap) {
  const canvas = new OffscreenCanvas(width, height)
  canvas.getContext('2d')!.putImageData(new ImageData(data, width, height), 0, 0)
  return canvas.convertToBlob()
}

self.onmessage = async (e: MessageEvent<GlassMapRequest>) => {
  const { taps, rim, specular, glow, ...layout } = renderGlassMaps(e.data)
  const [tapBlobs, rimBlob, specularBlob, glowBlob] = await Promise.all([
    Promise.all(taps.map(encode)),
    encode(rim),
    encode(specular),
    encode(glow),
  ])
  self.postMessage({ ...layout, taps: tapBlobs, rim: rimBlob, specular: specularBlob, glow: glowBlob })
}

// Builds the bitmaps that drive the liquid glass effect: displacement maps for
// the refraction, a rim mask for anti-aliasing, and specular and glow maps for
// the highlights. All come from a rounded-rectangle signed distance field.
//
// The glass is modelled as a slab with a flat interior and a curved rim (the
// "bezel"). A ray coming straight down hits the curved rim, bends by Snell's
// law, travels through the glass and lands on the content underneath some
// distance away from where it entered. That landing offset, per pixel, is what
// feDisplacementMap needs: where to sample the backdrop from.
//
// The offset only depends on the distance from the edge, so it is solved once
// per distance and then painted around the shape.

export type Profile = 'convex' | 'squircle' | 'concave' | 'lip'

export interface GlassShape {
  width: number
  height: number
  radius: number
  // Width of the curved rim, in px. Beyond it the surface is flat.
  bezel: number
  // Glass thickness at the flat interior, in px. Sets how far a bent ray travels.
  thickness: number
  // Index of refraction. Glass is about 1.5, water 1.33, diamond 2.4.
  ior: number
  profile: Profile
  // Which way the rim bends the picture. "in" is a magnifier lying on the
  // content: rim pixels show what is further inside. "out" is a thick lens or
  // a glass sphere: exterior content gets squeezed into the rim, which is how
  // Apple's glass reads.
  pull: 'in' | 'out'
  // Uniform magnification of the interior. 1 is none.
  zoom: number
}

export interface GlassLight {
  // Direction the light comes from, in degrees. 0 is from the top.
  angle: number
  // How far the highlight reaches in from the edge, in px.
  width: number
}

export interface GlassMapRequest {
  shape: GlassShape
  light: GlassLight
  // Dispersion, as a fraction of the rim offset. 0 builds a single map.
  split: number
  // How far past the solved offsets the filter will sample, as a multiple.
  // It's the refraction strength. The margin around the maps has to cover it
  // or the rim reads transparent pixels.
  reach: number
  dpr: number
}

export interface Bitmap {
  data: Uint8ClampedArray<ArrayBuffer>
  width: number
  height: number
}

interface MapLayout {
  // Largest offset across all taps, in px. feDisplacementMap's scale is 2x
  // this because channel value 0 means -scale/2 and 255 means +scale/2.
  maxOffset: number
  // CSS size of the glass the maps were built for.
  width: number
  height: number
  // Extra margin around the displacement maps, in CSS px. The filtered layer
  // is this much larger than the glass on each side so rim pixels that sample
  // outside the shape still find backdrop there.
  pad: number
}

export interface GlassBitmaps extends MapLayout {
  // One displacement map per dispersion tap, in `dispersion` order.
  taps: Bitmap[]
  // Alpha mask over the rim, for the anti-aliasing blur.
  rim: Bitmap
  specular: Bitmap
  glow: Bitmap
}

// Same as GlassBitmaps, encoded to image URLs.
export interface GlassMaps extends MapLayout {
  taps: string[]
  rim: string
  specular: string
  glow: string
}

// Dispersion taps, from least bent to most. `t` scales the split: a tap's rim
// offset is multiplied by 1 + t * split. Each tap keeps a share of every
// channel and the shares of each channel add up to 1, so where the taps agree
// the colour comes back unchanged. Where they disagree the edge fans out red
// to violet instead of splitting into three hard copies.
export const dispersion = [
  { t: -1, r: 0.45, g: 0, b: 0 },
  { t: -0.5, r: 0.35, g: 0.2, b: 0.05 },
  { t: 0, r: 0.15, g: 0.6, b: 0.15 },
  { t: 0.5, r: 0.05, g: 0.2, b: 0.35 },
  { t: 1, r: 0, g: 0, b: 0.45 },
]

function smootherstep(x: number) {
  const t = Math.min(1, Math.max(0, x))
  return t * t * t * (t * (t * 6 - 15) + 10)
}

// Rim height as a function of normalized distance from the edge. x=0 is the
// outer edge, x=1 is where the flat interior begins. Output is 0..1 and gets
// multiplied by the thickness.
export const profiles: Record<Profile, (x: number) => number> = {
  // Quarter circle. Steep at the edge, so the strongest pull is right at the rim.
  convex: (x) => Math.sqrt(1 - (1 - x) ** 2),
  // Quarter squircle. Flatter for longer, then a quick drop at the very edge.
  // Closest to how Apple's glass reads.
  squircle: (x) => (1 - (1 - x) ** 4) ** 0.25,
  // Bowl. Rays spread outward instead of pulling inward.
  concave: (x) => 1 - Math.sqrt(1 - (1 - x) ** 2),
  // Raised ring with a lower centre. Pulls in at the outer rim, pushes out
  // where it dips back down.
  lip: (x) => Math.sqrt(1 - (1 - x) ** 2) * (1 - 0.35 * smootherstep(x)),
}

// Landing offset of a vertical ray entering the rim at normalized distance x.
// Positive means the ray landed further inside the glass than it entered.
function rayOffset(x: number, shape: GlassShape) {
  const f = profiles[shape.profile]
  const d = 0.001
  const slope = ((f(Math.min(1, x + d)) - f(Math.max(0, x - d))) / (2 * d)) * (shape.thickness / shape.bezel)

  // Angle between the incoming ray and the surface normal.
  const incidence = Math.atan(Math.abs(slope))
  const refraction = Math.asin(Math.sin(incidence) / shape.ior)
  // The ray now travels through the glass tilted by this much off vertical.
  const deviation = incidence - refraction
  const height = shape.thickness * f(x)
  // A surface rising toward the centre bends the ray inward. Falling, outward.
  return Math.sign(slope) * height * Math.tan(deviation)
}

const SAMPLES = 256

export function solveRim(shape: GlassShape) {
  const table = new Float32Array(SAMPLES)
  let max = 0
  for (let i = 0; i < SAMPLES; i++) {
    const x = i / (SAMPLES - 1)
    table[i] = rayOffset(x, shape)
    max = Math.max(max, Math.abs(table[i]))
  }
  return { table, max }
}

function bitmap(width: number, height: number): Bitmap {
  return { data: new Uint8ClampedArray(width * height * 4), width, height }
}

// Pure pixel work, no DOM, so it can run in a worker.
export function renderGlassMaps({ shape, light, split, reach, dpr }: GlassMapRequest): GlassBitmaps {
  const width = Math.max(1, Math.round(shape.width))
  const height = Math.max(1, Math.round(shape.height))
  const taps = split > 0 ? dispersion.map((d) => 1 + d.t * split) : [1]

  const { table, max: rimMax } = solveRim(shape)
  const radius = Math.min(shape.radius, width / 2, height / 2)
  const halfW = width / 2
  const halfH = height / 2
  // Half the box with the corners cut off. Distance to this inner box plus
  // the radius gives the rounded rectangle's signed distance.
  const innerW = halfW - radius
  const innerH = halfH - radius
  const zoomShift = 1 / shape.zoom - 1
  const zoomMax = Math.abs(zoomShift) * Math.hypot(halfW, halfH)
  // Room for the largest offset once scaled by the filter, rounded up.
  const pad = Math.ceil((rimMax * Math.max(...taps) + zoomMax) * Math.max(1, reach)) + 2

  // Chromium samples the displaced backdrop with nearest neighbour and scales
  // the map bitmap to device pixels. A map built at CSS resolution turns into
  // 1px stair steps along the curved edge, so build it at device resolution.
  const dpw = Math.round((width + pad * 2) * dpr)
  const dph = Math.round((height + pad * 2) * dpr)
  // The interior zoom and the rim bend are kept apart: only the rim disperses.
  // Splitting the zoom too would fringe every edge in the middle of the glass,
  // which Apple's never does.
  const zx = new Float32Array(dpw * dph)
  const zy = new Float32Array(dpw * dph)
  const rx = new Float32Array(dpw * dph)
  const ry = new Float32Array(dpw * dph)

  const spw = Math.round(width * dpr)
  const sph = Math.round(height * dpr)
  const rim = bitmap(spw, sph)
  const specular = bitmap(spw, sph)
  const glow = bitmap(spw, sph)

  // Unit vector toward the light, CSS coordinates (y down).
  const a = (light.angle * Math.PI) / 180
  const lx = Math.sin(a)
  const ly = -Math.cos(a)

  // Outward direction and distance from the edge for a point relative to the
  // glass centre, in CSS px.
  function edge(cx: number, cy: number) {
    const qx = Math.abs(cx) - innerW
    const qy = Math.abs(cy) - innerH
    if (qx > 0 && qy > 0) {
      const len = Math.hypot(qx, qy)
      return { dirX: (qx / len) * Math.sign(cx), dirY: (qy / len) * Math.sign(cy), inset: radius - len }
    }
    if (qx > qy) return { dirX: Math.sign(cx), dirY: 0, inset: radius - qx }
    return { dirX: 0, dirY: Math.sign(cy), inset: radius - qy }
  }

  // A positive ray offset lands further inside, so sample inward. "out"
  // flips it and the rim gathers exterior content instead.
  const sign = shape.pull === 'in' ? -1 : 1
  for (let py = 0; py < dph; py++) {
    for (let px = 0; px < dpw; px++) {
      const k = py * dpw + px
      const cx = (px + 0.5) / dpr - pad - halfW
      const cy = (py + 0.5) / dpr - pad - halfH
      const { dirX, dirY, inset } = edge(cx, cy)
      if (inset <= 0) continue
      // Interior zoom. Sampling closer to the centre makes the picture larger.
      zx[k] = cx * zoomShift
      zy[k] = cy * zoomShift
      if (inset < shape.bezel) {
        const offset = sign * table[Math.round((inset / shape.bezel) * (SAMPLES - 1))]
        rx[k] = dirX * offset
        ry[k] = dirY * offset
      }
    }
  }

  // Every tap shares one encoding so the filter can use a single scale.
  let max = 0
  for (const m of taps) {
    for (let k = 0; k < zx.length; k++) max = Math.max(max, Math.hypot(zx[k] + rx[k] * m, zy[k] + ry[k] * m))
  }
  // A flat slab has no offsets. Avoid dividing by zero below.
  const norm = max || 1
  const maps = taps.map((m) => {
    const map = bitmap(dpw, dph)
    const d = map.data
    for (let k = 0; k < zx.length; k++) {
      // Neutral gray. 128 is "no displacement" for both channels.
      d[k * 4] = 128 + ((zx[k] + rx[k] * m) / norm) * 127
      d[k * 4 + 1] = 128 + ((zy[k] + ry[k] * m) / norm) * 127
      d[k * 4 + 3] = 255
    }
    return map
  })

  // Rim mask: full across the bezel, fading out just past it so the blur has
  // no visible seam where the surface goes flat.
  //
  // Specular: bright where the edge normal faces the light, and almost as
  // bright on the far side where the light leaves the glass. Apple draws both
  // diagonals; the sides between them fade out. Fades in from the edge over
  // `light.width` and is anti-aliased over the outer pixel.
  //
  // Glow uses the same lobes but spreads over the whole bezel. It's the milky
  // band inside the edge of Control Center buttons: the curved rim reflects
  // more of the room than the flat top does.
  const reachIn = Math.max(light.width, shape.bezel * 1.2)
  for (let py = 0; py < sph; py++) {
    for (let px = 0; px < spw; px++) {
      const i = (py * spw + px) * 4
      const cx = (px + 0.5) / dpr - halfW
      const cy = (py + 0.5) / dpr - halfH
      const { dirX, dirY, inset } = edge(cx, cy)
      if (inset <= 0 || inset >= reachIn) continue
      const facing = dirX * lx + dirY * ly
      const lobes = Math.max(0, facing) ** 2 + 0.8 * Math.max(0, -facing) ** 2
      const coverage = Math.min(1, inset * dpr)

      rim.data[i + 3] = 255 * Math.min(1, (1.2 - inset / shape.bezel) / 0.3)

      if (inset < light.width) {
        // A faint floor keeps a hairline around the whole shape, like Apple does.
        const lit = 0.08 + 0.92 * lobes
        const falloff = 1 - smootherstep(inset / light.width)
        specular.data.fill(255, i, i + 3)
        specular.data[i + 3] = 255 * lit * falloff * coverage
      }

      if (inset < shape.bezel) {
        const t = 1 - smootherstep(inset / shape.bezel)
        glow.data.fill(255, i, i + 3)
        glow.data[i + 3] = 255 * t * t * (0.35 + 0.65 * lobes) * coverage
      }
    }
  }

  return { taps: maps, rim, specular, glow, maxOffset: max, width, height, pad }
}

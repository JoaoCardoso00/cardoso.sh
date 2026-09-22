// Builds the two bitmaps that drive the liquid glass effect: a displacement
// map for the refraction and a specular map for the rim highlight. Both come
// from one pass over a rounded-rectangle signed distance field.
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

export interface GlassMaps {
  displacement: string
  specular: string
  // Largest offset in the map, in px. feDisplacementMap's scale is 2x this
  // because channel value 0 means -scale/2 and 255 means +scale/2.
  maxOffset: number
  // CSS size of the glass the maps were built for.
  width: number
  height: number
  // Extra margin around the displacement map, in CSS px. The filtered layer is
  // this much larger than the glass on each side so rim pixels that sample
  // outside the shape still find backdrop there.
  pad: number
}

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

export function buildGlassMaps(shape: GlassShape, light: GlassLight): GlassMaps {
  const width = Math.max(1, Math.round(shape.width))
  const height = Math.max(1, Math.round(shape.height))
  // Chromium samples the displaced backdrop with nearest neighbour and scales
  // the map bitmap to device pixels. A map built at CSS resolution turns into
  // 1px stair steps along the curved edge, so build it at device resolution.
  const dpr = Math.min(3, window.devicePixelRatio || 1)

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
  // Room for the largest offset plus the chromatic split, rounded up.
  const pad = Math.ceil((rimMax + zoomMax) * 1.3) + 2

  const dw = width + pad * 2
  const dh = height + pad * 2
  const dpw = Math.round(dw * dpr)
  const dph = Math.round(dh * dpr)
  const disp = document.createElement('canvas')
  disp.width = dpw
  disp.height = dph
  const dctx = disp.getContext('2d')!
  const dimg = dctx.createImageData(dpw, dph)
  const dd = dimg.data
  // Offsets are gathered first so the encoding can be normalized to the real
  // maximum, then written in a second pass.
  const vx = new Float32Array(dpw * dph)
  const vy = new Float32Array(dpw * dph)
  let max = 0

  const spw = Math.round(width * dpr)
  const sph = Math.round(height * dpr)
  const spec = document.createElement('canvas')
  spec.width = spw
  spec.height = sph
  const sctx = spec.getContext('2d')!
  const simg = sctx.createImageData(spw, sph)
  const sd = simg.data

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

  for (let py = 0; py < dph; py++) {
    for (let px = 0; px < dpw; px++) {
      const k = py * dpw + px
      const cx = (px + 0.5) / dpr - pad - halfW
      const cy = (py + 0.5) / dpr - pad - halfH
      const { dirX, dirY, inset } = edge(cx, cy)
      if (inset <= 0) continue

      // Interior zoom. Sampling closer to the centre makes the picture larger.
      let x = cx * zoomShift
      let y = cy * zoomShift

      if (inset < shape.bezel) {
        const offset = table[Math.round((inset / shape.bezel) * (SAMPLES - 1))]
        // A positive ray offset lands further inside, so sample inward. "out"
        // flips it and the rim gathers exterior content instead.
        const sign = shape.pull === 'in' ? -1 : 1
        x += sign * dirX * offset
        y += sign * dirY * offset
      }

      vx[k] = x
      vy[k] = y
      max = Math.max(max, Math.hypot(x, y))
    }
  }

  // A flat slab has no offsets. Avoid dividing by zero below.
  const norm = max || 1
  for (let py = 0; py < dph; py++) {
    for (let px = 0; px < dpw; px++) {
      const k = py * dpw + px
      const i = k * 4
      // Neutral gray. 128 is "no displacement" for both channels. Blue is a
      // rim mask the filter uses to confine its anti-aliasing blur.
      dd[i] = Math.round(128 + (vx[k] / norm) * 127)
      dd[i + 1] = Math.round(128 + (vy[k] / norm) * 127)
      dd[i + 3] = 255

      const cx = (px + 0.5) / dpr - pad - halfW
      const cy = (py + 0.5) / dpr - pad - halfH
      const { inset } = edge(cx, cy)
      // Full across the bezel, fading out just past it so the blur has no
      // visible seam where the surface goes flat.
      if (inset > 0 && inset < shape.bezel * 1.2) {
        dd[i + 2] = Math.round(255 * Math.min(1, (1.2 - inset / shape.bezel) / 0.3))
      }
    }
  }

  // Specular. Bright where the edge normal faces the light, with a weaker
  // echo on the far side where light leaves the glass. Fades in from the edge
  // over `light.width` and is anti-aliased over the outer pixel.
  for (let py = 0; py < sph; py++) {
    for (let px = 0; px < spw; px++) {
      const i = (py * spw + px) * 4
      const cx = (px + 0.5) / dpr - halfW
      const cy = (py + 0.5) / dpr - halfH
      const { dirX, dirY, inset } = edge(cx, cy)
      if (inset <= 0 || inset >= light.width) continue
      const facing = dirX * lx + dirY * ly
      // A faint floor keeps a hairline around the whole shape, like Apple does.
      const lit = 0.05 + 0.95 * (Math.max(0, facing) ** 2 + 0.4 * Math.max(0, -facing) ** 2)
      const falloff = 1 - smootherstep(inset / light.width)
      const coverage = Math.min(1, inset * dpr)
      sd[i] = 255
      sd[i + 1] = 255
      sd[i + 2] = 255
      sd[i + 3] = Math.round(255 * lit * falloff * coverage)
    }
  }

  dctx.putImageData(dimg, 0, 0)
  sctx.putImageData(simg, 0, 0)
  return {
    displacement: disp.toDataURL('image/png'),
    specular: spec.toDataURL('image/png'),
    maxOffset: max,
    width,
    height,
    pad,
  }
}

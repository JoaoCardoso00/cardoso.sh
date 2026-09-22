import { createElement, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { dispersion } from '#/lib/liquid-glass'
import type { GlassLight, GlassMapRequest, GlassMaps, GlassShape } from '#/lib/liquid-glass'

export interface GlassOptics {
  // Multiplies the physically solved offsets. 1 is the raw Snell result.
  strength: number
  // Tiny blur over the rim only, after displacement, in px. Chromium samples
  // the displaced backdrop with nearest neighbour, which shows as speckle where
  // the rim compresses and duplicated rows where it stretches. The interior is
  // never blurred.
  edgeSoftness: number
  // Blur of the whole backdrop, in px. 0 is Apple's clear glass, 20+ a sheet.
  frost: number
  // Split between the red and blue rim offsets, as a fraction of the offset.
  // Real glass bends blue more than red, which shows as colour fringes.
  aberration: number
  // 1 is untouched. Apple pushes the backdrop past 1 so colours bleed through.
  saturation: number
}

export interface GlassSurface {
  // Fill laid over the refracted backdrop. Alpha is the amount of frosting.
  tint: string
  // Brightness of the rim highlight, 0..1.
  specular: number
  // How far the highlight reaches in from the edge, in px.
  specularWidth: number
  // Brightness of the milky sheen across the bezel, 0..1.
  glow: number
  // Angle the light comes from, in degrees. 0 is from the top.
  lightAngle: number
  // Opacity of the drop shadow under the glass, 0..1.
  shadow: number
}

export interface GlassLayers {
  refraction: boolean
  frost: boolean
  aberration: boolean
  saturation: boolean
  tint: boolean
  specular: boolean
  glow: boolean
  shadow: boolean
}

export const defaultShape: GlassShape = {
  width: 320,
  height: 180,
  radius: 48,
  bezel: 22,
  thickness: 36,
  ior: 1.5,
  profile: 'squircle',
  pull: 'out',
  zoom: 1.06,
}

export const defaultOptics: GlassOptics = {
  strength: 1,
  edgeSoftness: 0.5,
  frost: 0,
  aberration: 0.3,
  saturation: 1.3,
}

export const defaultSurface: GlassSurface = {
  tint: 'rgba(255, 255, 255, 0.06)',
  specular: 0.85,
  specularWidth: 2.5,
  glow: 0.3,
  lightAngle: 315,
  shadow: 0.25,
}

export const defaultLayers: GlassLayers = {
  refraction: true,
  frost: true,
  aberration: true,
  saturation: true,
  tint: true,
  specular: true,
  glow: true,
  shadow: true,
}

// SVG filters as backdrop-filter are a Chromium extension. WebKit and Gecko
// parse the declaration and then render nothing, so we have to sniff.
export function useSupportsBackdropSvg() {
  const [supported, setSupported] = useState<boolean | null>(null)
  useEffect(() => {
    setSupported('chrome' in window)
  }, [])
  return supported
}

type EncodedMaps = Omit<GlassMaps, 'taps' | 'rim' | 'specular' | 'glow'> & {
  taps: Blob[]
  rim: Blob
  specular: Blob
  glow: Blob
}

function revoke(maps: GlassMaps) {
  for (const url of [...maps.taps, maps.rim, maps.specular, maps.glow]) URL.revokeObjectURL(url)
}

// Maps are built in a worker. Only one request is in flight at a time; while
// it runs, newer requests replace each other and only the latest is sent. A
// slider drag produces one map per worker round trip instead of a backlog.
export function useGlassMaps(shape: GlassShape, light: GlassLight, split: number, strength: number) {
  const [maps, setMaps] = useState<GlassMaps | null>(null)
  const worker = useRef<Worker | null>(null)
  const busy = useRef(false)
  const next = useRef<GlassMapRequest | null>(null)

  function send(request: GlassMapRequest) {
    if (busy.current) {
      next.current = request
      return
    }
    busy.current = true
    next.current = null
    worker.current!.postMessage(request)
  }

  useEffect(() => {
    const w = new Worker(new URL('../lib/liquid-glass.worker.ts', import.meta.url), { type: 'module' })
    worker.current = w
    busy.current = false
    next.current = null
    w.onmessage = ({ data }: MessageEvent<EncodedMaps>) => {
      setMaps({
        ...data,
        taps: data.taps.map((b) => URL.createObjectURL(b)),
        rim: URL.createObjectURL(data.rim),
        specular: URL.createObjectURL(data.specular),
        glow: URL.createObjectURL(data.glow),
      })
      busy.current = false
      if (next.current) send(next.current)
    }
    return () => w.terminate()
  }, [])

  // Runs after the next set has been committed, so nothing still points at them.
  useEffect(
    () => () => {
      if (maps) revoke(maps)
    },
    [maps],
  )

  // Strength only changes the margin. Rounding it up to half steps keeps the
  // strength slider from rebuilding the maps on every tick.
  const reach = Math.max(1, Math.ceil(strength * 2) / 2)
  useEffect(() => {
    send({ shape, light, split, reach, dpr: Math.min(3, window.devicePixelRatio || 1) })
  }, [
    shape.width,
    shape.height,
    shape.radius,
    shape.bezel,
    shape.thickness,
    shape.ior,
    shape.profile,
    shape.pull,
    shape.zoom,
    light.angle,
    light.width,
    split,
    reach,
  ])
  return maps
}

// Scales the colour channels, keeps alpha.
const weigh = ({ r, g, b }: { r: number; g: number; b: number }) =>
  `${r} 0 0 0 0  0 ${g} 0 0 0  0 0 ${b} 0 0  0 0 0 1 0`

type Primitive = [tag: string, attrs: Record<string, string | number>]

// The filter graph as a flat list, so the live filter and the markup shown in
// the sandbox can't drift apart.
//
// Chromium turns the graph into a tree: a result used twice is computed twice,
// along with everything that feeds it. So every input that fans out here is a
// leaf (SourceGraphic or an feImage), and everything that would be shared,
// like the frost blur, the rim blur and the saturation, is done in CSS around
// the url() instead. That took the default glass from ~58ms a frame to <8ms.
function primitives(maps: GlassMaps, optics: GlassOptics, layers: GlassLayers, href: (i: number) => string): Primitive[] {
  const scale = layers.refraction ? +(maps.maxOffset * 2 * optics.strength).toFixed(2) : 0
  const list: Primitive[] = []
  // One displacement map per tap, each with its own share of the spectrum.
  // The maps already carry the extra bend per tap, so they share one scale.
  maps.taps.forEach((_, i) => {
    list.push(
      [
        'feImage',
        {
          href: href(i),
          x: 0,
          y: 0,
          width: maps.width + maps.pad * 2,
          height: maps.height + maps.pad * 2,
          preserveAspectRatio: 'none',
          result: `map${i}`,
        },
      ],
      [
        'feDisplacementMap',
        {
          in: 'SourceGraphic',
          in2: `map${i}`,
          scale,
          xChannelSelector: 'R',
          yChannelSelector: 'G',
          result: `shift${i}`,
        },
      ],
    )
    if (maps.taps.length === 1) return
    list.push(['feColorMatrix', { in: `shift${i}`, type: 'matrix', values: weigh(dispersion[i]), result: `tap${i}` }])
    if (i > 0) {
      const prev = i === 1 ? 'tap0' : `sum${i - 1}`
      list.push(['feComposite', { in: prev, in2: `tap${i}`, operator: 'arithmetic', k2: 1, k3: 1, result: `sum${i}` }])
    }
  })
  return list
}

export function RefractionFilter({
  id,
  maps,
  optics,
  layers,
}: {
  id: string
  maps: GlassMaps
  optics: GlassOptics
  layers: GlassLayers
}) {
  return (
    // Zero size but not display:none. Chromium drops filters whose SVG is hidden.
    <svg className="pointer-events-none absolute size-0" aria-hidden>
      <filter id={id} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        {primitives(maps, optics, layers, (i) => maps.taps[i]).map(([tag, attrs], i) =>
          createElement(tag, { key: i, ...attrs }),
        )}
      </filter>
    </svg>
  )
}

// The backdrop-filter declaration. Frost runs before the SVG filter and
// saturation after it, both as CSS functions: Chromium computes each once and
// hands the result along, where inside the SVG they'd be redone per tap.
function backdropFilter(url: string | null, optics: GlassOptics, layers: GlassLayers) {
  const parts: string[] = []
  if (layers.frost && optics.frost > 0) parts.push(`blur(${optics.frost}px)`)
  if (url) parts.push(url)
  if (layers.saturation && optics.saturation !== 1) parts.push(`saturate(${optics.saturation})`)
  return parts.join(' ') || 'none'
}

// Same filter as markup, for reading and pasting into the article.
export function filterMarkup(id: string, maps: GlassMaps, optics: GlassOptics, layers: GlassLayers) {
  const body = primitives(maps, optics, layers, (i) => `map-${i}.png`).map(
    ([tag, attrs]) =>
      `  <${tag} ${Object.entries(attrs)
        .map(([k, v]) => `${k}="${v}"`)
        .join(' ')} />`,
  )
  return [
    `/* backdrop-filter: ${backdropFilter(`url(#${id})`, optics, layers)}; */`,
    `<filter id="${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">`,
    ...body,
    `</filter>`,
  ].join('\n')
}

export function LiquidGlass({
  shape,
  optics,
  surface,
  layers,
  supported,
  maps,
  style,
  className = '',
  children,
}: {
  shape: GlassShape
  optics: GlassOptics
  surface: GlassSurface
  layers: GlassLayers
  // null while unknown (before hydration). false switches to the blur fallback.
  supported: boolean | null
  maps: GlassMaps | null
  style?: CSSProperties
  className?: string
  children?: ReactNode
}) {
  const id = useId().replace(/:/g, '')
  const filterId = `glass-${id}`
  const ready = supported === true && maps !== null

  // Without SVG backdrop filters this is the blur fallback. No refraction.
  const backdrop = useMemo(
    () => backdropFilter(ready ? `url(#${filterId})` : null, optics, layers),
    [ready, filterId, optics, layers],
  )

  const radius = Math.min(shape.radius, shape.width / 2, shape.height / 2)

  const shadow = layers.shadow
    ? `0 ${Math.round(shape.thickness / 2)}px ${shape.thickness * 1.5}px rgba(0,0,0,${surface.shadow}), 0 1px 2px rgba(0,0,0,${surface.shadow / 2})`
    : 'none'

  return (
    <div
      className={`relative ${className}`}
      style={{ width: shape.width, height: shape.height, borderRadius: radius, ...style }}
    >
      {ready && <RefractionFilter id={filterId} maps={maps} optics={optics} layers={layers} />}

      {/* Clips the oversized filter layer to the glass shape. */}
      <div className="absolute inset-0 isolate overflow-hidden" style={{ borderRadius: radius }}>
        {/* 1. Refracted backdrop. The whole liquid part lives in this one declaration.
            The layer extends past the glass by `pad` so rim pixels that sample
            outward still have backdrop to read; the parent clips the excess. */}
        <div
          className="absolute"
          style={{
            inset: ready ? -maps.pad : 0,
            backdropFilter: backdrop,
            WebkitBackdropFilter: backdrop,
          }}
        />

        {/* 2. Rim softening. A plain CSS blur of what's under it, the refracted
            layer included, masked to the rim. The compositor does this in one
            cheap pass; the same thing inside the SVG filter would recompute
            the whole displacement graph for each input that reads it. */}
        {ready && layers.refraction && optics.edgeSoftness > 0 && (
          <div
            className="absolute inset-0"
            style={{
              backdropFilter: `blur(${optics.edgeSoftness}px)`,
              WebkitBackdropFilter: `blur(${optics.edgeSoftness}px)`,
              maskImage: `url(${maps.rim})`,
              maskSize: '100% 100%',
            }}
          />
        )}

        {/* 3. Tint. A flat fill that makes the glass read as a material, not a hole. */}
        {layers.tint && <div className="absolute inset-0" style={{ background: surface.tint }} />}

        {/* 4. Glow. A soft sheen across the bezel, strongest on the lit diagonals.
            No mix-blend-mode on this or the specular: in Chromium any blended
            sibling makes the group a backdrop root and the refraction vanishes. */}
        {layers.glow && maps && (
          <div
            className="absolute inset-0"
            style={{
              opacity: surface.glow,
              backgroundImage: `url(${maps.glow})`,
              backgroundSize: '100% 100%',
            }}
          />
        )}

        {/* 5. Specular rim. Painted per pixel from the edge normals, so it brightens
            where the edge faces the light, echoes on the far side and fades along
            the straight runs instead of drawing a border. */}
        {layers.specular && maps && (
          <div
            className="absolute inset-0"
            style={{
              opacity: surface.specular,
              backgroundImage: `url(${maps.specular})`,
              backgroundSize: '100% 100%',
            }}
          />
        )}
      </div>

      {/* 6. Drop shadow. Painted after the filter layer on purpose: anything
          painted before it becomes part of the backdrop, and a rim that samples
          outward would drag the shadow in as a dark ring. */}
      {layers.shadow && (
        <div className="pointer-events-none absolute inset-0" style={{ borderRadius: radius, boxShadow: shadow }} />
      )}

      <div className="relative h-full w-full" style={{ borderRadius: radius }}>
        {children}
      </div>
    </div>
  )
}

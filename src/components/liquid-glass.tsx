import { useEffect, useId, useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { buildGlassMaps } from '#/lib/liquid-glass'
import type { GlassLight, GlassMaps, GlassShape } from '#/lib/liquid-glass'

export interface GlassOptics {
  // Multiplies the physically solved offsets. 1 is the raw Snell result.
  strength: number
  // Tiny blur applied to the rim only, before and after displacement.
  // Chromium samples the displaced backdrop with nearest neighbour: where the
  // rim compresses that shows as speckle (the pre-blur fixes it), where it
  // stretches it shows as duplicated rows (the post-blur fixes it). The
  // interior is never blurred.
  edgeSoftness: number
  // Blur of the whole backdrop, in px. 0 is Apple's clear glass, 20+ a sheet.
  frost: number
  // Split between the red and blue displacement, as a fraction of the scale.
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
  edgeSoftness: 1,
  frost: 0,
  aberration: 0.1,
  saturation: 1.3,
}

export const defaultSurface: GlassSurface = {
  tint: 'rgba(255, 255, 255, 0.06)',
  specular: 0.7,
  specularWidth: 2.5,
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

export function useGlassMaps(shape: GlassShape, light: GlassLight) {
  const [maps, setMaps] = useState<GlassMaps | null>(null)
  useEffect(() => {
    setMaps(buildGlassMaps(shape, light))
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
  ])
  return maps
}

// Keeps only one colour channel and the alpha.
const keepR = '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0'
const keepG = '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0'
const keepB = '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0'
// Turns the map's blue channel into alpha, everything else black.
const blueToAlpha = '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 1 0 0'

interface FilterPlan {
  scale: number
  edge: number
  frost: number
  split: number
  saturation: number
}

function plan(maps: GlassMaps, optics: GlassOptics, layers: GlassLayers): FilterPlan {
  return {
    scale: layers.refraction ? maps.maxOffset * 2 * optics.strength : 0,
    edge: layers.refraction ? optics.edgeSoftness : 0,
    frost: layers.frost ? optics.frost : 0,
    split: layers.aberration ? optics.aberration : 0,
    saturation: layers.saturation ? optics.saturation : 1,
  }
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
  const p = plan(maps, optics, layers)
  // Name of the image that feeds the displacement passes.
  const prepared = p.frost > 0 ? 'frosted' : p.edge > 0 ? 'softened' : 'SourceGraphic'

  return (
    // Zero size but not display:none. Chromium drops filters whose SVG is hidden.
    <svg className="pointer-events-none absolute size-0" aria-hidden>
      <filter id={id} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feImage
          href={maps.displacement}
          x="0"
          y="0"
          width={maps.width + maps.pad * 2}
          height={maps.height + maps.pad * 2}
          preserveAspectRatio="none"
          result="map"
        />
        {p.edge > 0 && (
          <>
            {/* Blur only where the rim mask says so. Interior stays untouched. */}
            <feColorMatrix in="map" type="matrix" values={blueToAlpha} result="rim" />
            <feGaussianBlur in="SourceGraphic" stdDeviation={p.edge} result="blurred" />
            <feComposite in="blurred" in2="rim" operator="in" result="rimBlurred" />
            <feComposite in="SourceGraphic" in2="rim" operator="out" result="interior" />
            {/* The two parts are complementary cuts of the same mask, so add them.
                "over" would leave a dip in alpha where the mask fades. */}
            <feComposite in="rimBlurred" in2="interior" operator="arithmetic" k2="1" k3="1" result="softened" />
          </>
        )}
        {p.frost > 0 && (
          <feGaussianBlur in={p.edge > 0 ? 'softened' : 'SourceGraphic'} stdDeviation={p.frost} result="frosted" />
        )}
        {p.split > 0 ? (
          <>
            <feDisplacementMap
              in={prepared}
              in2="map"
              scale={p.scale * (1 - p.split)}
              xChannelSelector="R"
              yChannelSelector="G"
              result="dr"
            />
            <feDisplacementMap
              in={prepared}
              in2="map"
              scale={p.scale}
              xChannelSelector="R"
              yChannelSelector="G"
              result="dg"
            />
            <feDisplacementMap
              in={prepared}
              in2="map"
              scale={p.scale * (1 + p.split)}
              xChannelSelector="R"
              yChannelSelector="G"
              result="db"
            />
            <feColorMatrix in="dr" type="matrix" values={keepR} result="r" />
            <feColorMatrix in="dg" type="matrix" values={keepG} result="g" />
            <feColorMatrix in="db" type="matrix" values={keepB} result="b" />
            {/* Add the three single-channel images back together. */}
            <feComposite in="r" in2="g" operator="arithmetic" k2="1" k3="1" result="rg" />
            <feComposite in="rg" in2="b" operator="arithmetic" k2="1" k3="1" result="refracted" />
          </>
        ) : (
          <feDisplacementMap
            in={prepared}
            in2="map"
            scale={p.scale}
            xChannelSelector="R"
            yChannelSelector="G"
            result="refracted"
          />
        )}
        {p.edge > 0 && (
          <>
            {/* Same trick after displacement, to smooth the duplicated rows. */}
            <feGaussianBlur in="refracted" stdDeviation={p.edge * 0.8} result="refractedBlurred" />
            <feComposite in="refractedBlurred" in2="rim" operator="in" result="rimOut" />
            <feComposite in="refracted" in2="rim" operator="out" result="interiorOut" />
            <feComposite in="rimOut" in2="interiorOut" operator="arithmetic" k2="1" k3="1" result="smoothed" />
          </>
        )}
        <feColorMatrix in={p.edge > 0 ? 'smoothed' : 'refracted'} type="saturate" values={String(p.saturation)} />
      </filter>
    </svg>
  )
}

// Same filter as markup, for reading and pasting into the article.
export function filterMarkup(id: string, maps: GlassMaps, optics: GlassOptics, layers: GlassLayers) {
  const p = plan(maps, optics, layers)
  const prepared = p.frost > 0 ? 'frosted' : p.edge > 0 ? 'softened' : 'SourceGraphic'
  const px = (n: number) => n.toFixed(2)
  const lines = [
    `<filter id="${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">`,
    `  <feImage href="data:image/png;base64,…" x="0" y="0" width="${maps.width + maps.pad * 2}" height="${maps.height + maps.pad * 2}" preserveAspectRatio="none" result="map" />`,
  ]
  if (p.edge > 0) {
    lines.push(
      `  <feColorMatrix in="map" type="matrix" values="${blueToAlpha}" result="rim" />`,
      `  <feGaussianBlur in="SourceGraphic" stdDeviation="${p.edge}" result="blurred" />`,
      `  <feComposite in="blurred" in2="rim" operator="in" result="rimBlurred" />`,
      `  <feComposite in="SourceGraphic" in2="rim" operator="out" result="interior" />`,
      `  <feComposite in="rimBlurred" in2="interior" operator="arithmetic" k2="1" k3="1" result="softened" />`,
    )
  }
  if (p.frost > 0) {
    lines.push(
      `  <feGaussianBlur in="${p.edge > 0 ? 'softened' : 'SourceGraphic'}" stdDeviation="${p.frost}" result="frosted" />`,
    )
  }
  if (p.split > 0) {
    lines.push(
      `  <feDisplacementMap in="${prepared}" in2="map" scale="${px(p.scale * (1 - p.split))}" xChannelSelector="R" yChannelSelector="G" result="dr" />`,
      `  <feDisplacementMap in="${prepared}" in2="map" scale="${px(p.scale)}" xChannelSelector="R" yChannelSelector="G" result="dg" />`,
      `  <feDisplacementMap in="${prepared}" in2="map" scale="${px(p.scale * (1 + p.split))}" xChannelSelector="R" yChannelSelector="G" result="db" />`,
      `  <feColorMatrix in="dr" type="matrix" values="${keepR}" result="r" />`,
      `  <feColorMatrix in="dg" type="matrix" values="${keepG}" result="g" />`,
      `  <feColorMatrix in="db" type="matrix" values="${keepB}" result="b" />`,
      `  <feComposite in="r" in2="g" operator="arithmetic" k2="1" k3="1" result="rg" />`,
      `  <feComposite in="rg" in2="b" operator="arithmetic" k2="1" k3="1" result="refracted" />`,
    )
  } else {
    lines.push(
      `  <feDisplacementMap in="${prepared}" in2="map" scale="${px(p.scale)}" xChannelSelector="R" yChannelSelector="G" result="refracted" />`,
    )
  }
  if (p.edge > 0) {
    lines.push(
      `  <feGaussianBlur in="refracted" stdDeviation="${p.edge * 0.8}" result="refractedBlurred" />`,
      `  <feComposite in="refractedBlurred" in2="rim" operator="in" result="rimOut" />`,
      `  <feComposite in="refracted" in2="rim" operator="out" result="interiorOut" />`,
      `  <feComposite in="rimOut" in2="interiorOut" operator="arithmetic" k2="1" k3="1" result="smoothed" />`,
    )
  }
  lines.push(
    `  <feColorMatrix in="${p.edge > 0 ? 'smoothed' : 'refracted'}" type="saturate" values="${p.saturation}" />`,
    `</filter>`,
  )
  return lines.join('\n')
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

  const backdrop = useMemo(() => {
    if (ready) return `url(#${filterId})`
    // Fallback for browsers without SVG backdrop filters. No refraction.
    const parts: string[] = []
    if (layers.frost && optics.frost > 0) parts.push(`blur(${optics.frost}px)`)
    if (layers.saturation) parts.push(`saturate(${optics.saturation})`)
    return parts.join(' ') || 'none'
  }, [ready, filterId, layers.frost, layers.saturation, optics.frost, optics.saturation])

  const radius = Math.min(shape.radius, shape.width / 2, shape.height / 2)
  const a = (surface.lightAngle * Math.PI) / 180
  // Unit vector pointing toward the light, in CSS coordinates (y down).
  const lx = Math.sin(a)
  const ly = -Math.cos(a)

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

        {/* 2. Tint. A flat fill that makes the glass read as a material, not a hole. */}
        {layers.tint && <div className="absolute inset-0" style={{ background: surface.tint }} />}

        {/* 3. Specular rim. Painted per pixel from the edge normals, so it brightens
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

        {/* 4. Inner glow. Soft light bleeding in from the lit edge. */}
        {layers.specular && (
          <div
            className="absolute inset-0"
            style={{
              borderRadius: radius,
              boxShadow: `inset ${(lx * shape.bezel) / 4}px ${(ly * shape.bezel) / 4}px ${shape.bezel / 2}px -${shape.bezel / 4}px rgba(255,255,255,${surface.specular * 0.06})`,
            }}
          />
        )}
      </div>

      {/* 5. Drop shadow. Painted after the filter layer on purpose: anything
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

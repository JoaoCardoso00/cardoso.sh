import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  LiquidGlass,
  defaultLayers,
  defaultOptics,
  defaultShape,
  defaultSurface,
  filterMarkup,
  useGlassMaps,
  useSupportsBackdropSvg,
} from '#/components/liquid-glass'
import type { GlassLayers, GlassOptics, GlassSurface } from '#/components/liquid-glass'
import type { GlassShape, Profile } from '#/lib/liquid-glass'

export const Route = createFileRoute('/lab/liquid-glass')({
  head: () => ({ meta: [{ title: 'Liquid glass sandbox | Cardoso' }] }),
  component: Sandbox,
})

const profiles: Profile[] = ['squircle', 'convex', 'concave', 'lip']

const tints = {
  clear: 'rgba(255, 255, 255, 0)',
  light: 'rgba(255, 255, 255, 0.08)',
  frost: 'rgba(255, 255, 255, 0.25)',
  dark: 'rgba(0, 0, 0, 0.18)',
  accent: 'rgba(255, 59, 31, 0.18)',
} as const

// Starting points, each matched against a screenshot of iOS 26.
const presets = {
  card: { shape: defaultShape, optics: defaultOptics, surface: defaultSurface },
  // The selected-tab lens in the tab bar while you drag it. Clear, magnifying,
  // with a thick rim that folds the outside in and splits it into a rainbow.
  pill: {
    shape: { ...defaultShape, width: 180, height: 104, radius: 52, bezel: 20, thickness: 48, zoom: 1.16 },
    optics: { ...defaultOptics, aberration: 0.5 },
    surface: { ...defaultSurface, tint: tints.clear, glow: 0.2, specular: 0.95 },
  },
  // A Control Center toggle. Frosted and saturated, with a wide milky rim.
  button: {
    shape: { ...defaultShape, width: 120, height: 120, radius: 60, bezel: 28, thickness: 32, zoom: 1.08 },
    optics: { ...defaultOptics, frost: 5, aberration: 0.15, saturation: 1.6 },
    surface: { ...defaultSurface, tint: tints.light, glow: 0.5, specular: 0.8 },
  },
} as const

// What each layer contributes. Doubles as the outline for the article.
const layerNotes: Record<keyof GlassLayers, string> = {
  refraction:
    'feDisplacementMap driven by a map solved with Snell\'s law. With "out" the rim squeezes exterior content into the edge like a glass sphere, which is how Apple\'s reads; "in" is a magnifier on paper. Chromium only through backdrop-filter: url().',
  frost:
    'A CSS blur() placed before the url() in the same backdrop-filter, so it runs once instead of once per tap. Apple uses none on clear controls and a lot on sheets. Separate from this, a masked CSS backdrop blur over the rim hides the speckle and row duplication from Chromium\'s nearest-neighbour sampling.',
  aberration:
    'Five displacement maps, one per tap, each with the rim offset bent a little more than the last. Each tap keeps a share of the spectrum and they add back together, so the rim fans red to violet. Only the rim offset is split, so the flat interior stays clean.',
  saturation: 'CSS saturate() after the url(), above 1. The backdrop colours bleed into the glass more than they would through a neutral filter.',
  tint: 'A flat translucent fill over the refracted backdrop. Alpha is how frosted the material feels.',
  specular:
    'A bitmap painted from the edge normals: bright where the rim faces the light, nearly as bright on the far side, fading along the sides.',
  glow: 'The same two lobes spread across the whole bezel. The milky band inside the edge of Control Center buttons.',
  shadow: 'A soft drop shadow tied to the thickness. Lifts the glass off the content so the refraction reads as depth.',
}

function Sandbox() {
  const [shape, setShape] = useState<GlassShape>(defaultShape)
  const [optics, setOptics] = useState<GlassOptics>(defaultOptics)
  const [surface, setSurface] = useState<GlassSurface>(defaultSurface)
  const [layers, setLayers] = useState<GlassLayers>(defaultLayers)
  const [scene, setScene] = useState<SceneKind>('mixed')
  const [animate, setAnimate] = useState(false)
  const [showMap, setShowMap] = useState(false)
  const [showCode, setShowCode] = useState(false)

  const supported = useSupportsBackdropSvg()
  const maps = useGlassMaps(
    shape,
    { angle: surface.lightAngle, width: surface.specularWidth },
    layers.refraction && layers.aberration ? optics.aberration : 0,
    optics.strength,
  )

  const patch =
    <T,>(set: React.Dispatch<React.SetStateAction<T>>) =>
    <K extends keyof T>(key: K, value: T[K]) =>
      set((prev) => ({ ...prev, [key]: value }))
  const setS = patch(setShape)
  const setO = patch(setOptics)
  const setF = patch(setSurface)

  function reset() {
    setShape(defaultShape)
    setOptics(defaultOptics)
    setSurface(defaultSurface)
    setLayers(defaultLayers)
  }

  function applyPreset(name: keyof typeof presets) {
    setShape(presets[name].shape)
    setOptics(presets[name].optics)
    setSurface(presets[name].surface)
  }

  return (
    <div className="flex min-h-dvh w-full bg-bg text-fg">
      <div className="relative min-h-dvh flex-1 overflow-hidden">
        <Scene kind={scene} animate={animate} />
        <Draggable>
          <LiquidGlass shape={shape} optics={optics} surface={surface} layers={layers} supported={supported} maps={maps}>
            <div className="flex h-full items-center justify-center px-6 text-center text-[15px]/5.5 font-medium tracking-[-0.01em] text-white [text-shadow:0_1px_2px_rgba(0,0,0,.35)] select-none">
              Drag me
            </div>
          </LiquidGlass>
        </Draggable>

        {supported === false && (
          <p className="absolute top-4 left-4 max-w-sm rounded-md bg-black/70 px-3 py-2 text-[13px]/5 text-white backdrop-blur">
            This browser can't run SVG filters in backdrop-filter, so you're seeing the blur fallback. Open it in
            Chrome, Edge, Arc or Brave for the refraction.
          </p>
        )}
      </div>

      <aside className="flex h-dvh w-84 shrink-0 flex-col gap-6 overflow-y-auto border-l border-line/40 bg-bg px-5 py-5 text-[13px]/5">
        <div className="flex items-baseline justify-between">
          <h1 className="font-medium tracking-[-0.01em]">Liquid glass</h1>
          <button type="button" onClick={reset} className="cursor-pointer text-muted hover:text-fg">
            reset
          </button>
        </div>

        <Section title="Scene">
          <Segmented value={scene} options={['mixed', 'text', 'grid', 'photo', 'tabbar']} onChange={setScene} />
          <Toggle label="Animate background" checked={animate} onChange={setAnimate} />
        </Section>

        <Section title="Preset">
          <Segmented
            value={(Object.keys(presets) as (keyof typeof presets)[]).find((k) => presets[k].shape === shape) ?? 'custom'}
            options={['card', 'pill', 'button', 'custom'] as const}
            onChange={(k) => k !== 'custom' && applyPreset(k)}
          />
        </Section>

        <Section title="Shape">
          <Range label="Width" value={shape.width} min={80} max={640} step={2} onChange={(v) => setS('width', v)} />
          <Range label="Height" value={shape.height} min={48} max={480} step={2} onChange={(v) => setS('height', v)} />
          <Range label="Radius" value={shape.radius} min={0} max={240} onChange={(v) => setS('radius', v)} />
        </Section>

        <Section title="Glass">
          <Segmented value={shape.profile} options={profiles} onChange={(v) => setS('profile', v)} />
          <Segmented value={shape.pull} options={['out', 'in'] as const} onChange={(v) => setS('pull', v)} />
          <Range label="Zoom" value={shape.zoom} min={0.8} max={1.4} step={0.01} onChange={(v) => setS('zoom', v)} />
          <Range label="Bezel width" value={shape.bezel} min={2} max={160} onChange={(v) => setS('bezel', v)} />
          <Range label="Thickness" value={shape.thickness} min={0} max={120} onChange={(v) => setS('thickness', v)} />
          <Range label="Refractive index" value={shape.ior} min={1} max={2.5} step={0.01} onChange={(v) => setS('ior', v)} />
          <Range label="Strength" value={optics.strength} min={0} max={3} step={0.05} onChange={(v) => setO('strength', v)} />
          {maps && (
            <p className="text-muted">
              Max offset {maps.maxOffset.toFixed(1)}px · filter scale {(maps.maxOffset * 2 * optics.strength).toFixed(1)} ·
              pad {maps.pad}px
            </p>
          )}
        </Section>

        <Section title="Optics">
          <Range label="Edge softness" value={optics.edgeSoftness} min={0} max={3} step={0.1} onChange={(v) => setO('edgeSoftness', v)} />
          <Range label="Frost" value={optics.frost} min={0} max={30} step={0.5} onChange={(v) => setO('frost', v)} />
          <Range label="Aberration" value={optics.aberration} min={0} max={0.6} step={0.01} onChange={(v) => setO('aberration', v)} />
          <Range label="Saturation" value={optics.saturation} min={0} max={3} step={0.05} onChange={(v) => setO('saturation', v)} />
        </Section>

        <Section title="Surface">
          <Segmented
            value={(Object.keys(tints) as (keyof typeof tints)[]).find((k) => tints[k] === surface.tint) ?? 'light'}
            options={Object.keys(tints) as (keyof typeof tints)[]}
            onChange={(k) => setF('tint', tints[k])}
          />
          <Range label="Specular" value={surface.specular} min={0} max={1} step={0.05} onChange={(v) => setF('specular', v)} />
          <Range label="Glow" value={surface.glow} min={0} max={1} step={0.05} onChange={(v) => setF('glow', v)} />
          <Range label="Rim width" value={surface.specularWidth} min={1} max={24} step={0.5} onChange={(v) => setF('specularWidth', v)} />
          <Range label="Light angle" value={surface.lightAngle} min={0} max={360} step={5} onChange={(v) => setF('lightAngle', v)} />
          <Range label="Shadow" value={surface.shadow} min={0} max={1} step={0.05} onChange={(v) => setF('shadow', v)} />
        </Section>

        <Section title="Layers">
          {(Object.keys(layers) as (keyof GlassLayers)[]).map((key) => (
            <div key={key} className="flex flex-col gap-1">
              <Toggle
                label={key}
                checked={layers[key]}
                onChange={(v) => setLayers((prev) => ({ ...prev, [key]: v }))}
              />
              <p className="pl-6 text-[12px]/4.5 text-muted">{layerNotes[key]}</p>
            </div>
          ))}
        </Section>

        <Section title="Under the hood">
          <Toggle label="Show displacement map" checked={showMap} onChange={setShowMap} />
          {showMap && maps && (
            <div className="flex flex-col gap-1.5">
              <img
                src={maps.taps[maps.taps.length >> 1]}
                alt="Displacement map"
                width={maps.width}
                height={maps.height}
                className="max-w-full rounded border border-line/40"
              />
              <p className="text-muted">
                The middle dispersion tap. Red is the horizontal offset, green the vertical, 128 is no movement.
                The other taps differ only on the rim.
              </p>
              <img
                src={maps.specular}
                alt="Specular map"
                width={maps.width}
                height={maps.height}
                className="max-w-full rounded border border-line/40 bg-[#333]"
              />
              <p className="text-muted">Specular map. White with alpha, laid over the glass as a background image.</p>
              <img
                src={maps.glow}
                alt="Glow map"
                width={maps.width}
                height={maps.height}
                className="max-w-full rounded border border-line/40 bg-[#333]"
              />
              <p className="text-muted">Glow map. Same lobes as the specular, spread over the bezel.</p>
            </div>
          )}
          <Toggle label="Show filter markup" checked={showCode} onChange={setShowCode} />
          {showCode && maps && (
            <pre className="overflow-x-auto rounded border border-line/40 p-3 font-mono text-[11px]/4 text-muted">
              {filterMarkup('liquid-glass', maps, optics, layers)}
            </pre>
          )}
        </Section>
      </aside>
    </div>
  )
}

// Pointer drag with no library. Position is kept in a ref and written straight
// to the transform so the displacement map does not rebuild while moving.
function Draggable({ children }: { children: ReactNode }) {
  const el = useRef<HTMLDivElement>(null)
  const pos = useRef({ x: 120, y: 160 })
  const grab = useRef<{ dx: number; dy: number } | null>(null)

  useEffect(() => {
    el.current!.style.transform = `translate(${pos.current.x}px, ${pos.current.y}px)`
  }, [])

  return (
    <div
      ref={el}
      className="absolute top-0 left-0 cursor-grab touch-none active:cursor-grabbing"
      onPointerDown={(e) => {
        grab.current = { dx: e.clientX - pos.current.x, dy: e.clientY - pos.current.y }
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        if (!grab.current) return
        pos.current = { x: e.clientX - grab.current.dx, y: e.clientY - grab.current.dy }
        e.currentTarget.style.transform = `translate(${pos.current.x}px, ${pos.current.y}px)`
      }}
      onPointerUp={() => {
        grab.current = null
      }}
    >
      {children}
    </div>
  )
}

type SceneKind = 'mixed' | 'text' | 'grid' | 'photo' | 'tabbar'

const tabs = [
  { label: 'Atualizações', badge: null },
  { label: 'Ligações', badge: '2' },
  { label: 'Comunidades', badge: null },
  { label: 'Conversas', badge: '54' },
  { label: 'Você', badge: null },
]

// Backdrops with hard edges and fine detail, where refraction is easy to read.
function Scene({ kind, animate }: { kind: SceneKind; animate: boolean }) {
  const drift = animate ? 'animate-[drift_14s_ease-in-out_infinite_alternate]' : ''

  if (kind === 'tabbar') {
    return (
      <div className={`absolute inset-0 bg-[#0b0b0b] ${drift}`}>
        <style>{keyframes}</style>
        {/* Messy chat content behind the bar, blurred the way iOS blurs it. */}
        <div className="absolute inset-x-0 top-0 flex flex-col gap-6 p-12 text-[28px]/9 font-semibold text-white/80 blur-[6px]">
          <p>COMUNIDADE LÉPRE</p>
          <p className="text-white/40">Novo grupo adicionado a "LÉPRE"</p>
          <p className="text-white/40">Você entrou usando o link de convite</p>
        </div>
        {/* The bar. Dark glass with white glyphs and green badges. */}
        <div className="absolute top-1/2 left-1/2 flex h-[100px] w-[760px] -translate-1/2 items-center justify-around rounded-full bg-[#2a2a2c]/90 px-6 shadow-[0_8px_30px_rgba(0,0,0,.5)]">
          {tabs.map((tab) => (
            <div key={tab.label} className="relative flex flex-col items-center gap-2">
              <div className="relative size-8 rounded-lg border-2 border-white">
                {tab.badge && (
                  <span className="absolute -top-2 -right-4 rounded-full bg-[#30d158] px-1.5 text-[13px]/5 font-semibold text-black">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[15px]/5 font-medium text-white">{tab.label}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (kind === 'text') {
    return (
      <div className={`absolute inset-0 bg-[#f4f1ea] p-12 text-[#1a1a1a] ${drift}`}>
        <style>{keyframes}</style>
        <p className="font-serif text-[120px]/[0.95] tracking-[-0.03em] italic">
          Glass bends light. The rim bends it most.
        </p>
        <div className="mt-10 columns-3 gap-8 text-[14px]/6">
          {Array.from({ length: 6 }, (_, i) => (
            <p key={i} className="mb-4">
              {lorem}
            </p>
          ))}
        </div>
      </div>
    )
  }

  if (kind === 'grid') {
    return (
      <div
        className={`absolute inset-0 bg-[#111] ${drift}`}
        style={{
          backgroundImage:
            'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px), linear-gradient(#222 1px, transparent 1px), linear-gradient(90deg, #222 1px, transparent 1px)',
          backgroundSize: '80px 80px, 80px 80px, 16px 16px, 16px 16px',
        }}
      >
        <style>{keyframes}</style>
        <div className="absolute top-1/2 left-1/2 flex -translate-1/2 gap-6">
          {['#ff3b1f', '#ffd60a', '#30d158', '#0a84ff', '#bf5af2'].map((c) => (
            <div key={c} className="size-24 rounded-full" style={{ background: c }} />
          ))}
        </div>
      </div>
    )
  }

  if (kind === 'photo') {
    return (
      <div className={`absolute inset-0 ${drift}`}>
        <style>{keyframes}</style>
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(60% 80% at 20% 30%, #ff9f0a 0%, transparent 60%), radial-gradient(50% 60% at 80% 20%, #bf5af2 0%, transparent 60%), radial-gradient(70% 70% at 60% 80%, #0a84ff 0%, transparent 60%), radial-gradient(40% 50% at 30% 85%, #30d158 0%, transparent 60%), #1c1c1e',
          }}
        />
        <div className="absolute right-[12%] bottom-[18%] h-64 w-[38%] rounded-2xl bg-white/90" />
        <div className="absolute top-[14%] left-[10%] h-3 w-[30%] rounded-full bg-white" />
      </div>
    )
  }

  return (
    <div className={`absolute inset-0 bg-[#0a0a0a] ${drift}`}>
      <style>{keyframes}</style>
      {/* Stripes. Straight lines show the bend better than anything else. */}
      <div
        className="absolute inset-x-0 top-0 h-[38%]"
        style={{ background: 'repeating-linear-gradient(90deg, #fff 0 14px, #0a0a0a 14px 28px)' }}
      />
      <div
        className="absolute inset-x-0 top-[38%] h-[6%]"
        style={{ background: 'repeating-linear-gradient(0deg, #ff3b1f 0 4px, #0a0a0a 4px 8px)' }}
      />
      <div className="absolute top-[47%] left-12 font-serif text-[96px]/none tracking-[-0.03em] text-white italic">
        Liquid glass, on the web
      </div>
      <div className="absolute top-[66%] left-12 flex gap-4">
        {['#ff3b1f', '#ffd60a', '#30d158', '#0a84ff', '#bf5af2', '#ffffff'].map((c) => (
          <div key={c} className="size-20 rounded-2xl" style={{ background: c }} />
        ))}
      </div>
      <div className="absolute top-[82%] left-12 max-w-3xl columns-2 gap-8 text-[13px]/5 text-white/80">
        <p>{lorem}</p>
      </div>
      <div
        className="absolute right-0 bottom-0 h-[50%] w-[35%]"
        style={{
          background:
            'conic-gradient(from 0deg, #ff3b1f, #ffd60a, #30d158, #0a84ff, #bf5af2, #ff3b1f)',
        }}
      />
    </div>
  )
}

const keyframes = `@keyframes drift { from { translate: 0 0 } to { translate: -120px 60px } }`

const lorem =
  'Refraction is what makes glass look like glass. A flat pane barely bends light, but wherever the surface curves, the picture behind it slides sideways. Apple leans on that at the rim of every control, and it is the part that cannot be faked with a blur.'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="text-[11px]/4 font-medium tracking-[0.06em] text-muted uppercase">{title}</h2>
      {children}
    </section>
  )
}

function Range({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex justify-between">
        <span>{label}</span>
        <span className="font-mono text-muted tabular-nums">{Number.isInteger(step) ? value : value.toFixed(2)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 w-full cursor-pointer appearance-none rounded-full bg-line/50 accent-fg"
      />
    </label>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-3.5 accent-fg" />
      <span className="capitalize">{label}</span>
    </label>
  )
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: readonly T[]
  onChange: (value: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`cursor-pointer rounded-md border px-2.5 py-1 capitalize transition-colors ${
            option === value ? 'border-fg bg-fg text-bg' : 'border-line/50 text-muted hover:text-fg'
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  )
}

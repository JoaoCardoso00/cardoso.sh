type Theme = 'light' | 'dark'

export function ThemeToggle({ label }: { label: string }) {
  function toggle() {
    const root = document.documentElement
    const next: Theme = root.dataset.theme === 'light' ? 'dark' : 'light'
    const apply = () => {
      root.dataset.theme = next
      localStorage.setItem('theme', next)
      // Dark theme wears the knocked-out plate, light theme the bare letter.
      document.getElementById('favicon')?.setAttribute('href', `/favicon-${next}.svg`)
    }

    // The page crossfade is the feedback, so the icon itself stays still.
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce || !document.startViewTransition) apply()
    else document.startViewTransition(apply)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      className="relative flex h-6.5 w-6.5 shrink-0 cursor-pointer items-center justify-end text-muted transition-[color,scale] duration-150 ease-out hover:text-fg active:scale-[0.97]"
    >
      {/* Meets the 48px touch minimum without enlarging the visible control. */}
      <span
        aria-hidden
        className="absolute top-1/2 left-1/2 size-[max(100%,3rem)] -translate-1/2 pointer-fine:hidden"
      />
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.2" />
        <path d="M8 1A7 7 0 0 1 8 15Z" fill="currentColor" />
      </svg>
    </button>
  )
}

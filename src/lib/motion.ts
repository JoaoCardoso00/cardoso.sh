import { useEffect, useState } from 'react'
import type { Variants } from 'motion/react'

// Strong ease-out. Entrances start fast and settle slowly.
export const easeOut = [0.19, 1, 0.22, 1] as const

// Page entrance. The parent staggers, each child rises 6px while it fades in.
export const page: Variants = {
  hidden: {},
  visible: { transition: { delayChildren: 0.06, staggerChildren: 0.06 } },
}

export const item: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: easeOut } },
}

// Least important content only fades, it does not move.
export const fade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.6, ease: easeOut } },
}

// The entrance waits for the webfonts. `font-display: swap` paints the fallback
// face first, and the real face then reflows the line, which is visible because
// the statement is `text-balance` and rewraps as a whole. Fading in after the
// swap hides it.
export function useFontsReady() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!document.fonts) {
      setReady(true)
      return
    }

    let live = true
    const done = () => {
      if (live) setReady(true)
    }

    document.fonts.ready.then(done)
    // A font that never arrives must not leave the page blank.
    const timeout = setTimeout(done, 800)

    return () => {
      live = false
      clearTimeout(timeout)
    }
  }, [])

  return ready
}

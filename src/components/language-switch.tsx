import { Link } from '@tanstack/react-router'
import type { Locale } from '#/lib/i18n'
import { copy, toParam } from '#/lib/i18n'

// One control, not two links. Tapping anywhere on it switches to the other language,
// so there is a single target instead of two ~20px ones sitting side by side.
// Navigating through a View Transition gives the same crossfade as the theme toggle.
export function LanguageSwitch({ locale }: { locale: Locale }) {
  const other: Locale = locale === 'en' ? 'pt' : 'en'

  return (
    <Link
      to="."
      params={(prev) => ({ ...prev, locale: toParam(other) })}
      hrefLang={other}
      viewTransition
      aria-label={copy[locale].switchTo}
      resetScroll={false}
      className="relative flex items-center gap-1.5 font-mono text-[14px]/4 transition-colors duration-150 sm:text-[13px]/4"
    >
      {/* Meets the 48px touch minimum without enlarging the visible control. */}
      <span
        aria-hidden
        className="absolute top-1/2 left-1/2 size-[max(100%,3rem)] -translate-1/2 pointer-fine:hidden"
      />
      <span className={locale === 'en' ? 'text-fg' : 'text-muted'}>EN</span>
      <span aria-hidden className="text-line">
        /
      </span>
      <span className={locale === 'pt' ? 'text-fg' : 'text-muted'}>PT</span>
    </Link>
  )
}

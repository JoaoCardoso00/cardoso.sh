import { Link } from '@tanstack/react-router'
import { motion } from 'motion/react'
import type { Locale } from '#/lib/i18n'
import { copy, toParam } from '#/lib/i18n'
import { item, useFontsReady } from '#/lib/motion'
import { LanguageSwitch } from './language-switch'
import { ThemeToggle } from './theme-toggle'

const nameClass = 'text-[17px]/6.5 font-medium tracking-[-0.01em] text-fg'

export function Header({
  locale,
  subtitle,
}: {
  locale: Locale
  // Set on inner pages. The name becomes a link back to the home page.
  subtitle?: string
}) {
  const t = copy[locale]
  const fontsReady = useFontsReady()

  return (
    // Animates on its own so a language change replays the content, not the header.
    <motion.header
      variants={item}
      initial="hidden"
      animate={fontsReady ? 'visible' : 'hidden'}
      className="flex w-full items-start justify-between"
    >
      {subtitle ? (
        <div className="flex flex-col gap-0.5">
          <Link
            to="/{-$locale}"
            params={{ locale: toParam(locale) }}
            viewTransition
            aria-label={t.back}
            className={`group/back flex items-center gap-2 ${nameClass}`}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden
              className="text-muted transition-[translate,color] duration-200 ease-out-expo group-hover/back:-translate-x-0.5 group-hover/back:text-fg"
            >
              <path d="M12 7H2M2 7L6 3M2 7L6 11" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            {t.title}
          </Link>
          <h1 className="pl-5.5 text-[17px]/6.5 font-normal tracking-[-0.005em] text-muted">{subtitle}</h1>
        </div>
      ) : (
        <h1 className={nameClass}>{t.title}</h1>
      )}
      <div className="flex h-6.5 shrink-0 items-center gap-3.5">
        <LanguageSwitch locale={locale} />
        <ThemeToggle label={t.themeLabel} />
      </div>
    </motion.header>
  )
}

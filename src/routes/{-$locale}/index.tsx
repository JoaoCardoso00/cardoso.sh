import { Link, createFileRoute } from '@tanstack/react-router'
import { motion } from 'motion/react'
import { Header } from '#/components/header'
import { ProjectList } from '#/components/project-list'
import { copy, social, toLocale, toParam, tucupy } from '#/lib/i18n'
import { fade, item, page, useFontsReady } from '#/lib/motion'
import { HOME_LIMIT, projects } from '#/lib/projects'
import { pageHead } from '#/lib/seo'

export const Route = createFileRoute('/{-$locale}/')({
  head: ({ params }) => pageHead('home', params.locale),
  component: Home,
})

function Home() {
  const locale = toLocale(Route.useParams().locale)
  const t = copy[locale]
  const listed = projects.slice(0, HOME_LIMIT)
  const fontsReady = useFontsReady()

  return (
    <div className="mx-auto flex w-full max-w-[728px] flex-col px-6 pt-20 pb-28 sm:pt-35 sm:pb-45">
      <Header locale={locale} />

      {/* Not keyed by locale: the View Transition crossfades the swap instead. */}
      <motion.main variants={page} initial="hidden" animate={fontsReady ? 'visible' : 'hidden'}>
        <section className="flex flex-col gap-6 pt-20 sm:pt-28">
          {/* Inline flow rather than flex, so the two faces rewrap as one sentence. */}
          <motion.p
            variants={item}
            className="text-[26px]/9 tracking-[-0.03em] text-balance text-fg sm:text-[30px]/11"
          >
            <span className="font-serif text-[30px]/9 tracking-[-0.01em] italic sm:text-[38px]/11">
              {t.statement[0]}
            </span>{' '}
            {t.statement[1]}
          </motion.p>
          <motion.p
            variants={item}
            className="max-w-150 text-[17px]/7 tracking-[-0.005em] text-muted"
          >
            {t.bio[0]}
            <a className="link" href={tucupy[locale]}>
              Tucupy
            </a>
            {t.bio[1]}
          </motion.p>
        </section>

        {listed.length > 0 && (
          <motion.section variants={item} className="flex flex-col pt-30">
            <h2 className="pb-5 font-mono text-[13px]/4 font-normal text-muted">{t.projects}</h2>
            <ProjectList projects={listed} locale={locale} />
            <Link
              to="/{-$locale}/projects"
              params={{ locale: toParam(locale) }}
              viewTransition
              className="group/all flex items-center gap-2 self-start pt-6.5 text-[17px]/6.5 tracking-[-0.01em]"
            >
              <span className="link">{t.seeAll}</span>
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                aria-hidden
                className="text-muted transition-[translate,color] duration-200 ease-out-expo group-hover/all:translate-x-0.5 group-hover/all:text-fg"
              >
                <path d="M2 7H12M12 7L8 3M12 7L8 11" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            </Link>
          </motion.section>
        )}

        {/* Least important block, so it fades without moving. */}
        <motion.p variants={fade} className="pt-30 text-[17px]/7 text-muted">
          {t.links[0]}
          <a className="link" href={social.github}>
            GitHub
          </a>
          {t.links[1]}
          <a className="link" href={social.x}>
            X
          </a>
          {t.links[2]}
          <a className="link" href={social.email}>
            {t.email}
          </a>
          {t.links[3]}
        </motion.p>
      </motion.main>
    </div>
  )
}

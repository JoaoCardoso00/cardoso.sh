import { createFileRoute } from '@tanstack/react-router'
import { motion } from 'motion/react'
import { Header } from '#/components/header'
import { ProjectWall } from '#/components/project-wall'
import { copy, toLocale } from '#/lib/i18n'
import { item, page, useFontsReady } from '#/lib/motion'
import { projects } from '#/lib/projects'
import { pageHead } from '#/lib/seo'

export const Route = createFileRoute('/{-$locale}/projects')({
  head: ({ params }) => pageHead('projects', params.locale),
  component: Projects,
})

function Projects() {
  const locale = toLocale(Route.useParams().locale)
  const t = copy[locale]
  const fontsReady = useFontsReady()

  return (
    <div className="flex w-full flex-col gap-16 p-6 sm:p-12">
      <Header locale={locale} subtitle={t.projects} />

      <motion.main variants={page} initial="hidden" animate={fontsReady ? 'visible' : 'hidden'}>
        {projects.length > 0 ? (
          <ProjectWall projects={projects} locale={locale} />
        ) : (
          <motion.p variants={item} className="pl-5.5 text-[17px]/7 text-muted">
            {t.noProjects}
          </motion.p>
        )}
      </motion.main>
    </div>
  )
}

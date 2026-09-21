import { motion } from 'motion/react'
import type { Locale } from '#/lib/i18n'
import type { Project } from '#/lib/projects'
import { item } from '#/lib/motion'

// Tile backgrounds stay fixed in both themes, like prints pinned to a wall.
const tones: Record<Project['tone'], { tile: string; title: string; date: string }> = {
  white: { tile: 'bg-[#FFFFFF]', title: 'text-[#111111]', date: 'text-[#6B6B6B]' },
  light: { tile: 'bg-[#EDEDED]', title: 'text-[#111111]', date: 'text-[#6B6B6B]' },
  grey: { tile: 'bg-[#DCDCDC]', title: 'text-[#111111]', date: 'text-[#6B6B6B]' },
  dark: { tile: 'bg-[#161616]', title: 'text-[#EDEDED]', date: 'text-[#8A8A8A]' },
}

export function ProjectWall({ projects, locale }: { projects: Project[]; locale: Locale }) {
  return (
    <div className="columns-1 gap-3 sm:columns-2 lg:columns-3">
      {projects.map((project) => {
        const tone = tones[project.tone]
        return (
          <motion.a
            key={project.slug}
            variants={item}
            href={project.href}
            // Pixel radius inline so motion never distorts it.
            style={{ borderRadius: 10 }}
            className={`group/tile mb-3 flex min-h-85 break-inside-avoid flex-col justify-between overflow-hidden px-6 py-5.5 ${tone.tile}`}
          >
            <span className="flex items-baseline justify-between text-[17px] tracking-[-0.01em]">
              <span className={tone.title}>{project.title}</span>
              <span className={tone.date}>{project.date[locale]}</span>
            </span>
            {project.image && (
              // The image scales, not the tile, so the hover target never moves.
              <img
                src={project.image.src}
                alt={project.image.alt[locale]}
                className="mt-10 w-full transition-[scale] duration-500 ease-out-expo group-hover/tile:scale-[1.02]"
              />
            )}
          </motion.a>
        )
      })}
    </div>
  )
}

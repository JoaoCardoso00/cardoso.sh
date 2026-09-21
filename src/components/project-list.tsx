import type { Locale } from '#/lib/i18n'
import type { Project } from '#/lib/projects'

// Hovering a row dims its siblings and shows a red dot in the margin.
// Hover runs tens of times a visit, so it stays in CSS and stays short.
export function ProjectList({ projects, locale }: { projects: Project[]; locale: Locale }) {
  return (
    <ul className="group/list flex flex-col">
      {projects.map((project) => (
        <li
          key={project.slug}
          className="transition-opacity duration-200 ease-out group-hover/list:opacity-45 hover:opacity-100!"
        >
          <a href={project.href} className="group/row relative flex flex-col gap-1 py-3.5">
            <span
              aria-hidden
              className="absolute top-[23px] -left-5 size-1.5 scale-50 rounded-full bg-accent opacity-0 transition-[opacity,scale] duration-200 ease-out-expo group-hover/row:scale-100 group-hover/row:opacity-100 group-focus-visible/row:scale-100 group-focus-visible/row:opacity-100"
            />
            <span className="flex items-baseline gap-3">
              <span className="text-[17px]/6.5 tracking-[-0.01em] text-fg">{project.title}</span>
              <span className="font-mono text-[13px]/4 text-muted">{project.year}</span>
            </span>
            <span className="text-[17px]/6.5 tracking-[-0.005em] text-muted transition-colors duration-200 group-hover/row:text-fg">
              {project.description[locale]}
            </span>
          </a>
        </li>
      ))}
    </ul>
  )
}

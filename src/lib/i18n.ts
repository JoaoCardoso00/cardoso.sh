export type Locale = 'en' | 'pt'

// The URL carries the locale: `/` is English, `/pt` is Portuguese.
export function toLocale(param: string | undefined): Locale {
  return param === 'pt' ? 'pt' : 'en'
}

export function toParam(locale: Locale): 'pt' | undefined {
  return locale === 'pt' ? 'pt' : undefined
}

export const copy = {
  en: {
    htmlLang: 'en',
    title: 'Cardoso',
    statement: ['Crafting', 'beautiful interfaces for the web.'],
    // Text before the Tucupy link, then text after it.
    bio: [
      'Experimenting with interaction and motion for great user experiences. Currently leading design and development at ',
      '.',
    ],
    projects: 'Projects',
    seeAll: 'See all projects',
    noProjects: 'Nothing here yet.',
    back: 'Back to home',
    links: ['Find me on ', ' and ', ', or send me an ', '.'],
    email: 'email',
    themeLabel: 'Switch theme',
    switchTo: 'Mudar para Português',
  },
  pt: {
    htmlLang: 'pt-BR',
    title: 'Cardoso',
    statement: ['Criando', 'interfaces incríveis para a web.'],
    bio: [
      'Trabalho com interação e animação para melhorar a experiência do usuário. Atualmente lidero design e desenvolvimento na ',
      '.',
    ],
    projects: 'Projetos',
    seeAll: 'Ver todos os projetos',
    noProjects: 'Nada por aqui ainda.',
    back: 'Voltar ao início',
    links: ['Estou no ', ' e no ', ', ou mande um ', '.'],
    email: 'email',
    themeLabel: 'Trocar tema',
    switchTo: 'Switch to English',
  },
} as const satisfies Record<Locale, unknown>

export const tucupy: Record<Locale, string> = {
  en: 'https://tucupy.com/en',
  pt: 'https://tucupy.com/pt',
}

export const social = {
  github: 'https://github.com/JoaoCardoso00',
  x: 'https://x.com/daarkeae',
  email: 'mailto:hi@cardoso.sh',
}

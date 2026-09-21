import { copy, social, toLocale } from './i18n'
import type { Locale } from './i18n'
import { projects } from './projects'

export const SITE_URL = 'https://cardoso.sh'
const SOCIAL_IMAGE_URL = `${SITE_URL}/og-cardoso.png`
const SOCIAL_IMAGE_ALT = 'Crafting beautiful interfaces for the web.'
const locales: Locale[] = ['en', 'pt']
type Page = 'home' | 'projects'

const metadata = {
  en: {
    home: {
      title: 'Cardoso | Web design & development',
      description:
        'I design and build interfaces for the web, with a focus on interaction and motion. Currently leading design and development at Tucupy.',
    },
    projects: {
      title: 'Projects | Cardoso',
      description:
        'Web design and development projects by Cardoso. Interfaces and experiments with interaction and motion.',
    },
    ogLocale: 'en_US',
  },
  pt: {
    home: {
      title: 'Cardoso | Design e desenvolvimento web',
      description:
        'Crio interfaces para a web, com foco em interação e animação. Atualmente lidero design e desenvolvimento na Tucupy.',
    },
    projects: {
      title: 'Projetos | Cardoso',
      description:
        'Projetos de design e desenvolvimento web de Cardoso. Interfaces e experimentos com interação e animação.',
    },
    ogLocale: 'pt_BR',
  },
} as const

function pageUrl(page: Page, locale: Locale) {
  const prefix = locale === 'pt' ? '/pt' : ''
  const path = page === 'projects' ? `${prefix}/projects` : prefix || '/'
  return `${SITE_URL}${path}`
}

function isIndexable(page: Page) {
  return page === 'home' || projects.length > 0
}

export function getSitemapUrls() {
  const pages: Page[] = ['home', 'projects']
  return pages.filter(isIndexable).flatMap((page) => locales.map((locale) => pageUrl(page, locale)))
}

export function pageHead(page: Page, localeParam?: string) {
  // Invalid locale routes keep the root's noindex fallback.
  if (localeParam !== undefined && localeParam !== 'pt') return {}

  const locale = toLocale(localeParam)
  const { title, description } = metadata[locale][page]
  const url = pageUrl(page, locale)
  const indexable = isIndexable(page)
  const personId = `${SITE_URL}/#person`
  const websiteId = `${SITE_URL}/#website`

  return {
    meta: [
      { title },
      { name: 'description', content: description },
      { name: 'author', content: 'Cardoso' },
      {
        name: 'robots',
        content: indexable ? 'index, follow, max-image-preview:large' : 'noindex, follow',
      },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: 'Cardoso' },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:url', content: url },
      { property: 'og:locale', content: metadata[locale].ogLocale },
      { property: 'og:locale:alternate', content: metadata[locale === 'en' ? 'pt' : 'en'].ogLocale },
      { property: 'og:image', content: SOCIAL_IMAGE_URL },
      { property: 'og:image:type', content: 'image/png' },
      { property: 'og:image:width', content: '1731' },
      { property: 'og:image:height', content: '909' },
      { property: 'og:image:alt', content: SOCIAL_IMAGE_ALT },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:creator', content: '@daarkeae' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: SOCIAL_IMAGE_URL },
      { name: 'twitter:image:alt', content: SOCIAL_IMAGE_ALT },
    ],
    links: [
      { rel: 'canonical', href: url },
      ...locales.map((alternate) => ({
        rel: 'alternate',
        hrefLang: copy[alternate].htmlLang,
        href: pageUrl(page, alternate),
      })),
      { rel: 'alternate', hrefLang: 'x-default', href: pageUrl(page, 'en') },
    ],
    scripts: indexable
      ? [
          {
            type: 'application/ld+json',
            children: JSON.stringify({
              '@context': 'https://schema.org',
              '@graph': [
                {
                  '@type': 'Person',
                  '@id': personId,
                  name: 'Cardoso',
                  url: `${SITE_URL}/`,
                  sameAs: [social.github, social.x],
                },
                {
                  '@type': 'WebSite',
                  '@id': websiteId,
                  name: 'Cardoso',
                  url: `${SITE_URL}/`,
                  inLanguage: locales.map((language) => copy[language].htmlLang),
                  publisher: { '@id': personId },
                },
                {
                  '@type': page === 'home' ? 'ProfilePage' : 'CollectionPage',
                  '@id': `${url}#webpage`,
                  url,
                  name: title,
                  description,
                  inLanguage: copy[locale].htmlLang,
                  isPartOf: { '@id': websiteId },
                  about: { '@id': personId },
                  ...(page === 'home' ? { mainEntity: { '@id': personId } } : {}),
                },
              ],
            }).replace(/</g, '\\u003c'),
          },
        ]
      : [],
  }
}

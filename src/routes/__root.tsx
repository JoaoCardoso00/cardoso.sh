import { HeadContent, Scripts, createRootRoute, useParams } from '@tanstack/react-router'
import { copy, toLocale } from '#/lib/i18n'

import appCss from '../styles.css?url'

// The three faces used above the fold. Preloading them starts the download
// with the HTML instead of after the stylesheet parses, so the text is drawn
// in its real font the first time rather than swapping a moment later.
import geist from '@fontsource-variable/geist/files/geist-latin-wght-normal.woff2?url'
import geistMono from '@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2?url'
import instrumentSerif from '@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff2?url'

const fontFiles = [geist, geistMono, instrumentSerif]

// Runs before first paint so neither the theme nor the favicon flashes.
// The favicon link sits above this script so getElementById can find it.
const bootScript = `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}document.documentElement.dataset.theme=t;var l=document.getElementById('favicon');if(l)l.setAttribute('href','/favicon-'+t+'.svg')}catch(e){}})()`

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Cardoso' },
      // Only recognized content pages opt into indexing through their own head.
      { name: 'robots', content: 'noindex, follow' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const params = useParams({ strict: false })
  const locale = toLocale(params.locale)

  return (
    <html lang={copy[locale].htmlLang} suppressHydrationWarning>
      <head>
        {/* First in the head, so the fonts do not queue behind the scripts. */}
        {fontFiles.map((href) => (
          <link
            key={href}
            rel="preload"
            as="font"
            type="font/woff2"
            // Fonts are fetched in CORS mode, so without this the browser downloads twice.
            crossOrigin="anonymous"
            href={href}
          />
        ))}
        {/* Defaults to the dark-theme mark, which is also the no-JS result. */}
        <link id="favicon" rel="icon" type="image/svg+xml" href="/favicon-dark.svg" />
        {/* Safari ignores SVG favicons and takes this instead. */}
        <link rel="icon" type="image/png" sizes="96x96" href="/favicon-96.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
        <HeadContent />
        <noscript>
          <style>{`header, main, main * { opacity: 1 !important; transform: none !important; }`}</style>
        </noscript>
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}

import { createFileRoute } from '@tanstack/react-router'
import { getSitemapUrls } from '#/lib/seo'

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: () => {
        const urls = getSitemapUrls().map((url) => `  <url><loc>${url}</loc></url>`)
        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`,
          { headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
        )
      },
    },
  },
})

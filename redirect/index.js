// joao-cardoso.com is the old portfolio domain. The new site is cardoso.sh and
// shares none of the old paths, so every request lands on the home page instead
// of a 404.
const TARGET = 'https://cardoso.sh/'

export default {
  fetch() {
    return Response.redirect(TARGET, 301)
  },
}

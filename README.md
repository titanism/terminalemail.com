# Terminal Email

[terminalemail.com](https://terminalemail.com) lists email clients and mail tools that run in a terminal, sorted by the operating systems they run on: Linux, macOS, Windows, BSD and Android. Each page has the install command for every system, the protocols and features the program supports, its pros and cons, and a working configuration for a Forward Email mailbox.

It is made by [Forward Email](https://forwardemail.net), whose terminal app (`forwardemail`) is featured. Every other client is listed with the same facts and works with any email provider.

## What the site has

- A page for every client and tool, with install commands per system and the sources each fact was checked against
- A page for each operating system, listing what runs there and how to install it
- A side-by-side comparison for every pair of clients, and an alternatives page for each client
- Lists by feature: OpenPGP, IMAP, JMAP, Maildir, notmuch, OAuth2, mouse support, Vim keys and more
- Forward Email's IMAP, POP3 and SMTP settings with a config for every client
- Search (Ctrl+K or ⌘K), filtering by system, and light and dark themes
- A Markdown copy of every page (add `index.md` to the URL), [llms.txt](https://terminalemail.com/llms.txt), a [JSON API](https://terminalemail.com/api/clients.json), an Atom feed and a sitemap
- Structured data (schema.org) and a social image for every page
- No trackers, cookies, ads or affiliate links; every page works without JavaScript

## Data

Each program is one YAML file in [`clients/`](clients/). [`npm run validate`](scripts/lib.js) checks every field. See [CONTRIBUTING.md](CONTRIBUTING.md) to add a client or correct a fact.

## Build

Requires Node.js 18 or later.

```sh
npm ci
npm test          # validate data, build, check links, run tests
npm run serve     # build and preview at http://localhost:8080
```

The site builds into `_site/` and is published with GitHub Pages by [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). [`lighthouse.yml`](.github/workflows/lighthouse.yml) requires a score of 100 in every Lighthouse category. Scores vary a little between runs, so a page below 100 is run twice more and passes only if most of its runs score 100.

| Path | What it is |
| --- | --- |
| `clients/*.yml` | One file per client or tool |
| `pages/*.md` | Pages written in Markdown |
| `scripts/lib.js` | Data loading and validation |
| `scripts/context.js` | Everything derived from the data: systems, comparisons, alternatives, feature lists |
| `scripts/templates.js`, `scripts/pages.js` | HTML |
| `scripts/machine.js` | Markdown, llms.txt, JSON, sitemap, robots.txt, feed, manifest, service worker |
| `scripts/og.js` | Social images |
| `site/` | Stylesheet, script, fonts, icons and screenshots, copied as they are |

## License

Code: [MIT](LICENSE). Content: [CC BY-SA 4.0](LICENSE-CONTENT.md).

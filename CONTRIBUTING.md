# Contributing

Terminal Email is built from one YAML file per program in [`clients/`](clients/). Everything on the site, including the JSON API, the Markdown copies and llms.txt, is generated from those files.

## Suggest a client or tool

Open an [issue](https://github.com/forwardemail/terminalemail.com/issues/new?template=suggest.yml) with a link to the project, or add it yourself:

1. Copy a similar file in `clients/`, for example `clients/aerc.yml`, to `clients/<slug>.yml`.
2. Fill in every field. The format is checked by `npm run validate`, which explains anything missing.
3. List the URLs you checked each fact against under `sources`.
4. Run `npm test`, then open a pull request.

A program is listed when you use it for email in a terminal, its source code is public, and people use it. See [About](https://terminalemail.com/about/) for the details.

## Correct a fact

Open an [issue](https://github.com/forwardemail/terminalemail.com/issues/new?template=correction.yml) with a link to the source, or edit the file and open a pull request.

## The fields

| Field | What it holds |
| --- | --- |
| `type` | `client` (you read mail in it) or `tool` (sync, send, fetch, index or setup) |
| `interface` | `tui` (full-screen), `cli` (commands), `emacs` or `vim` |
| `platforms` | For each of `linux`, `macos`, `windows`, `bsd` and `android`: `support` (`native`, `wsl`, `termux`, `source` or `none`), install commands and an optional note |
| `protocols` | `true`, `false` or `"external"` (through a separate tool) for IMAP, POP3, SMTP, JMAP, Maildir, mbox and notmuch |
| `features` | `true`, `false` or a short description |
| `forward_email` | A working config for a Forward Email mailbox |
| `sources` | Every URL the facts came from |

## Writing style

Short, plain sentences. Facts, not opinions. No marketing words, no first person, no dates in the text. A pro or con is one specific thing a user would notice.

## Build and preview

```sh
npm ci
npm run serve
```

The site is at <http://localhost:8080>. It needs Node.js 18 or later.

## Code

`scripts/build.js` builds the site into `_site/`. Templates are in `scripts/templates.js` and `scripts/pages.js`, styles in `site/style.css` and the one script in `site/app.js`. Every page works without JavaScript.

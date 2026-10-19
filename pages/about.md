---
title: About Terminal Email
description: What Terminal Email lists, how each fact is checked against its source, and how Forward Email, which makes the site, is featured.
---

# About Terminal Email

Terminal Email is a list of email clients and mail tools that run in a terminal, sorted by the operating systems they run on. Each page gives the install command for every system, the protocols and features the program supports, its pros and cons, and a working setup for a Forward Email mailbox.

## What gets listed

A program is listed when:

- you read, write, send, sync or search email with it in a terminal, or inside Emacs or Vim running in one;
- its source code is public;
- people use it: it is packaged by at least one major system, or has an active community.

Programs with no commits or releases in about a year stay listed when they still work, with a **Not maintained** label. Programs that no longer build or run are removed.

## Editorial policy: how facts are checked

Every fact comes from the project itself: its website, repository, license file, manual or release notes. Install commands are checked against the package repositories of Debian, Fedora, Arch, Homebrew, FreeBSD, OpenBSD, MSYS2, Scoop, winget and Termux. Each page lists the sources it was checked against.

The data lives in one YAML file per program in the [GitHub repository](https://github.com/forwardemail/terminalemail.com), and the site is built from it. A change to a file changes the page, the JSON API and the Markdown copy together.

## Forward Email

Terminal Email is made by [Forward Email](https://forwardemail.net), an email provider. Forward Email's own terminal app, `forwardemail`, is featured on the home page and shown first in lists. It is listed with the same facts as every other client, including its limits: it only works with Forward Email accounts, and its license is source-available rather than open source.

Every other client works with any email provider. The setup examples use Forward Email's server names because the site is made by Forward Email; change the server names and they work with any provider that offers IMAP and SMTP.

Forward Email is open source ([forwardemail/forwardemail.net](https://github.com/forwardemail/forwardemail.net)), and its founder was one of the first employees at DuckDuckGo.

There are no ads, affiliate links, trackers or cookies. See [Privacy](/privacy/) and the [terms of use](/terms/).

## Picks and guides

The [best clients by need](/best/) page picks one client for each common need, with the facts behind each pick. The [questions and answers](/faq/) and the [glossary](/glossary/) explain terms such as IMAP, Maildir and JMAP.

## Contact and corrections

All contact goes through the [GitHub repository](https://github.com/forwardemail/terminalemail.com). If a fact is wrong or out of date, [report a mistake](https://github.com/forwardemail/terminalemail.com/issues/new?template=correction.yml) with a link to a source, or edit the file and open a pull request. See [how to contribute](CONTRIBUTING.md). Report security problems privately as described in the [security policy](SECURITY.md).

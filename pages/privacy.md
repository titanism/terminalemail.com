---
title: Privacy policy
description: Terminal Email sets no cookies and loads no trackers, ads or third-party scripts. What your browser stores, and what GitHub Pages logs.
---

# Privacy policy

Terminal Email collects nothing about you. The site sets no cookies, runs no analytics, and loads no ads, trackers, fonts or scripts from other sites.

## What the site loads

Every page, stylesheet, script, font and image comes from terminalemail.com. A Content Security Policy in each page tells your browser to refuse anything from another site, so a mistake in the code cannot quietly add a third-party request.

The share menu has plain links to Mastodon, Bluesky, Reddit and other sites. Nothing from those sites loads until you click one of the links.

## What your browser stores

The site keeps a few things in your own browser. They never leave your device and you can clear them at any time in your browser settings:

| What | Where | Why |
| --- | --- | --- |
| Your light or dark theme choice | localStorage, key `theme` | So the theme you picked stays the same on the next page |
| The Mastodon server you typed in the share menu | localStorage, key `mastodon` | So you do not have to type it again |
| Pages, styles, fonts and images you opened | Cache Storage, through a service worker | So pages you opened before still work offline |

The search box downloads one file, [/api/search.json](/api/search.json), from this site and searches it in your browser. What you type is not sent anywhere.

## What the host logs

The site is hosted on GitHub Pages. GitHub's documentation states that when a GitHub Pages site is visited, the visitor's IP address is logged and stored for security purposes ([What is GitHub Pages: data collection](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages#data-collection)). Those logs are kept by GitHub and covered by the [GitHub General Privacy Statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement).

## Who runs the site

Terminal Email is made by [Forward Email](https://forwardemail.net). See [About Terminal Email](/about/) for how the list is made.

## Questions

Open an issue in the [GitHub repository](https://github.com/forwardemail/terminalemail.com/issues). Report security problems privately as described in the [security policy](SECURITY.md).

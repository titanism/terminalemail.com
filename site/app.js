// Progressive enhancement only. Every page works without JavaScript.
(function () {
  'use strict';

  var root = document.documentElement;

  // Interface text in the page's language. /i18n/<lang>.js sets window.TE_T on translated pages.
  var DICT = window.TE_T || {};
  function T(s, vars) {
    var r = DICT[s] || s;
    if (vars) for (var k in vars) r = r.split('{' + k + '}').join(vars[k]);
    return r;
  }
  var LANG = document.body.getAttribute('data-lang') || '';
  function escHtml(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  // Only same-site paths and http(s) links from the JSON data become links. "//x" and "/\x" are
  // other sites to a browser, so they are not same-site paths.
  function safeHref(u) { u = String(u == null ? '' : u).trim(); return /^\/(?![\/\\])/.test(u) || /^https?:\/\//i.test(u) ? u : null; }

  // ---------- theme: system, light or dark ----------

  var toggle = document.querySelector('[data-theme-toggle]');
  var MODES = ['system', 'light', 'dark'];
  var LABELS = { system: T('follows your system'), light: T('light'), dark: T('dark') };

  function storedMode() {
    try {
      var t = localStorage.getItem('theme');
      return t === 'light' || t === 'dark' ? t : 'system';
    } catch (e) {
      return 'system';
    }
  }

  function applyMode(mode) {
    if (mode === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', mode);
    try {
      if (mode === 'system') localStorage.removeItem('theme');
      else localStorage.setItem('theme', mode);
    } catch (e) {}
    if (toggle) {
      toggle.setAttribute('data-mode', mode);
      toggle.setAttribute('aria-label', T('Color theme: {mode}. Change theme', { mode: LABELS[mode] }));
      toggle.setAttribute('data-tip', T('Theme: {mode}. Click to change.', { mode: LABELS[mode] }));
    }
  }

  if (toggle) {
    applyMode(storedMode());
    toggle.addEventListener('click', function () {
      var next = MODES[(MODES.indexOf(toggle.getAttribute('data-mode')) + 1) % MODES.length];
      applyMode(next);
      showTip(toggle);
    });
  }

  // ---------- tooltips for any element with data-tip ----------

  // The tooltip element only exists in the page while it is visible.
  var tip = document.createElement('div');
  tip.className = 'tooltip';
  tip.setAttribute('role', 'tooltip');
  tip.id = 'tooltip';
  var current = null;

  function showTip(el) {
    var text = el.getAttribute('data-tip');
    if (!text) return;
    current = el;
    tip.textContent = text;
    if (!tip.parentNode) document.body.appendChild(tip);
    tip.classList.add('show');
    var r = el.getBoundingClientRect();
    var t = tip.getBoundingClientRect();
    var left = Math.min(Math.max(8, r.left + r.width / 2 - t.width / 2), window.innerWidth - t.width - 8);
    var top = r.top - t.height - 8;
    if (top < 8) top = r.bottom + 8;
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
    el.setAttribute('aria-describedby', 'tooltip');
  }

  function hideTip() {
    if (current) current.removeAttribute('aria-describedby');
    current = null;
    tip.classList.remove('show');
    if (tip.parentNode) tip.parentNode.removeChild(tip);
  }

  function target(e) {
    return e.target && e.target.closest ? e.target.closest('[data-tip]') : null;
  }

  document.addEventListener('mouseover', function (e) {
    var el = target(e);
    if (el && el !== current) showTip(el);
    else if (!el && current) hideTip();
  });
  document.addEventListener('focusin', function (e) {
    var el = target(e);
    if (el) showTip(el);
  });
  document.addEventListener('focusout', hideTip);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') hideTip();
  });
  window.addEventListener('scroll', hideTip, { passive: true });
  // Touch: tap a badge to show its tooltip, tap elsewhere to hide it.
  document.addEventListener('touchstart', function (e) {
    var el = target(e);
    if (el && el.tagName !== 'A' && el.tagName !== 'BUTTON') showTip(el);
    else hideTip();
  }, { passive: true });

  // ---------- header fit ----------
  // If the header links do not fit (long translations, large text settings), use the menu instead.
  var top = document.querySelector('.top');
  var topInner = top && top.querySelector('.top-inner');
  if (topInner) {
    var fit = function () {
      top.classList.remove('tight');
      if (topInner.scrollWidth > topInner.clientWidth + 1) top.classList.add('tight');
    };
    fit();
    window.addEventListener('resize', fit, { passive: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  }

  // ---------- close the mobile menu after choosing a link ----------

  var menu = document.querySelector('.menu');
  if (menu) {
    menu.addEventListener('click', function (e) {
      if (e.target.closest('a')) menu.removeAttribute('open');
    });
    document.addEventListener('click', function (e) {
      if (menu.hasAttribute('open') && !menu.contains(e.target)) menu.removeAttribute('open');
    });
    // Esc closes the menu and returns focus to its button; tabbing out of it closes it too.
    menu.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.hasAttribute('open')) {
        menu.removeAttribute('open');
        menu.querySelector('summary').focus();
      }
    });
    menu.addEventListener('focusout', function (e) {
      if (menu.hasAttribute('open') && e.relatedTarget && !menu.contains(e.relatedTarget)) menu.removeAttribute('open');
    });
  }

  // ---------- popovers (share, language, embed) ----------
  // Native popovers do not move focus. These are dialogs, so focus goes to the current language,
  // the first option or the first field; closing returns focus to the button (browser behaviour).
  Array.prototype.forEach.call(document.querySelectorAll('[popover][role="dialog"]'), function (pop) {
    pop.addEventListener('toggle', function (e) {
      if (e.newState !== 'open') return;
      hideTip();
      var visible = function (n) { return n && n.offsetParent !== null; };
      var f = pop.querySelector('[aria-current], input:checked');
      if (!visible(f)) f = Array.prototype.filter.call(pop.querySelectorAll('a[href], button:not([popovertargetaction="hide"]), input, textarea'), visible)[0];
      if (!f) f = pop.querySelector('button');
      if (f) f.focus();
    });
  });

  var base = document.body.getAttribute('data-base') || '';

  // ---------- OS and text filter for client tables ----------
  // The OS chips are links to each system's page; here they filter the table in place instead,
  // and the choice is kept in the address (?os=linux) so it can be shared and survives reload.

  var filter = document.querySelector('[data-filter]');
  var count = document.querySelector('[data-count]');
  var chips = Array.prototype.slice.call(document.querySelectorAll('.os-pick a[data-filter-chip]'));
  var table = document.querySelector('#client-table') || (filter ? document.querySelector('.listing') : null);
  var os = '';

  function applyFilter() {
    if (!table) return;
    var q = filter ? filter.value.trim().toLowerCase() : '';
    var words = q.split(/\s+/).filter(Boolean);
    var shown = 0;
    var rows = table.querySelectorAll('tbody tr[data-name]');
    Array.prototype.forEach.call(rows, function (row) {
      var text = row.getAttribute('data-name');
      var systems = ' ' + row.getAttribute('data-os') + ' ';
      var match = (!os || systems.indexOf(' ' + os + ' ') !== -1) && words.every(function (w) { return text.indexOf(w) !== -1; });
      row.hidden = !match;
      if (match) shown++;
    });
    var empty = table.querySelector('[data-empty]');
    if (empty) empty.hidden = shown !== 0;
    if (count) count.textContent = q || os ? T('{n} of {total} shown', { n: shown, total: rows.length }) : '';
  }

  function setOs(next, push) {
    os = next;
    chips.forEach(function (c) { if (c.getAttribute('data-os-chip') === os) c.setAttribute('aria-current', 'true'); else c.removeAttribute('aria-current'); });
    if (push) {
      var url = new URL(location.href);
      if (os) url.searchParams.set('os', os); else url.searchParams.delete('os');
      history.replaceState(null, '', url.pathname + url.search + url.hash);
    }
    applyFilter();
  }

  if (table && chips.length) {
    chips.forEach(function (c) {
      c.addEventListener('click', function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
        e.preventDefault();
        setOs(c.getAttribute('data-os-chip'), true);
      });
    });
    var start = new URLSearchParams(location.search).get('os');
    var known = chips.some(function (c) { return c.getAttribute('data-os-chip') === start; });
    if (start && known) setOs(start, false);
  }
  if (filter) filter.addEventListener('input', applyFilter);

  // ---------- tabs: install commands and screenshots ----------
  // Without scripts every panel is shown; with them, one panel at a time with arrow-key tabs.

  function tabs(list, panels, onChange) {
    var buttons = Array.prototype.slice.call(list.querySelectorAll('[role="tab"]'));
    function select(i, focus) {
      buttons.forEach(function (b, k) {
        var on = k === i;
        b.setAttribute('aria-selected', on ? 'true' : 'false');
        b.tabIndex = on ? 0 : -1;
        var panel = document.getElementById(b.getAttribute('aria-controls'));
        if (panel) onChange(panel, on);
      });
      if (focus) buttons[i].focus();
    }
    buttons.forEach(function (b, i) {
      b.addEventListener('click', function () { select(i, false); });
      b.addEventListener('keydown', function (e) {
        var k = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (e.key === 'Home') { e.preventDefault(); select(0, true); }
        else if (e.key === 'End') { e.preventDefault(); select(buttons.length - 1, true); }
        else if (k) { e.preventDefault(); select((i + k + buttons.length) % buttons.length, true); }
      });
    });
    select(0, false);
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-tabs]'), function (box) {
    var list = box.querySelector('[role="tablist"]');
    if (!list) return;
    box.classList.add('js');
    tabs(list, box, function (panel, on) { if (on) panel.removeAttribute('data-hide'); else panel.setAttribute('data-hide', ''); });
  });

  Array.prototype.forEach.call(document.querySelectorAll('[data-gallery-tabs]'), function (list) {
    var gallery = document.getElementById(list.getAttribute('data-gallery-tabs'));
    if (!gallery) return;
    gallery.classList.add('js');
    tabs(list, gallery, function (panel, on) {
      panel.classList.toggle('on', on);
      // Load the hidden screenshots once the gallery is in use.
      if (on) Array.prototype.forEach.call(panel.querySelectorAll('img[loading="lazy"]'), function (img) { img.loading = 'eager'; });
    });
  });

  // ---------- sharing ----------

  var sharePop = document.querySelector('[data-share-pop]');
  if (sharePop) {
    var shareData = { title: document.title, text: sharePop.getAttribute('data-text'), url: sharePop.getAttribute('data-url') };
    var canNative = typeof navigator.share === 'function' && (!navigator.canShare || navigator.canShare(shareData));
    var touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    var status = sharePop.querySelector('[data-share-status]');
    var statusText = status.textContent;
    var nativeBtn = sharePop.querySelector('[data-share-native]');
    var nativeShare = function () {
      navigator.share(shareData).catch(function () {});
    };

    if (canNative && nativeBtn) {
      nativeBtn.hidden = false;
      nativeBtn.addEventListener('click', nativeShare);
    }

    // On phones and tablets, share buttons open the system share sheet directly.
    document.querySelectorAll('[data-share]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        if (canNative && touch) {
          e.preventDefault();
          nativeShare();
        }
      });
    });

    var urlField = sharePop.querySelector('[data-share-url]');
    urlField.addEventListener('focus', function () { urlField.select(); });
    sharePop.querySelector('[data-share-copy]').addEventListener('click', function () {
      var done = function () { status.textContent = T('Link copied.'); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(shareData.url).then(done, function () { urlField.select(); document.execCommand('copy'); done(); });
      else { urlField.select(); document.execCommand('copy'); done(); }
    });

    // Email and Messages links need an app registered for mailto: or sms:. Without one the
    // browser silently does nothing, so if the page keeps focus, copy the text and link instead.
    Array.prototype.forEach.call(sharePop.querySelectorAll('a.share-to[href^="mailto:"], a.share-to[href^="sms:"]'), function (a) {
      a.addEventListener('click', function () {
        var left = false;
        var away = function () { left = true; };
        window.addEventListener('blur', away, { once: true });
        document.addEventListener('visibilitychange', away, { once: true });
        setTimeout(function () {
          window.removeEventListener('blur', away);
          document.removeEventListener('visibilitychange', away);
          if (left || document.visibilityState !== 'visible') return;
          var text = shareData.text + ' ' + shareData.url;
          var done = function () { status.textContent = T('No app opened, so the text and link were copied.'); };
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () {});
        }, 1500);
      });
    });

    // Mastodon has no central share page, so ask for the server once and remember it.
    var mLink = sharePop.querySelector('[data-mastodon]');
    var mForm = sharePop.querySelector('[data-mastodon-form]');
    if (mLink && mForm) {
      var mInput = mForm.querySelector('input');
      try { mInput.value = localStorage.getItem('mastodon') || ''; } catch (e2) {}
      mLink.addEventListener('click', function (e) {
        e.preventDefault();
        mForm.hidden = false;
        mInput.focus();
      });
      mForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var host = (mInput.value || 'mastodon.social').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/[/?#].*$/, '');
        if (!/^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(host)) { status.textContent = T('Enter a server name such as mastodon.social.'); return; }
        status.textContent = statusText;
        try { localStorage.setItem('mastodon', host); } catch (e3) {}
        window.open('https://' + host + '/share?text=' + encodeURIComponent(shareData.text + ' ' + shareData.url), '_blank', 'noopener');
      });
    }
  }
  // ---------- search: shared index and ranking ----------
  var index = null;
  var loading = null;
  var TYPES = { e: T('Client'), t: T('Mail tool'), s: T('System'), f: T('Feature list'), a: T('Alternatives'), c: T('Comparison'), p: T('Page') };

  // `fail` runs when the index cannot be loaded (offline and not cached, or a server error).
  function load(cb, fail) {
    if (index) return cb();
    if (!loading) {
      loading = fetch(base + (LANG ? '/' + LANG : '') + '/api/search.json')
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (data) {
          index = data.map(function (x) {
            x._n = fold(x.n);
            x._k = fold(x.k || '');
                  x._d = fold(x.d || '');
            return x;
          });
        })
        .catch(function () { loading = null; });
    }
    loading.then(function () { if (index) cb(); else if (fail) fail(); });
  }

  var LOAD_FAILED = T('Search could not be loaded. Check your connection and try again.');

  // Lowercase and strip accents, so "deja dup" finds "Déjà Dup".
  function fold(s) {
    return String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
  }

  // Every word must match somewhere. Name matches beat keywords, which beat descriptions.
  function search(q, limit) {
    q = fold(q.trim());
    if (!q) return [];
    var alt = /\balternatives?\b|\binstead of\b|\breplace\b/.test(q);
    var vs = /\bvs\.?\b|\bversus\b|\bcompare\b/.test(q);
    var words = q.replace(/\balternatives?( to)?\b|\binstead of\b|\bvs\.?\b|\bversus\b|\bcompare\b|\bterminal\b|\bemail\b|\bclients?\b|\bmail\b|\bbest\b|\bfor\b/g, ' ').split(/\s+/).filter(Boolean);
    if (!words.length) words = q.split(/\s+/);
    var hits = [];
    for (var i = 0; i < index.length; i++) {
      var x = index[i];
      var score = 0;
      var ok = true;
      for (var w = 0; w < words.length; w++) {
        var t = words[w];
        var s = 0;
        if (x._n === t) s = 100;
        else if (x._n.indexOf(t) === 0) s = 60;
        else if (x._n.indexOf(' ' + t) !== -1 || x._n.indexOf('-' + t) !== -1) s = 40;
        else if (x._n.indexOf(t) !== -1) s = 25;
        else if (x._k.indexOf(t) !== -1) s = 30;
        else if (x._d.indexOf(t) !== -1) s = 5;
        if (!s) { ok = false; break; }
        score += s;
      }
      if (!ok) continue;
      if (x._n === q) score += 200;
      if (x.t === 'e') score += 20;
      if (x.t === 's') score += 18;
      if (x.t === 'f') score += 25;
      if (x.t === 'a') score += alt ? 80 : -10;
      if (x.t === 'c') score += vs && words.length > 1 ? 90 : -30;
      if (x.t === 'p') score -= 5;
      if (x.f) score += 6;
      if (x.x) score -= 8;
      hits.push([score, x]);
    }
    hits.sort(function (a, b) { return b[0] - a[0] || a[1].n.localeCompare(b[1].n); });
    return hits.slice(0, limit || 30).map(function (h) { return h[1]; });
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function metaLine(x) {
    var head = (TYPES[x.t] || '') + (x.f ? ', ' + T('featured') : '') + (x.x ? ', ' + T('not maintained') : '');
    return x.d ? head + ': ' + x.d : head;
  }

  // ---------- inline search on the home and search pages ----------

  var input = document.querySelector('[data-search]');
  var results = document.querySelector('[data-results]');

  function renderInline() {
    results.textContent = '';
    if (!input.value.trim()) { results.hidden = true; return; }
    var hits = search(input.value, 25);
    hits.forEach(function (x) {
      var li = el('li');
      var a = el('a', null, x.n);
      if (safeHref(x.u)) a.href = safeHref(x.u);
      li.appendChild(a);
      li.appendChild(el('div', 'meta', metaLine(x)));
      results.appendChild(li);
    });
    if (!hits.length) results.appendChild(el('li', 'meta', T('No matches.')));
    results.hidden = false;
  }

  if (input && results) {
    var inlineFailed = function () {
      results.textContent = '';
      if (!input.value.trim()) { results.hidden = true; return; }
      results.appendChild(el('li', 'meta', LOAD_FAILED));
      results.hidden = false;
    };
    input.addEventListener('input', function () { load(renderInline, inlineFailed); });
    if (input.hasAttribute('data-autofill')) {
      var q0 = new URLSearchParams(location.search).get('q');
      if (q0) { input.value = q0; load(renderInline, inlineFailed); }
    }
  }

  // ---------- command palette: Cmd+K, Ctrl+K or the search button ----------

  var trigger = document.querySelector('[data-palette]');
  var dlg = null;
  var pin, plist, pstatus;
  var active = -1;
  var items = [];
  var lastFocus = null;

  function buildPalette() {
    dlg = el('dialog', 'palette');
    dlg.setAttribute('aria-label', T('Search clients and tools'));
    var form = el('form', 'palette-form');
    form.setAttribute('role', 'search');
    form.method = 'get';
    form.action = base + '/search/';
    var label = el('label', 'sr', T('Search clients, tools, systems and comparisons'));
    label.htmlFor = 'palette-q';
    pin = el('input', 'palette-input');
    pin.id = 'palette-q';
    pin.name = 'q';
    pin.type = 'search';
    pin.autocomplete = 'off';
    pin.spellcheck = false;
    pin.placeholder = T('Search clients, systems, protocols…');
    pin.setAttribute('role', 'combobox');
    pin.setAttribute('aria-expanded', 'false');
    pin.setAttribute('aria-controls', 'palette-list');
    pin.setAttribute('aria-autocomplete', 'list');
    var esc = el('kbd', 'kbd palette-esc', 'Esc');
    esc.setAttribute('aria-hidden', 'true');
    form.appendChild(label);
    form.appendChild(pin);
    form.appendChild(esc);
    plist = el('ul', 'palette-list');
    plist.id = 'palette-list';
    plist.setAttribute('role', 'listbox');
    plist.setAttribute('aria-label', T('Results'));
    // Keep Tab on the search field: the list is driven by the arrow keys through aria-activedescendant.
    plist.tabIndex = -1;
    pstatus = el('p', 'palette-status sr');
    pstatus.setAttribute('role', 'status');
    var foot = el('p', 'palette-foot');
    foot.innerHTML = '<span><kbd class="kbd">↑</kbd><kbd class="kbd">↓</kbd> ' + escHtml(T('to move')) + '</span><span><kbd class="kbd">Enter</kbd> ' + escHtml(T('to open')) + '</span><span><kbd class="kbd">Esc</kbd> ' + escHtml(T('to close')) + '</span>';
    dlg.appendChild(form);
    dlg.appendChild(plist);
    dlg.appendChild(pstatus);
    dlg.appendChild(foot);
    document.body.appendChild(dlg);

    pin.addEventListener('input', function () { load(renderPalette, paletteFailed); });
    pin.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Enter' && active >= 0 && items[active]) { e.preventDefault(); go(items[active]); }
      // A search field's first Esc only clears it; here Esc closes the palette, as its hint says.
      else if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
      // The field is the only stop in the dialog, so Tab stays here rather than leaving for the browser's toolbar.
      else if (e.key === 'Tab') e.preventDefault();
    });
    plist.addEventListener('mousemove', function (e) {
      var li = e.target.closest('[role="option"]');
      if (li) setActive(Number(li.getAttribute('data-i')), false);
    });
    plist.addEventListener('click', function (e) {
      var li = e.target.closest('[role="option"]');
      if (li) { e.preventDefault(); go(items[Number(li.getAttribute('data-i'))]); }
    });
    // Click on the backdrop closes the palette.
    dlg.addEventListener('click', function (e) { if (e.target === dlg) closePalette(); });
    dlg.addEventListener('close', function () {
      document.documentElement.classList.remove('palette-open');
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    });
  }

  function go(x) {
    if (x && safeHref(x.u)) location.href = safeHref(x.u);
  }

  function setActive(i, scroll) {
    var opts = plist.querySelectorAll('[role="option"]');
    if (!opts.length) { active = -1; pin.removeAttribute('aria-activedescendant'); return; }
    active = (i + opts.length) % opts.length;
    for (var k = 0; k < opts.length; k++) opts[k].setAttribute('aria-selected', k === active ? 'true' : 'false');
    pin.setAttribute('aria-activedescendant', opts[active].id);
    if (scroll !== false) opts[active].scrollIntoView({ block: 'nearest' });
  }

  function move(d) { setActive(active + d); }

  // With no query, suggest the systems and the clients.
  function suggestions() {
    var sys = index.filter(function (x) { return x.t === 's'; });
    var cl = index.filter(function (x) { return x.t === 'e'; }).slice(0, 10);
    return sys.concat(cl);
  }

  function renderPalette() {
    var q = pin.value.trim();
    items = q ? search(q, 40) : suggestions();
    plist.textContent = '';
    if (!q) {
      var h = el('li', 'palette-group', T('Systems and clients'));
      h.setAttribute('role', 'presentation');
      plist.appendChild(h);
    }
    items.forEach(function (x, i) {
      // The link itself is the option, so the listbox has no interactive content nested in options.
      var li = el('li', 'palette-item');
      li.setAttribute('role', 'none');
      var a = el('a', 'palette-link');
      a.id = 'po-' + i;
      a.setAttribute('role', 'option');
      a.setAttribute('aria-selected', 'false');
      a.setAttribute('data-i', i);
      if (safeHref(x.u)) a.href = safeHref(x.u);
      a.tabIndex = -1;
      var top = el('span', 'palette-name', x.n);
      a.appendChild(top);
      a.appendChild(el('span', 'palette-meta', metaLine(x)));
      li.appendChild(a);
      plist.appendChild(li);
    });
    if (q && !items.length) {
      var none = el('li', 'palette-empty', T('No matches for "{q}".', { q: q }));
      none.setAttribute('role', 'presentation');
      plist.appendChild(none);
    }
    pin.setAttribute('aria-expanded', items.length ? 'true' : 'false');
    pstatus.textContent = q ? (items.length === 1 ? T('{n} result', { n: 1 }) : T('{n} results', { n: items.length })) : '';
    setActive(0, false);
  }

  function paletteFailed() {
    items = [];
    plist.textContent = '';
    var li = el('li', 'palette-empty', LOAD_FAILED);
    li.setAttribute('role', 'presentation');
    plist.appendChild(li);
    pin.setAttribute('aria-expanded', 'false');
    pstatus.textContent = LOAD_FAILED;
    setActive(0, false);
  }

  function openPalette() {
    if (!dlg) buildPalette();
    if (dlg.open) return;
    lastFocus = document.activeElement;
    hideTip();
    document.documentElement.classList.add('palette-open');
    if (dlg.showModal) dlg.showModal();
    else dlg.setAttribute('open', '');
    pin.value = '';
    pin.focus();
    plist.textContent = '';
    load(renderPalette, paletteFailed);
  }

  function closePalette() {
    if (!dlg || !dlg.open) return;
    if (dlg.close) dlg.close();
    else { dlg.removeAttribute('open'); document.documentElement.classList.remove('palette-open'); }
  }

  if (trigger) {
    trigger.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
      e.preventDefault();
      openPalette();
    });
    // Start loading the index when someone is about to search.
    ['pointerenter', 'focus', 'touchstart'].forEach(function (ev) {
      trigger.addEventListener(ev, function () { load(function () {}); }, { passive: true, once: true });
    });
    var mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    var k = trigger.querySelector('.st-kbd');
    if (k && !mac) k.setAttribute('data-k', 'Ctrl K');
  }

  document.addEventListener('keydown', function (e) {
    var typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
    if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (dlg && dlg.open) closePalette();
      else openPalette();
      return;
    }
    if (e.key === '/' && !typing && !(dlg && dlg.open)) {
      e.preventDefault();
      // On pages with their own search or filter box, "/" focuses it. Elsewhere it opens the palette.
      var field = input || filter;
      if (field) field.focus();
      else openPalette();
    }
  });

  // "Try again" on the offline page. Inline handlers are blocked by the Content Security Policy.
  document.addEventListener('click', function (ev) {
    if (ev.target.closest && ev.target.closest('[data-reload]')) location.reload();
  });

  // Copy buttons for install commands.
  document.addEventListener('click', function (ev) {
    var btn = ev.target.closest && ev.target.closest('[data-copy-text]');
    if (!btn) return;
    var text = btn.getAttribute('data-copy-text');
    // The original label is kept once, so quick repeat clicks cannot leave the button on "Copied".
    if (!btn.hasAttribute('data-label')) { btn.setAttribute('data-label', btn.textContent); btn.setAttribute('data-aria', btn.getAttribute('aria-label') || ''); }
    var done = function () {
      clearTimeout(btn._copyTimer);
      btn.textContent = T('Copied');
      btn.setAttribute('aria-label', T('Copied'));
      btn._copyTimer = setTimeout(function () { btn.textContent = btn.getAttribute('data-label'); btn.setAttribute('aria-label', btn.getAttribute('data-aria')); }, 1500);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () {});
  });
  // Offline support and "Install app". Only on secure origins, never on file:// previews.
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register(base + '/sw.js', { scope: base + '/' }).catch(function () {});
    });
  }
})();

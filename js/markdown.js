/**
 * LocalNotes — Advanced Markdown Support
 * Provides: MD->HTML parser, HTML->MD exporter, live MD mode in editor,
 *           smart paste detection, and improved .md file import.
 */

/* =============================================================
   1. MARKDOWN -> HTML  (full CommonMark-like parser)
============================================================= */
const LNMarkdown = (() => {

  function escHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function parseInline(text) {
    const codeSlots = [];
    text = text.replace(/\\([\\`*_{}\[\]()#+\-.!|])/g, (_, c) => '&#' + c.charCodeAt(0) + ';');
    text = text.replace(/`{2}(.+?)`{2}|`([^`\n]+?)`/g, (_, a, b) => {
      codeSlots.push('<code>' + escHtml(a || b) + '</code>');
      return '\x00CODE' + (codeSlots.length - 1) + '\x00';
    });
    text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => {
      const parts = src.trim().split(/\s+/); const url = parts[0];
      const title = parts.slice(1).join(' ').replace(/^["']|["']$/g, '');
      return '<img src="' + escHtml(url) + '" alt="' + escHtml(alt) + '"' + (title ? ' title="' + escHtml(title) + '"' : '') + ' style="max-width:100%">';
    });
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
      const parts = href.trim().split(/\s+/); const url = parts[0];
      const title = parts.slice(1).join(' ').replace(/^["']|["']$/g, '');
      return '<a href="' + escHtml(url) + '"' + (title ? ' title="' + escHtml(title) + '"' : '') + ' target="_blank" rel="noopener">' + label + '</a>';
    });
    text = text.replace(/\*{3}(.+?)\*{3}|_{3}(.+?)_{3}/g, (_, a, b) => '<strong><em>' + (a||b) + '</em></strong>');
    text = text.replace(/\*{2}(.+?)\*{2}|_{2}(.+?)_{2}/g, (_, a, b) => '<strong>' + (a||b) + '</strong>');
    text = text.replace(/\*(.+?)\*|_([^_\n]+?)_/g, (_, a, b) => '<em>' + (a||b) + '</em>');
    text = text.replace(/~~(.+?)~~/g, '<del>$1</del>');
    text = text.replace(/==(.+?)==/g, '<mark>$1</mark>');
    text = text.replace(/\^(.+?)\^/g, '<sup>$1</sup>');
    text = text.replace(/~([^~\n]+?)~/g, '<sub>$1</sub>');
    text = text.replace(/(?<!["(])(https?:\/\/[^\s<>"]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
    text = text.replace(/\x00CODE(\d+)\x00/g, (_, i) => codeSlots[+i]);
    return text;
  }

  function parseFencedCode(lang, code) {
    const lc = lang ? ' class="language-' + escHtml(lang.trim()) + '"' : '';
    return '<pre><code' + lc + '>' + escHtml(code) + '</code></pre>';
  }

  function parseTable(lines) {
    if (lines.length < 2) return null;
    const header = lines[0].replace(/^\||\|$/g,'').split('|').map(c => c.trim());
    const sep    = lines[1].replace(/^\||\|$/g,'').split('|').map(c => c.trim());
    if (!sep.every(s => /^:?-+:?$/.test(s))) return null;
    const aligns = sep.map(s => s.startsWith(':') && s.endsWith(':') ? 'center' : s.endsWith(':') ? 'right' : s.startsWith(':') ? 'left' : '');
    let html = '<div class="table-responsive"><table><thead><tr>';
    header.forEach((h, i) => { html += '<th' + (aligns[i] ? ' style="text-align:' + aligns[i] + '"' : '') + '>' + parseInline(h) + '</th>'; });
    html += '</tr></thead><tbody>';
    for (let r = 2; r < lines.length; r++) {
      const cells = lines[r].replace(/^\||\|$/g,'').split('|').map(c => c.trim());
      html += '<tr>';
      cells.forEach((c, i) => { html += '<td' + (aligns[i] ? ' style="text-align:' + aligns[i] + '"' : '') + '>' + parseInline(c) + '</td>'; });
      html += '</tr>';
    }
    return html + '</tbody></table></div>';
  }

  function parseList(lines, ordered) {
    const tag = ordered ? 'ol' : 'ul';
    let html = '<' + tag + '>'; let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const match = ordered ? line.match(/^\d+\. (.*)/) : line.match(/^[-*+] (.*)/);
      if (!match) { i++; continue; }
      let content = match[1];
      const nested = []; i++;
      while (i < lines.length && /^    /.test(lines[i])) { nested.push(lines[i].replace(/^    /, '')); i++; }
      if (nested.length) { content += parseList(nested, /^\d+\. /.test(nested[0])); }
      html += '<li>' + parseInline(content) + '</li>';
    }
    return html + '</' + tag + '>';
  }

  function parse(md) {
    if (!md) return '';
    const lines = md.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n');
    const out = []; let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      // Fenced code
      const fm = line.match(/^(`{3,}|~{3,})\s*(\S*)/);
      if (fm) {
        const fence = fm[1]; const lang = fm[2]; const cl = []; i++;
        while (i < lines.length && !lines[i].startsWith(fence)) { cl.push(lines[i]); i++; }
        out.push(parseFencedCode(lang, cl.join('\n'))); i++; continue;
      }
      // Indented code
      if (/^(    |\t)/.test(line)) {
        const cl = [];
        while (i < lines.length && /^(    |\t)/.test(lines[i])) { cl.push(lines[i].replace(/^(    |\t)/,'')); i++; }
        out.push('<pre><code>' + escHtml(cl.join('\n')) + '</code></pre>'); continue;
      }
      // Headings
      const hm = line.match(/^(#{1,6})\s+(.+?)(?:\s+#+)?$/);
      if (hm) {
        const lv = hm[1].length;
        const id = hm[2].toLowerCase().replace(/[^\w\s-]/g,'').replace(/\s+/g,'-');
        out.push('<h' + lv + ' id="' + id + '">' + parseInline(hm[2]) + '</h' + lv + '>'); i++; continue;
      }
      // Setext h1
      if (i+1 < lines.length && /^=+$/.test(lines[i+1].trim()) && line.trim()) { out.push('<h1>' + parseInline(line) + '</h1>'); i+=2; continue; }
      // Setext h2
      if (i+1 < lines.length && /^-+$/.test(lines[i+1].trim()) && line.trim() && !/^[-*_]{3,}$/.test(line.trim())) { out.push('<h2>' + parseInline(line) + '</h2>'); i+=2; continue; }
      // HR
      if (/^[-*_]{3,}\s*$/.test(line.trim())) { out.push('<hr>'); i++; continue; }
      // Blockquote
      if (/^>/.test(line)) {
        const bq = [];
        while (i < lines.length && /^>/.test(lines[i])) { bq.push(lines[i].replace(/^>\s?/,'')); i++; }
        out.push('<blockquote>' + parse(bq.join('\n')) + '</blockquote>'); continue;
      }
      // Table
      if (/^\|/.test(line) && i+1 < lines.length && /^\|[-:| ]+\|/.test(lines[i+1])) {
        const tl = [];
        while (i < lines.length && /^\|/.test(lines[i])) { tl.push(lines[i]); i++; }
        const th = parseTable(tl);
        out.push(th || tl.map(l => '<p>' + parseInline(l) + '</p>').join('')); continue;
      }
      // Task list
      if (/^- \[[ xX]\] /.test(line)) {
        let html = '<ul class="lne-checklist">';
        while (i < lines.length && /^- \[[ xX]\] /.test(lines[i])) {
          const checked = /^- \[[xX]\]/.test(lines[i]);
          const text = lines[i].replace(/^- \[[ xX]\] /,'');
          html += '<li class="lne-checklist-item' + (checked ? ' checked' : '') + '"><input type="checkbox" data-md-checkbox="true"' + (checked ? ' checked' : '') + '> <span>' + parseInline(text) + '</span></li>';
          i++;
        }
        out.push(html + '</ul>'); continue;
      }
      // Unordered list
      if (/^[-*+] /.test(line)) {
        const ll = [];
        while (i < lines.length && (/^[-*+] /.test(lines[i]) || /^    /.test(lines[i]))) { ll.push(lines[i]); i++; }
        out.push(parseList(ll, false)); continue;
      }
      // Ordered list
      if (/^\d+\. /.test(line)) {
        const ll = [];
        while (i < lines.length && (/^\d+\. /.test(lines[i]) || /^    /.test(lines[i]))) { ll.push(lines[i]); i++; }
        out.push(parseList(ll, true)); continue;
      }
      // Blank line
      if (!line.trim()) { i++; continue; }
      // Paragraph
      const pl = [];
      while (i < lines.length && lines[i].trim() && !/^(#{1,6} |>|[-*+] |\d+\. |`{3}|~{3}|[-*_]{3,}$|\||- \[)/.test(lines[i])) { pl.push(lines[i]); i++; }
      if (pl.length) {
        const ph = pl.map((l, idx) => {
          const hb = l.endsWith('  ') || l.endsWith('\\');
          return parseInline(l.replace(/  $|\\$/,'')) + (hb && idx < pl.length-1 ? '<br>' : '');
        }).join(' ');
        out.push('<p>' + ph + '</p>');
      }
    }
    return out.join('\n');
  }

  /* HTML -> Markdown */
  function toMarkdown(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    return nodeMd(div).trim();
  }

  function nodeMd(node) {
    let out = '';
    for (const c of node.childNodes) out += childMd(c);
    return out;
  }

  function childMd(node) {
    if (node.nodeType === 3) return node.textContent.replace(/\n+/g,' ');
    if (node.nodeType !== 1) return '';
    const tag = node.tagName.toLowerCase();
    const inner = () => nodeMd(node);
    switch(tag) {
      case 'h1': return '\n# ' + inner().trim() + '\n\n';
      case 'h2': return '\n## ' + inner().trim() + '\n\n';
      case 'h3': return '\n### ' + inner().trim() + '\n\n';
      case 'h4': return '\n#### ' + inner().trim() + '\n\n';
      case 'h5': return '\n##### ' + inner().trim() + '\n\n';
      case 'h6': return '\n###### ' + inner().trim() + '\n\n';
      case 'p':  return inner().trim() + '\n\n';
      case 'br': return '  \n';
      case 'hr': return '\n---\n\n';
      case 'strong': case 'b': return '**' + inner() + '**';
      case 'em': case 'i': return '_' + inner() + '_';
      case 'del': case 's': return '~~' + inner() + '~~';
      case 'mark': return '==' + inner() + '==';
      case 'sup': return '^' + inner() + '^';
      case 'sub': return '~' + inner() + '~';
      case 'code': return node.parentElement && node.parentElement.tagName === 'PRE' ? node.textContent : '`' + node.textContent + '`';
      case 'pre': {
        const ce = node.querySelector('code');
        const lang = ce ? (ce.className.match(/language-(\S+)/) || [])[1] || '' : '';
        return '\n```' + lang + '\n' + (ce ? ce.textContent : node.textContent) + '\n```\n\n';
      }
      case 'blockquote': return '\n' + inner().trim().split('\n').map(l => '> ' + l).join('\n') + '\n\n';
      case 'a': {
        const href = node.getAttribute('href') || '';
        const title = node.getAttribute('title');
        return '[' + inner() + '](' + href + (title ? ' "' + title + '"' : '') + ')';
      }
      case 'img': {
        const src = node.getAttribute('src') || '';
        const alt = node.getAttribute('alt') || '';
        const title = node.getAttribute('title');
        return '![' + alt + '](' + src + (title ? ' "' + title + '"' : '') + ')';
      }
      case 'ul': {
        let li = '';
        node.querySelectorAll(':scope > li').forEach(item => {
          const cb = item.querySelector('input[type="checkbox"]');
          li += cb ? '- [' + (cb.checked ? 'x' : ' ') + '] ' + item.textContent.trim() + '\n'
                   : '- ' + nodeMd(item).trim() + '\n';
        });
        return '\n' + li + '\n';
      }
      case 'ol': {
        let li = ''; let idx = 1;
        node.querySelectorAll(':scope > li').forEach(item => { li += (idx++) + '. ' + nodeMd(item).trim() + '\n'; });
        return '\n' + li + '\n';
      }
      case 'li': return inner().trim();
      case 'table': {
        const rows = Array.from(node.querySelectorAll('tr'));
        if (!rows.length) return '';
        const toRow = tr => '| ' + Array.from(tr.querySelectorAll('th,td')).map(c => c.textContent.trim()).join(' | ') + ' |';
        const hdr = toRow(rows[0]);
        const sep = '| ' + Array.from(rows[0].querySelectorAll('th,td')).map(() => '---').join(' | ') + ' |';
        const body = rows.slice(1).map(toRow).join('\n');
        return '\n' + hdr + '\n' + sep + (body ? '\n' + body : '') + '\n\n';
      }
      default: return inner();
    }
  }

  function looksLikeMarkdown(text) {
    if (!text || text.length < 10) return false;
    const patterns = [/^#{1,6} /m, /\*\*.+?\*\*/, /^[-*+] /m, /^\d+\. /m, /^>/m, /`{1,3}/, /^---$/m, /\[.+?\]\(.+?\)/, /!\[.+?\]\(.+?\)/, /^\|.+\|/m, /^- \[[ x]\]/m];
    return patterns.filter(p => p.test(text)).length >= 2;
  }

  return { parse, toMarkdown, looksLikeMarkdown, parseInline };
})();


/* =============================================================
   2. REPLACE importNotesMarkdown with advanced version
============================================================= */
// Register immediately — this script is loaded dynamically after DOMContentLoaded
window.importNotesMarkdownAdvanced = async function(files) {
    let imported = 0;
    for (const file of files) {
      try {
        const text = await file.text();
        const html = LNMarkdown.parse(text);
        const id = 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2,9);
        await notesDB.saveNote({ id, content: html, creationTime: Date.now(), lastModified: Date.now(), title: notesDB.extractTitle(html) });
        imported++;
      } catch(e) { console.error('MD import error:', e); }
    }
    if (imported > 0) {
      const msg = typeof t === 'function' ? t('importCompleted', { count: imported }) : 'Imported ' + imported + ' notes';
      if (typeof showCustomAlert === 'function') showCustomAlert(typeof t === 'function' ? t('success') : 'Success', msg, 'success');
      if (typeof loadNotes === 'function') await loadNotes();
    }
  };


/* =============================================================
   3. MARKDOWN MODE — split editor with live preview
============================================================= */
(function() {
  'use strict';
  let mdActive = false, mdTA = null, mdPrev = null, mdWrap = null, mdTimer = null;

  function injectBtn() {
    const tb = document.querySelector('.lne-toolbar');
    if (!tb || tb.querySelector('.lne-md-toggle')) return;
    const btn = document.createElement('button');
    btn.className = 'lne-btn lne-md-toggle';
    const mdLabel = window.t ? window.t('markdownMode') : 'Markdown mode';
    btn.setAttribute('data-lne-tip', mdLabel);
    btn.setAttribute('aria-label', mdLabel);
    btn.setAttribute('data-shortcut', 'Ctrl+M');
    btn.setAttribute('type','button');
    btn.innerHTML = '<i class="bi bi-markdown"></i>';
    let _toggling = false;
    btn.addEventListener('touchend', e => {
      e.preventDefault(); // prevent ghost click on mobile
      if (_toggling) return;
      _toggling = true;
      toggle();
      setTimeout(() => { _toggling = false; }, 400);
    });
    btn.addEventListener('click', e => {
      if (_toggling) return; // already handled by touchend
      toggle();
    });
    const rows = tb.querySelectorAll('.lne-toolbar-row');
    const row = rows[rows.length - 1];
    if (row) {
      const sep = document.createElement('div'); sep.className = 'lne-sep';
      const grp = document.createElement('div'); grp.className = 'lne-grp';
      grp.appendChild(btn); row.appendChild(sep); row.appendChild(grp);
    }
  }

  function toggle() {
    const ed = document.querySelector('.lne-editor');
    if (!ed) return;
    mdActive ? exit(ed) : enter(ed);
  }

  function enter(ed) {
    mdActive = true;
    const md = LNMarkdown.toMarkdown(ed.innerHTML);
    ed.style.display = 'none';

    mdWrap = document.createElement('div');
    mdWrap.className = 'lne-md-container md-tab-edit';

    // Tab bar (visible on mobile only via CSS)
    const tabBar = document.createElement('div');
    tabBar.className = 'lne-md-tabs';
    const tabEdit = document.createElement('button');
    tabEdit.className = 'lne-md-tab active';
    tabEdit.setAttribute('type', 'button');
    tabEdit.innerHTML = '<i class="bi bi-pencil"></i> ' + (window.t ? window.t('mdEdit') : 'Edit');
    const tabPrev = document.createElement('button');
    tabPrev.className = 'lne-md-tab';
    tabPrev.setAttribute('type', 'button');
    tabPrev.innerHTML = '<i class="bi bi-eye"></i> ' + (window.t ? window.t('mdPreview') : 'Preview');
    tabBar.appendChild(tabEdit);
    tabBar.appendChild(tabPrev);

    tabEdit.addEventListener('click', () => {
      mdWrap.classList.remove('md-tab-preview');
      mdWrap.classList.add('md-tab-edit');
      tabEdit.classList.add('active');
      tabPrev.classList.remove('active');
      mdTA.focus();
    });
    tabPrev.addEventListener('click', () => {
      render();
      mdWrap.classList.remove('md-tab-edit');
      mdWrap.classList.add('md-tab-preview');
      tabPrev.classList.add('active');
      tabEdit.classList.remove('active');
    });

    mdTA = document.createElement('textarea');
    mdTA.className = 'lne-md-textarea';
    mdTA.value = md;
    mdTA.spellcheck = true;

    mdPrev = document.createElement('div');
    mdPrev.className = 'lne-md-preview';

    mdWrap.appendChild(tabBar);
    mdWrap.appendChild(mdTA);
    mdWrap.appendChild(mdPrev);
    ed.parentElement.appendChild(mdWrap);

    render();
    mdTA.addEventListener('input', () => { clearTimeout(mdTimer); mdTimer = setTimeout(render, 220); });
    mdTA.addEventListener('keydown', e => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const s = mdTA.selectionStart, v = mdTA.value;
        mdTA.value = v.slice(0,s) + '  ' + v.slice(mdTA.selectionEnd);
        mdTA.selectionStart = mdTA.selectionEnd = s + 2;
        render();
      }
    });

    const btn = document.querySelector('.lne-md-toggle');
    if (btn) {
        btn.classList.add('lne-btn-active');
        const label = window.t ? window.t('exitMarkdownMode') : 'Exit Markdown mode';
        btn.setAttribute('data-lne-tip', label);
        btn.setAttribute('aria-label', label);
    }
    // On mobile don't auto-focus — avoids ghost clicks and unwanted keyboard popup
    if (window.innerWidth > 768) mdTA.focus();
    resizeMdContainer();
  }

  function resizeMdContainer() {
    if (!mdWrap || window.innerWidth > 768) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const modal = document.getElementById('editModal');
    if (!modal) return;
    const buttons = modal.querySelector('.modal-buttons-container');
    const toolbar = modal.querySelector('.lne-toolbar');
    const tabBar  = mdWrap.querySelector('.lne-md-tabs');
    const toolbarH = toolbar ? toolbar.offsetHeight : 0;
    const buttonsH = buttons ? buttons.offsetHeight : 0;
    const tabBarH  = tabBar  ? tabBar.offsetHeight  : 0;
    const available = vv.height - toolbarH - buttonsH - tabBarH - 2;
    mdWrap.style.height = Math.max(available, 200) + 'px';
  }

  function exit(ed) {
    mdActive = false;
    if (mdTA && mdWrap) {
      ed.innerHTML = LNMarkdown.parse(mdTA.value);
      mdWrap.remove();
      mdWrap = mdTA = mdPrev = null;
    }
    ed.style.display = '';
    ed.focus();
    ed.dispatchEvent(new Event('input', { bubbles: true }));
    const btn = document.querySelector('.lne-md-toggle');
    if (btn) {
        btn.classList.remove('lne-btn-active');
        const label = window.t ? window.t('markdownMode') : 'Markdown mode';
        btn.setAttribute('data-lne-tip', label);
        btn.setAttribute('aria-label', label);
    }
  }

  function render() {
    if (!mdPrev || !mdTA) return;
    mdPrev.innerHTML = LNMarkdown.parse(mdTA.value);
    if (typeof hljs !== 'undefined') {
      mdPrev.querySelectorAll('pre code').forEach(b => { try { hljs.highlightElement(b); } catch(e){} });
    }
  }

  // Ctrl+M shortcut
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'm') {
      const ed = document.querySelector('.lne-editor');
      if (ed && (document.activeElement === ed || mdActive)) { e.preventDefault(); toggle(); }
    }
  });

  // Mobile: resize md container when keyboard opens/closes
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => { if (mdActive) resizeMdContainer(); });
  }

  // Smart paste: detect MD and convert
  document.addEventListener('paste', e => {
    const ed = document.querySelector('.lne-editor');
    if (!ed || document.activeElement !== ed || mdActive) return;
    const text = e.clipboardData.getData('text/plain');
    if (!text || !LNMarkdown.looksLikeMarkdown(text)) return;
    if (e.clipboardData.getData('text/html').trim()) return;
    e.preventDefault();
    document.execCommand('insertHTML', false, LNMarkdown.parse(text));
  }, true);

  // Expose for save hook
  window.getLNEditorContent = function() {
    if (mdActive && mdTA) return LNMarkdown.parse(mdTA.value);
    return typeof getEditorContent === 'function' ? getEditorContent() : '';
  };
  window.isLNMarkdownMode = () => mdActive;
  window.exitLNMarkdownMode = function() {
    if (!mdActive) return;
    const ed = document.querySelector('.lne-editor');
    if (ed) exit(ed);
  };

  function tryInject() {
    if (document.querySelector('.lne-toolbar')) injectBtn();
    else setTimeout(tryInject, 300);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tryInject);
  else tryInject();
})();
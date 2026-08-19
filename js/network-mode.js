/**
 * Network Mode — offline / auto / online segmented control
 * localStorage key: 'ln_network_mode' = 'offline' | 'auto' | 'online'
 *
 * - 'online'  — always try the network first (previous default behaviour)
 * - 'offline' — always serve from cache only, never touch the network
 * - 'auto'    — NEW: follows the browser's real connectivity. Behaves like
 *               'online' while actually connected, and automatically drops
 *               to cache-only the moment the device really goes offline
 *               (navigator.onLine / online-offline events), switching back
 *               the instant connectivity returns. No manual flipping needed.
 *
 * A live status dot shows the REAL connectivity state at all times,
 * independent of which mode is selected — so "Online" mode with no actual
 * connection is visibly distinguishable from "Online" mode that's actually
 * connected.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'ln_network_mode';
  const TOGGLE_ID   = 'lnNetworkToggle';
  const MODES       = ['offline', 'auto', 'online'];

  /* ── helpers ─────────────────────────────────────────── */
  function getMode() {
    var m = localStorage.getItem(STORAGE_KEY);
    return MODES.indexOf(m) !== -1 ? m : 'online'; // unchanged default for existing installs
  }

  function setMode(mode) {
    if (MODES.indexOf(mode) === -1) return;
    localStorage.setItem(STORAGE_KEY, mode);
    applyMode(mode);
    notifySW(mode);
    updateToggleUI(mode);
  }

  function applyMode(mode) {
    document.documentElement.setAttribute('data-network-mode', mode);
  }

  function notifySW(mode) {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'SET_NETWORK_MODE', mode });
    }
  }

  function tr(key, fb) { return (window.t ? window.t(key) || fb : fb); }

  /* ── icons (kept as inline SVG — no extra asset requests) ─ */
  var ICON_OFFLINE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.56 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>';
  var ICON_ONLINE  = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>';
  var ICON_AUTO    = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/></svg>';

  /* ── build toggle widget ──────────────────────────────── */
  function buildToggle() {
    if (document.getElementById(TOGGLE_ID)) return;

    var wrap = document.createElement('div');
    wrap.id = TOGGLE_ID;
    wrap.className = 'ln-net-toggle';

    wrap.innerHTML =
      '<span class="ln-net-status-dot" id="lnNetStatusDot" role="img"></span>' +
      '<div class="ln-net-segmented" id="lnNetSegmented" role="radiogroup" aria-label="' + tr('networkModeLabel', 'Network mode') + '">' +
        '<span class="ln-net-seg-highlight" aria-hidden="true"></span>' +
        '<button type="button" class="ln-net-seg" data-mode="offline" role="radio" aria-checked="false">' +
          ICON_OFFLINE + '<span>' + tr('offlineMode', 'Offline') + '</span>' +
        '</button>' +
        '<button type="button" class="ln-net-seg" data-mode="auto" role="radio" aria-checked="false">' +
          ICON_AUTO + '<span>' + tr('autoMode', 'Auto') + '</span>' +
        '</button>' +
        '<button type="button" class="ln-net-seg" data-mode="online" role="radio" aria-checked="false">' +
          ICON_ONLINE + '<span>' + tr('onlineMode', 'Online') + '</span>' +
        '</button>' +
      '</div>';

    var footer = document.querySelector('footer .footer-content');
    if (footer) {
      footer.appendChild(document.createElement('br'));
      footer.appendChild(wrap);
    }

    wrap.querySelectorAll('.ln-net-seg').forEach(function (btn) {
      btn.addEventListener('click', function () { setMode(btn.dataset.mode); });
    });
  }

  function updateToggleUI(mode) {
    var seg = document.getElementById('lnNetSegmented');
    if (!seg) return;
    seg.setAttribute('data-mode', mode);
    seg.querySelectorAll('.ln-net-seg').forEach(function (btn) {
      btn.setAttribute('aria-checked', String(btn.dataset.mode === mode));
    });
  }

  /* ── real connectivity status dot (independent of the mode above) ──── */
  function updateStatusDot() {
    var dot = document.getElementById('lnNetStatusDot');
    if (!dot) return;
    var online = navigator.onLine;
    dot.classList.toggle('ln-net-dot-online', online);
    dot.classList.toggle('ln-net-dot-offline', !online);
    dot.setAttribute('aria-label', online ? tr('reallyOnline', 'Connected') : tr('reallyOffline', 'No connection'));
    dot.title = dot.getAttribute('aria-label');
  }

  var toastShownForOffline = false;
  function handleConnectivityChange() {
    updateStatusDot();
    var online = navigator.onLine;
    // Only bother the user with a toast when it's actually relevant: in
    // 'auto' mode the app's own behaviour just changed (network attempts
    // now skipped/resumed), so it's worth a heads-up. In forced 'online'
    // mode, losing the connection still matters (uploads/saves may be
    // failing) but we only announce once per "gone offline" streak to
    // avoid spamming on a flaky connection blinking on and off.
    var mode = getMode();
    if (!online && !toastShownForOffline) {
      toastShownForOffline = true;
      if (mode !== 'offline' && typeof window.showCustomAlert === 'function') {
        window.showCustomAlert(
          tr('networkModeLabel', 'Network mode'),
          tr('connectivityLost', "You're offline — using cached data."),
          'warning'
        );
      }
    } else if (online) {
      toastShownForOffline = false;
      if (mode === 'auto' && typeof window.showCustomAlert === 'function') {
        window.showCustomAlert(
          tr('networkModeLabel', 'Network mode'),
          tr('connectivityRestored', "You're back online."),
          'success'
        );
      }
    }
  }

  /* ── i18n refresh ─────────────────────────────────────── */
  window.lnNetworkModeRefreshLabels = function () {
    var seg = document.getElementById('lnNetSegmented');
    if (!seg) return;
    seg.setAttribute('aria-label', tr('networkModeLabel', 'Network mode'));
    var map = { offline: 'offlineMode', auto: 'autoMode', online: 'onlineMode' };
    seg.querySelectorAll('.ln-net-seg').forEach(function (btn) {
      var span = btn.querySelector('span');
      if (span) span.textContent = tr(map[btn.dataset.mode], btn.dataset.mode);
    });
    updateStatusDot();
  };

  /* ── init ─────────────────────────────────────────────── */
  function init() {
    var mode = getMode();
    applyMode(mode);

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        buildToggle();
        updateToggleUI(mode);
        updateStatusDot();
      });
    } else {
      buildToggle();
      updateToggleUI(mode);
      updateStatusDot();
    }

    window.addEventListener('online', handleConnectivityChange);
    window.addEventListener('offline', handleConnectivityChange);

    // Уведомляем SW после его активации
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(function () {
        notifySW(mode);
      });
    }
  }

  init();
})();

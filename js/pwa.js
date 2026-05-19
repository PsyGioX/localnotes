// PWA — Service Worker registration + update notification
'use strict';

var _pwaNewWorker = null;
var _pwaReloading = false;
var PWA_DISMISS_KEY = 'pwa_sw_dismissed';
var PWA_UPDATE_KEY = 'pwa_update_pending';

function _pwaGetText() {
    try {
        if (typeof t === 'function') {
            return {
                msg:     t('pwaUpdateAvailable') || 'Update available',
                update:  t('pwaUpdate')          || 'Update',
                dismiss: '✕'
            };
        }
    } catch (e) {}
    return { msg: 'Update available', update: 'Update', dismiss: '✕' };
}

function _pwaWaitingId(worker) {
    return worker ? worker.scriptURL : '';
}

function _pwaIsDismissed(worker) {
    if (!worker) return false;
    return sessionStorage.getItem(PWA_DISMISS_KEY) === _pwaWaitingId(worker);
}

function _pwaMarkDismissed(worker) {
    if (worker) sessionStorage.setItem(PWA_DISMISS_KEY, _pwaWaitingId(worker));
}

function _pwaClearDismissed() {
    sessionStorage.removeItem(PWA_DISMISS_KEY);
}

function _pwaHideToast() {
    var toast = document.getElementById('pwaUpdateToast');
    if (toast) toast.classList.remove('pwa-toast-visible');
}

function _pwaApplyUpdate(worker) {
    if (!worker) return;
    sessionStorage.setItem(PWA_UPDATE_KEY, '1');
    _pwaHideToast();
    worker.postMessage({ type: 'SKIP_WAITING' });
}

function _pwaCreateToast() {
    if (document.getElementById('pwaUpdateToast')) return;
    var txt = _pwaGetText();
    var toast = document.createElement('div');
    toast.id = 'pwaUpdateToast';
    toast.setAttribute('role', 'alert');
    toast.innerHTML =
        '<span id="pwaToastText">' + txt.msg + '</span>' +
        '<button id="pwaToastUpdate">' + txt.update + '</button>' +
        '<button id="pwaToastDismiss">' + txt.dismiss + '</button>';
    document.body.appendChild(toast);

    document.getElementById('pwaToastUpdate').addEventListener('click', function() {
        _pwaApplyUpdate(_pwaNewWorker);
    });

    document.getElementById('pwaToastDismiss').addEventListener('click', function() {
        _pwaMarkDismissed(_pwaNewWorker);
        _pwaHideToast();
    });
}

function _pwaShowUpdateToast(worker) {
    if (!worker || _pwaIsDismissed(worker)) return;
    _pwaNewWorker = worker;
    _pwaCreateToast();
    setTimeout(function() {
        var toast = document.getElementById('pwaUpdateToast');
        if (toast && _pwaNewWorker === worker && !_pwaIsDismissed(worker)) {
            toast.classList.add('pwa-toast-visible');
        }
    }, 300);
}

function _pwaTrackWorker(worker) {
    if (!worker) return;
    worker.addEventListener('statechange', function() {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            _pwaShowUpdateToast(worker);
        }
        if (worker.state === 'activated') {
            _pwaClearDismissed();
            sessionStorage.removeItem(PWA_UPDATE_KEY);
        }
    });
    if (worker.state === 'installed' && navigator.serviceWorker.controller) {
        _pwaShowUpdateToast(worker);
    }
}

function _pwaResumePendingUpdate(registration) {
    if (!sessionStorage.getItem(PWA_UPDATE_KEY)) return;
    var waiting = registration.waiting;
    if (waiting) {
        _pwaNewWorker = waiting;
        _pwaApplyUpdate(waiting);
        return;
    }
    sessionStorage.removeItem(PWA_UPDATE_KEY);
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        var hadController = !!navigator.serviceWorker.controller;

        navigator.serviceWorker.register('/sw.js')
            .then(function(registration) {
                _pwaResumePendingUpdate(registration);

                registration.addEventListener('updatefound', function() {
                    var newWorker = registration.installing;
                    if (newWorker) _pwaTrackWorker(newWorker);
                });

                if (registration.waiting && navigator.serviceWorker.controller) {
                    if (sessionStorage.getItem(PWA_UPDATE_KEY)) {
                        _pwaNewWorker = registration.waiting;
                        _pwaApplyUpdate(registration.waiting);
                    } else {
                        _pwaShowUpdateToast(registration.waiting);
                    }
                }

                if (registration.installing) {
                    _pwaTrackWorker(registration.installing);
                }

                navigator.serviceWorker.ready.then(function(reg) {
                    if (reg.active) {
                        reg.active.postMessage({ type: 'PRECACHE_ALL' });
                    }
                });
            })
            .catch(function(error) {
                console.warn('Service Worker registration failed:', error);
            });

        navigator.serviceWorker.addEventListener('message', function(event) {
            if (event.data && event.data.type === 'PRECACHE_DONE') {
                console.log('[PWA] All static files cached for offline use');
            }
        });

        navigator.serviceWorker.addEventListener('controllerchange', function() {
            if (_pwaReloading) return;
            if (!hadController) return;
            _pwaReloading = true;
            sessionStorage.removeItem(PWA_UPDATE_KEY);
            window.location.reload();
        });
    });
}

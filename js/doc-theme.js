/* Sync legal/document pages with the app theme (localStorage.theme) */
(function(){try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}})();

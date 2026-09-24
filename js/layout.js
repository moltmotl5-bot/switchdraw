(function () {
  'use strict';

  var APP_VERSION = '1.2.3';

  function currentPage() {
    var path = (location.pathname || '').split('/').pop() || 'index.html';
    return path.toLowerCase();
  }

  function renderSidebar() {
    var page = currentPage();
    var uploadActive = page === '' || page === 'index.html' ? ' is-active' : '';
    var historyActive = page === 'history.html' ? ' is-active' : '';

    return [
      '<aside class="sidebar">',
      '<div class="sidebar-brand">',
      '<div class="sidebar-logo">SD</div>',
      '<div>',
      '<strong>SwitchDraw</strong>',
      '<div class="sidebar-version">v' + APP_VERSION + '</div>',
      '</div>',
      '</div>',
      '<nav class="sidebar-nav">',
      '<a class="sidebar-link' + uploadActive + '" href="index.html">',
      '<span class="sidebar-icon">↑</span>',
      '<span>上傳解析</span>',
      '</a>',
      '<a class="sidebar-link' + historyActive + '" href="history.html">',
      '<span class="sidebar-icon">☰</span>',
      '<span>歷史記錄</span>',
      '</a>',
      '</nav>',
      '<div class="sidebar-foot">',
      '<p class="muted">JSON 儲存於主機 <code>data/switches/</code>（Docker volume）</p>',
      '</div>',
      '</aside>'
    ].join('');
  }

  function initLayout() {
    if (document.body.dataset.layoutReady === 'true') {
      return;
    }

    document.body.dataset.layoutReady = 'true';
    document.body.classList.add('has-sidebar');

    var shell = document.createElement('div');
    shell.className = 'app-shell';
    shell.innerHTML = renderSidebar();

    var main = document.querySelector('main');
    if (main && main.parentNode === document.body) {
      shell.appendChild(main);
      document.body.insertBefore(shell, document.body.firstChild);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLayout);
  } else {
    initLayout();
  }
})();

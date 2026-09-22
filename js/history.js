/* global SwitchDraw, ExcelJS */
(function () {
  'use strict';

  var listEl = document.getElementById('record-list');
  var detailEl = document.getElementById('record-detail');
  var errorEl = document.getElementById('error');
  var statusEl = document.getElementById('status');
  var refreshBtn = document.getElementById('refresh-btn');

  var records = [];
  var selectedId = null;
  var selectedDevices = [];

  function showError(message) {
    errorEl.textContent = message;
    errorEl.hidden = !message;
  }

  function showStatus(message) {
    statusEl.textContent = message;
    statusEl.hidden = !message;
  }

  function renderEmptyDetail(message) {
    detailEl.innerHTML = '<p class="muted">' + SwitchDraw.ui.escapeHtml(message) + '</p>';
  }

  function renderRecordList() {
    if (!records.length) {
      listEl.innerHTML = '<p class="muted">尚無已儲存的解析記錄。</p>';
      renderEmptyDetail('請先在「上傳解析」頁面上傳 PuTTY 日誌。');
      return;
    }

    listEl.innerHTML = records.map(function (record) {
      var active = record.id === selectedId ? ' is-active' : '';
      var hosts = (record.hostnames || []).join('、') || '未知主機';
      return [
        '<button type="button" class="record-item' + active + '" data-id="' + SwitchDraw.ui.escapeHtml(record.id) + '">',
        '<strong>' + SwitchDraw.ui.escapeHtml(hosts) + '</strong>',
        '<span class="record-meta">' + SwitchDraw.ui.escapeHtml(record.sourceFile || '未命名來源') + '</span>',
        '<span class="record-meta">' + SwitchDraw.ui.escapeHtml(SwitchDraw.ui.formatDateTime(record.savedAt)) + '</span>',
        '<span class="record-meta">' + record.deviceCount + ' 台 · ' + SwitchDraw.ui.escapeHtml(record.id) + '</span>',
        '</button>'
      ].join('');
    }).join('');

    listEl.querySelectorAll('.record-item').forEach(function (button) {
      button.addEventListener('click', function () {
        loadRecord(button.dataset.id);
      });
    });
  }

  function renderDetail(record, devices) {
    detailEl.innerHTML = [
      '<section class="record-header">',
      '<div>',
      '<h2>' + SwitchDraw.ui.escapeHtml((record.hostnames || []).join('、') || record.id) + '</h2>',
      '<p class="muted">來源：' + SwitchDraw.ui.escapeHtml(record.sourceFile || '-') +
        ' · 儲存時間：' + SwitchDraw.ui.escapeHtml(SwitchDraw.ui.formatDateTime(record.savedAt)) + '</p>',
      '<p class="muted">檔案：<code>data/switches/' + SwitchDraw.ui.escapeHtml(record.id) + '.json</code></p>',
      '</div>',
      '<div class="record-actions">',
      '<button type="button" id="download-record-btn" class="btn-secondary">下載 Excel</button>',
      '<button type="button" id="delete-record-btn" class="btn-danger">刪除記錄</button>',
      '</div>',
      '</section>',
      '<section class="panel">',
      '<h3>解析摘要</h3>',
      '<div id="detail-summary"></div>',
      '</section>',
      '<section class="panel">',
      '<h3>前面板預覽</h3>',
      '<div id="detail-preview"></div>',
      '</section>'
    ].join('');

    SwitchDraw.ui.renderSummary(document.getElementById('detail-summary'), devices);
    SwitchDraw.ui.renderPreview(document.getElementById('detail-preview'), devices);

    document.getElementById('download-record-btn').addEventListener('click', downloadSelected);
    document.getElementById('delete-record-btn').addEventListener('click', deleteSelected);
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  function downloadSelected() {
    if (!selectedDevices.length) {
      return;
    }

    showError('');
    Promise.all(selectedDevices.map(function (device) {
      var filename = device.hostname + '-switchport.xlsx';
      return SwitchDraw.buildWorkbookBlob(device).then(function (blob) {
        downloadBlob(blob, filename);
        return filename;
      });
    })).then(function (files) {
      showStatus('已下載：' + files.join('、'));
    }).catch(function (err) {
      showError('Excel 產生失敗：' + err.message);
    });
  }

  function deleteSelected() {
    if (!selectedId) {
      return;
    }
    if (!window.confirm('確定刪除這筆記錄？對應的 JSON 檔案也會從 data/switches/ 移除。')) {
      return;
    }

    SwitchDraw.store.deleteRecord(selectedId).then(function () {
      selectedId = null;
      selectedDevices = [];
      showStatus('已刪除記錄。');
      return loadRecords();
    }).catch(function (err) {
      showError('刪除失敗：' + err.message);
    });
  }

  function loadRecord(id) {
    showError('');
    SwitchDraw.store.getRecord(id).then(function (record) {
      selectedId = record.id;
      selectedDevices = SwitchDraw.store.enrichDevices(record.devices || []);
      renderRecordList();
      renderDetail({
        id: record.id,
        savedAt: record.savedAt,
        sourceFile: record.sourceFile,
        hostnames: selectedDevices.map(function (device) { return device.hostname; })
      }, selectedDevices);
    }).catch(function (err) {
      showError('讀取記錄失敗：' + err.message);
    });
  }

  function loadRecords() {
    showError('');
    if (!SwitchDraw.store.isAvailable()) {
      listEl.innerHTML = '<p class="muted">請執行 <code>docker compose up -d</code> 或 <code>npm start</code> 後以 http://localhost:8080/history.html 開啟此頁。</p>';
      renderEmptyDetail('本地儲存需透過 SwitchDraw 伺服器存取。');
      return Promise.resolve();
    }

    return SwitchDraw.store.listRecords().then(function (items) {
      records = items;
      renderRecordList();
      if (records.length && !selectedId) {
        loadRecord(records[0].id);
      } else if (selectedId) {
        var stillExists = records.some(function (item) { return item.id === selectedId; });
        if (!stillExists) {
          selectedId = null;
          selectedDevices = [];
          renderEmptyDetail('請選擇一筆記錄。');
        }
      }
      showStatus('共 ' + records.length + ' 筆記錄。');
    }).catch(function (err) {
      showError('載入記錄失敗：' + err.message);
    });
  }

  refreshBtn.addEventListener('click', function () {
    loadRecords();
  });

  loadRecords();
})();

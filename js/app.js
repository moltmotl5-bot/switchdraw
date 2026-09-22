/* global SwitchDraw, ExcelJS */
(function () {
  'use strict';

  var APP_VERSION = '1.2.0';
  var dropzone = document.getElementById('dropzone');
  var fileInput = document.getElementById('file-input');
  var summaryEl = document.getElementById('summary');
  var previewEl = document.getElementById('preview');
  var downloadBtn = document.getElementById('download-btn');
  var errorEl = document.getElementById('error');
  var statusEl = document.getElementById('status');
  var storeNoticeEl = document.getElementById('store-notice');

  var currentDevices = [];
  var currentSourceFile = '';

  function showError(message) {
    errorEl.textContent = message;
    errorEl.hidden = !message;
  }

  function showStatus(message) {
    if (!statusEl) {
      return;
    }
    statusEl.textContent = message;
    statusEl.hidden = !message;
  }

  function updateStoreNotice() {
    if (!storeNoticeEl) {
      return;
    }
    if (SwitchDraw.store.isAvailable()) {
      storeNoticeEl.textContent = '解析成功後會自動儲存至專案 data/switches/ 資料夾。';
      storeNoticeEl.classList.remove('warn');
    } else {
      storeNoticeEl.textContent = '本地儲存需執行 npm start 後以 http://localhost:8080 開啟（file:// 無法寫入專案資料夾）。';
      storeNoticeEl.classList.add('warn');
    }
  }

  function handleParsedDevices(devices, sourceFile) {
    currentSourceFile = sourceFile || currentSourceFile;
    currentDevices = SwitchDraw.store.enrichDevices(devices);
    SwitchDraw.ui.renderSummary(summaryEl, currentDevices);
    SwitchDraw.ui.renderPreview(previewEl, currentDevices);
    downloadBtn.disabled = !currentDevices.length;

    if (!currentDevices.length) {
      return;
    }

    showStatus('就緒。輸出格式：.xlsx（SwitchDraw v' + APP_VERSION + '）');

    if (SwitchDraw.store.isAvailable()) {
      SwitchDraw.store.saveDevices(currentDevices, currentSourceFile).then(function (record) {
        showStatus('已儲存至 data/switches/' + record.id + '.json，並可從「歷史記錄」查看。');
      }).catch(function (err) {
        showError('解析成功，但儲存失敗：' + err.message);
      });
    }
  }

  function processText(text, filename) {
    showError('');
    currentSourceFile = filename || '';
    try {
      var devices = SwitchDraw.parseLog(text);
      if (!devices.length) {
        showError('無法從「' + filename + '」解析交換器資料。');
      }
      handleParsedDevices(devices, filename);
    } catch (err) {
      showError('解析失敗：' + err.message);
      handleParsedDevices([], filename);
    }
  }

  function readFile(file) {
    if (!/\.log$/i.test(file.name) && !/\.txt$/i.test(file.name)) {
      showError('請上傳 .log 或 .txt 檔案。');
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      processText(reader.result, file.name);
    };
    reader.onerror = function () {
      showError('讀取檔案失敗。');
    };
    reader.readAsText(file);
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  function downloadWorkbooks() {
    if (!currentDevices.length) {
      return;
    }

    downloadBtn.disabled = true;
    showError('');

    Promise.all(currentDevices.map(function (device) {
      var filename = device.hostname + '-switchport.xlsx';
      return SwitchDraw.buildWorkbookBlob(device).then(function (blob) {
        if (!(blob instanceof Blob)) {
          throw new Error('Excel 二進位資料產生失敗');
        }
        if (blob.size < 1024) {
          throw new Error('Excel 檔案大小異常（' + blob.size + ' bytes）');
        }
        downloadBlob(blob, filename);
        return filename;
      });
    })).then(function (files) {
      showStatus('已下載：' + files.join('、') + '（.xlsx 格式，無巨集／無腳本）');
    }).catch(function (err) {
      showError('Excel 產生失敗：' + err.message + '。請確認頁面底部顯示 v' + APP_VERSION + '，並清除瀏覽器快取後重試。');
    }).finally(function () {
      downloadBtn.disabled = !currentDevices.length;
    });
  }

  function verifyRuntime() {
    if (typeof ExcelJS === 'undefined') {
      showError('Excel 函式庫未載入。請確認 vendor/exceljs.bare.min.js 存在，並重新整理頁面（Ctrl+F5 清除快取）。');
      downloadBtn.disabled = true;
      return;
    }
    updateStoreNotice();
    showStatus('SwitchDraw v' + APP_VERSION + ' 已就緒。輸出格式：.xlsx');
  }

  dropzone.addEventListener('click', function () {
    fileInput.click();
  });

  dropzone.addEventListener('dragover', function (event) {
    event.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', function () {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', function (event) {
    event.preventDefault();
    dropzone.classList.remove('dragover');
    if (event.dataTransfer.files.length) {
      readFile(event.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', function () {
    if (fileInput.files.length) {
      readFile(fileInput.files[0]);
    }
  });

  downloadBtn.addEventListener('click', downloadWorkbooks);
  verifyRuntime();
})();

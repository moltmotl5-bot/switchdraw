/* global SwitchDraw */
(function () {
  'use strict';

  var dropzone = document.getElementById('dropzone');
  var fileInput = document.getElementById('file-input');
  var summaryEl = document.getElementById('summary');
  var previewEl = document.getElementById('preview');
  var downloadBtn = document.getElementById('download-btn');
  var errorEl = document.getElementById('error');

  var currentDevices = [];

  function showError(message) {
    errorEl.textContent = message;
    errorEl.hidden = !message;
  }

  function renderSummary(devices) {
    if (!devices.length) {
      summaryEl.innerHTML = '<p class="muted">找不到可解析的交換器資料。請確認日誌包含 running-config 或 show interfaces status。</p>';
      return;
    }

    summaryEl.innerHTML = devices.map(function (device) {
      return [
        '<article class="summary-card">',
        '<h2>' + escapeHtml(device.hostname) + '</h2>',
        '<ul>',
        '<li>實體埠：' + device.counts.total + '</li>',
        '<li>Up：' + device.counts.up + '</li>',
        '<li>Down：' + device.counts.down + '</li>',
        '<li>Shutdown：' + device.counts.shutdown + '</li>',
        '<li>VLAN 數：' + Object.keys(device.vlans).length + '</li>',
        '</ul>',
        '</article>'
      ].join('');
    }).join('');
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderPortBox(port) {
    var style = SwitchDraw.portStyle(port);
    var label = SwitchDraw.portLabel(port);
    return [
      '<div class="port-box" style="background:' + style.fill + ';color:' + style.text + '">',
      '<div class="port-name">' + escapeHtml(label.title) + '</div>',
      '<div class="port-vlan">' + escapeHtml(label.vlan) + '</div>',
      '<div class="port-detail">' + escapeHtml(label.detail) + '</div>',
      '</div>'
    ].join('');
  }

  function renderPreview(devices) {
    if (!devices.length) {
      previewEl.innerHTML = '';
      return;
    }

    previewEl.innerHTML = devices.map(function (device) {
      var groups = SwitchDraw.buildFaceplateGroups(device.physicalPorts);
      var groupHtml = groups.map(function (group) {
        return [
          '<section class="module-block">',
          '<h3>' + escapeHtml(group.moduleLabel) + '</h3>',
          '<div class="row-label">奇數埠（上排）</div>',
          '<div class="port-row">' + group.oddRow.map(renderPortBox).join('') + '</div>',
          '<div class="row-label">偶數埠（下排）</div>',
          '<div class="port-row">' + group.evenRow.map(renderPortBox).join('') + '</div>',
          '</section>'
        ].join('');
      }).join('');

      return [
        '<section class="device-preview">',
        '<h2>' + escapeHtml(device.hostname) + ' 前面板預覽</h2>',
        groupHtml,
        '</section>'
      ].join('');
    }).join('');
  }

  function handleParsedDevices(devices) {
    currentDevices = devices;
    renderSummary(devices);
    renderPreview(devices);
    downloadBtn.disabled = !devices.length;
  }

  function processText(text, filename) {
    showError('');
    try {
      var devices = SwitchDraw.parseLog(text);
      if (!devices.length) {
        showError('無法從「' + filename + '」解析交換器資料。');
      }
      handleParsedDevices(devices);
    } catch (err) {
      showError('解析失敗：' + err.message);
      handleParsedDevices([]);
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
      return SwitchDraw.buildWorkbookBlob(device).then(function (blob) {
        downloadBlob(blob, device.hostname + '-switchport.xlsx');
      });
    })).catch(function (err) {
      showError('Excel 產生失敗：' + err.message);
    }).finally(function () {
      downloadBtn.disabled = !currentDevices.length;
    });
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
})();

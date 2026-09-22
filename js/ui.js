/* global SwitchDraw */
var SwitchDraw = SwitchDraw || {};

(function (SD) {
  'use strict';

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderPortBox(port, registry) {
    var label = SD.portLabel(port);
    var vlanFill = SD.portVlanColor(port, registry);
    var status = SD.portStatusDisplay(port);
    return [
      '<div class="port-box">',
      '<div class="port-row port-row-iface">' + escapeHtml(label.title) + '</div>',
      '<div class="port-row port-row-vlan" style="background:' + vlanFill + '">' + escapeHtml(label.vlan) + '</div>',
      '<div class="port-row port-row-desc">' + escapeHtml(label.detail) + '</div>',
      '<div class="port-row port-row-status" style="background:' + status.fill + ';color:' + status.textColor + '">' + escapeHtml(status.text) + '</div>',
      '</div>'
    ].join('');
  }

  function renderSummaryHtml(devices) {
    if (!devices.length) {
      return '<p class="muted">找不到可解析的交換器資料。請確認日誌包含 running-config 或 show interfaces status。</p>';
    }

    return devices.map(function (device) {
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

  function renderPreviewHtml(devices) {
    if (!devices.length) {
      return '';
    }

    return devices.map(function (device) {
      var registry = device.colorRegistry || SD.createColorRegistry(device);
      var groups = SD.buildFaceplateGroups(device.physicalPorts);
      var groupHtml = groups.map(function (group) {
        return [
          '<section class="module-block">',
          '<h3>' + escapeHtml(group.moduleLabel) + '</h3>',
          '<div class="row-label">奇數埠（上排）</div>',
          '<div class="port-row">' + group.oddRow.map(function (p) { return renderPortBox(p, registry); }).join('') + '</div>',
          '<div class="row-label">偶數埠（下排）</div>',
          '<div class="port-row">' + group.evenRow.map(function (p) { return renderPortBox(p, registry); }).join('') + '</div>',
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

  function renderSummary(container, devices) {
    if (container) {
      container.innerHTML = renderSummaryHtml(devices);
    }
  }

  function renderPreview(container, devices) {
    if (container) {
      container.innerHTML = renderPreviewHtml(devices);
    }
  }

  function formatDateTime(value) {
    if (!value) {
      return '-';
    }
    try {
      return new Date(value).toLocaleString('zh-TW', { hour12: false });
    } catch (err) {
      return String(value);
    }
  }

  SD.ui = {
    escapeHtml: escapeHtml,
    renderSummary: renderSummary,
    renderPreview: renderPreview,
    renderSummaryHtml: renderSummaryHtml,
    renderPreviewHtml: renderPreviewHtml,
    formatDateTime: formatDateTime
  };
})(SwitchDraw);

(function (root, sd) {
  root.SwitchDraw = sd;
})(typeof globalThis !== 'undefined' ? globalThis : this, SwitchDraw);

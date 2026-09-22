/* global SwitchDraw, ExcelJS */
var SwitchDraw = (typeof globalThis !== 'undefined' ? globalThis : this).SwitchDraw || {};

(function (SD) {
  'use strict';

  function getExcelJS() {
    if (typeof ExcelJS !== 'undefined') {
      return ExcelJS;
    }
    if (typeof require !== 'undefined') {
      return require('exceljs');
    }
    throw new Error('ExcelJS 未載入');
  }

  function hexToArgb(hex) {
    return 'FF' + String(hex || '#FFFFFF').replace('#', '').toUpperCase();
  }

  function applyBorder(cell) {
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF999999' } },
      left: { style: 'thin', color: { argb: 'FF999999' } },
      bottom: { style: 'thin', color: { argb: 'FF999999' } },
      right: { style: 'thin', color: { argb: 'FF999999' } }
    };
  }

  function fillCell(cell, hexColor, options) {
    var opts = options || {};
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: hexToArgb(hexColor) }
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true
    };
    cell.font = {
      name: 'Calibri',
      size: opts.fontSize || 9,
      bold: !!opts.bold,
      color: { argb: hexToArgb(opts.textColor || '#1A1A1A') }
    };
    applyBorder(cell);
  }

  function styleHeaderCell(cell, value) {
    cell.value = value;
    fillCell(cell, '#ECF0F1', { bold: true, fontSize: 10 });
  }

  function writeLegend(sheet, device, startRow) {
    var row = startRow;
    var title = sheet.getCell('A' + row);
    title.value = device.hostname + ' 前面板';
    title.font = { name: 'Calibri', size: 14, bold: true };
    row += 1;

    sheet.getCell('A' + row).value = '總埠數: ' + device.counts.total;
    sheet.getCell('B' + row).value = 'Up: ' + device.counts.up;
    sheet.getCell('C' + row).value = 'Down: ' + device.counts.down;
    sheet.getCell('D' + row).value = 'Shutdown: ' + device.counts.shutdown;
    row += 1;

    styleHeaderCell(sheet.getCell('A' + row), 'VLAN 圖例');
    row += 1;

    var legend = SD.buildVlanSummary(device);
    legend.forEach(function (item, index) {
      var cell = sheet.getCell(row, index + 1);
      var label = item.id === 'trunk' ? 'TRUNK' : ('VLAN ' + item.id + ' ' + item.name);
      cell.value = label + ' (' + item.portCount + ')';
      fillCell(cell, item.color);
    });

    return row + 2;
  }

  function writePortRow(sheet, rowIndex, ports) {
    ports.forEach(function (port, index) {
      var cell = sheet.getCell(rowIndex, index + 1);
      var style = SD.portStyle(port);
      var label = SD.portLabel(port);
      cell.value = label.title + '\n' + label.vlan + '\n' + label.detail;
      fillCell(cell, style.fill, { textColor: style.text });
    });
    sheet.getRow(rowIndex).height = 48;
  }

  function buildFaceplateSheet(workbook, group, device) {
    var sheet = workbook.addWorksheet(group.sheetName, {
      views: [{ showGridLines: false }]
    });
    var colCount = Math.max(group.oddRow.length, group.evenRow.length, 1);
    for (var c = 1; c <= colCount; c++) {
      sheet.getColumn(c).width = 14;
    }

    var row = writeLegend(sheet, device, 1);
    styleHeaderCell(sheet.getCell('A' + row), group.moduleLabel + '（奇數埠 · 上排）');
    row += 1;
    writePortRow(sheet, row, group.oddRow);
    row += 1;
    styleHeaderCell(sheet.getCell('A' + row), group.moduleLabel + '（偶數埠 · 下排）');
    row += 1;
    writePortRow(sheet, row, group.evenRow);
  }

  function buildPortsSheet(workbook, device) {
    var headers = [
      '主機', '模組', '介面', '描述', '管理狀態', '連線狀態', '模式',
      'Access VLAN', 'VLAN 名稱', 'Voice VLAN', 'Native VLAN', 'Allowed VLAN',
      '速率', '雙工', '類型', 'Port-channel', '鄰居', '鄰居埠'
    ];
    var sheet = workbook.addWorksheet('Ports');
    headers.forEach(function (header, index) {
      styleHeaderCell(sheet.getCell(1, index + 1), header);
      sheet.getColumn(index + 1).width = index === 3 ? 28 : 14;
    });

    device.ports.forEach(function (port, rowIndex) {
      var row = rowIndex + 2;
      var values = [
        device.hostname,
        port.parts.stack + '/' + port.parts.module,
        port.name,
        port.description,
        port.adminStatus === 'disabled' ? 'shutdown' : 'enabled',
        port.linkStatus,
        port.mode,
        port.accessVlan,
        port.vlanName,
        port.voiceVlan,
        port.nativeVlan,
        port.allowedVlans,
        port.speed,
        port.duplex,
        port.type,
        port.portChannel,
        port.neighbor,
        port.neighborPort
      ];
      values.forEach(function (value, colIndex) {
        sheet.getCell(row, colIndex + 1).value = value;
      });
    });

    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: device.ports.length + 1, column: headers.length }
    };
  }

  function buildVlansSheet(workbook, device) {
    var headers = ['VLAN', '名稱', '色碼', '埠數'];
    var sheet = workbook.addWorksheet('VLANs');
    headers.forEach(function (header, index) {
      styleHeaderCell(sheet.getCell(1, index + 1), header);
      sheet.getColumn(index + 1).width = 16;
    });

    SD.buildVlanSummary(device).forEach(function (item, rowIndex) {
      var row = rowIndex + 2;
      sheet.getCell(row, 1).value = item.id === 'trunk' ? '' : item.id;
      sheet.getCell(row, 2).value = item.name;
      sheet.getCell(row, 3).value = item.color;
      sheet.getCell(row, 4).value = item.portCount;
      fillCell(sheet.getCell(row, 3), item.color);
    });
  }

  function buildWorkbook(device) {
    var Excel = getExcelJS();
    var workbook = new Excel.Workbook();
    workbook.creator = 'SwitchDraw';
    workbook.created = new Date();
    workbook.title = device.hostname + ' Switchport';

    SD.buildFaceplateGroups(device.physicalPorts).forEach(function (group) {
      buildFaceplateSheet(workbook, group, device);
    });
    buildPortsSheet(workbook, device);
    buildVlansSheet(workbook, device);

    return workbook;
  }

  function buildWorkbookBuffer(device) {
    var workbook = buildWorkbook(device);
    return workbook.xlsx.writeBuffer();
  }

  function buildWorkbookBlob(device) {
    return buildWorkbookBuffer(device).then(function (buffer) {
      if (typeof Blob !== 'undefined') {
        return new Blob([buffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
      }
      return buffer;
    });
  }

  SD.buildWorkbook = buildWorkbook;
  SD.buildWorkbookBuffer = buildWorkbookBuffer;
  SD.buildWorkbookBlob = buildWorkbookBlob;
})(SwitchDraw);

(function (root, sd) {
  root.SwitchDraw = sd;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = sd;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, SwitchDraw);

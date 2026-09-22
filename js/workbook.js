/* global SwitchDraw */
var SwitchDraw = (typeof globalThis !== 'undefined' ? globalThis : this).SwitchDraw || {};

(function (SD) {
  'use strict';

  function escapeXml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function styleIdForColor(color) {
    return 'c' + color.replace('#', '').toUpperCase();
  }

  function buildStyles(device) {
    var styles = [
      '<Style ss:ID="Default" ss:Name="Normal">' +
        '<Alignment ss:Vertical="Center" ss:WrapText="1"/>' +
        '<Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="10"/>' +
      '</Style>',
      '<Style ss:ID="Header">' +
        '<Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>' +
        '<Font ss:Bold="1" ss:FontName="Calibri" ss:Size="10"/>' +
        '<Interior ss:Color="#ECF0F1" ss:Pattern="Solid"/>' +
        '<Borders>' +
          '<Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>' +
          '<Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>' +
          '<Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>' +
          '<Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>' +
        '</Borders>' +
      '</Style>',
      '<Style ss:ID="Title">' +
        '<Font ss:Bold="1" ss:Size="14" ss:FontName="Calibri"/>' +
      '</Style>',
      '<Style ss:ID="Legend">' +
        '<Alignment ss:Horizontal="Center" ss:Vertical="Center"/>' +
        '<Font ss:Size="9" ss:FontName="Calibri"/>' +
        '<Borders>' +
          '<Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>' +
          '<Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>' +
          '<Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>' +
          '<Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>' +
        '</Borders>' +
      '</Style>'
    ];

    var colors = {};
    SD.buildVlanSummary(device).forEach(function (row) {
      colors[row.color] = true;
    });
    device.physicalPorts.forEach(function (port) {
      colors[SD.portStyle(port).fill] = true;
    });

    Object.keys(colors).forEach(function (color) {
      var id = styleIdForColor(color);
      styles.push(
        '<Style ss:ID="' + id + '">' +
          '<Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>' +
          '<Font ss:FontName="Calibri" ss:Size="9"/>' +
          '<Interior ss:Color="' + color + '" ss:Pattern="Solid"/>' +
          '<Borders>' +
            '<Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>' +
            '<Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>' +
            '<Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>' +
            '<Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>' +
          '</Borders>' +
        '</Style>'
      );
    });

    return styles.join('\n');
  }

  function cell(value, styleId, type) {
    var dataType = type || (typeof value === 'number' ? 'Number' : 'String');
    return '<Cell ss:StyleID="' + escapeXml(styleId) + '"><Data ss:Type="' + dataType + '">' +
      escapeXml(value) + '</Data></Cell>';
  }

  function row(cells, height) {
    var heightAttr = height ? ' ss:Height="' + height + '"' : '';
    return '<Row' + heightAttr + '>' + cells.join('') + '</Row>';
  }

  function columns(count, width) {
    var parts = [];
    for (var i = 0; i < count; i++) {
      parts.push('<Column ss:Width="' + (width || 72) + '"/>');
    }
    return parts.join('');
  }

  function buildLegendRows(device) {
    var rows = [];
    rows.push(row([cell(device.hostname + ' 前面板', 'Title')]));
    rows.push(row([
      cell('總埠數: ' + device.counts.total, 'Default'),
      cell('Up: ' + device.counts.up, 'Default'),
      cell('Down: ' + device.counts.down, 'Default'),
      cell('Shutdown: ' + device.counts.shutdown, 'Default')
    ]));
    rows.push(row([cell('VLAN 圖例', 'Header')]));

    var legend = SD.buildVlanSummary(device);
    var legendCells = legend.map(function (item) {
      var label = item.id === 'trunk' ? 'TRUNK' : ('VLAN ' + item.id + ' ' + item.name);
      return cell(label + ' (' + item.portCount + ')', styleIdForColor(item.color));
    });
    if (legendCells.length) {
      rows.push(row(legendCells));
    }
    rows.push(row([cell('', 'Default')]));
    return rows;
  }

  function portCell(port) {
    var style = SD.portStyle(port);
    var label = SD.portLabel(port);
    var text = label.title + '\n' + label.vlan + '\n' + label.detail;
    return cell(text, styleIdForColor(style.fill));
  }

  function buildFaceplateSheet(group, device) {
    var parts = ['<Worksheet ss:Name="' + escapeXml(group.sheetName) + '">', '<Table>'];
    var colCount = Math.max(group.oddRow.length, group.evenRow.length, 1);
    parts.push(columns(colCount, 78));
    parts.push(buildLegendRows(device).join(''));
    parts.push(row([cell(group.moduleLabel + '（奇數埠 · 上排）', 'Header')]));
    parts.push(row(group.oddRow.map(portCell), 48));
    parts.push(row([cell(group.moduleLabel + '（偶數埠 · 下排）', 'Header')]));
    parts.push(row(group.evenRow.map(portCell), 48));
    parts.push('</Table></Worksheet>');
    return parts.join('\n');
  }

  function buildPortsSheet(device) {
    var headers = [
      '主機', '模組', '介面', '描述', '管理狀態', '連線狀態', '模式',
      'Access VLAN', 'VLAN 名稱', 'Voice VLAN', 'Native VLAN', 'Allowed VLAN',
      '速率', '雙工', '類型', 'Port-channel', '鄰居', '鄰居埠'
    ];
    var rows = [row(headers.map(function (h) { return cell(h, 'Header'); }))];

    device.ports.forEach(function (port) {
      rows.push(row([
        cell(device.hostname),
        cell(port.parts.stack + '/' + port.parts.module),
        cell(port.name),
        cell(port.description),
        cell(port.adminStatus === 'disabled' ? 'shutdown' : 'enabled'),
        cell(port.linkStatus),
        cell(port.mode),
        cell(port.accessVlan),
        cell(port.vlanName),
        cell(port.voiceVlan),
        cell(port.nativeVlan),
        cell(port.allowedVlans),
        cell(port.speed),
        cell(port.duplex),
        cell(port.type),
        cell(port.portChannel),
        cell(port.neighbor),
        cell(port.neighborPort)
      ]));
    });

    var filterRange = 'R1C1:R' + (device.ports.length + 1) + 'C' + headers.length;
    return [
      '<Worksheet ss:Name="Ports">',
      '<Table>',
      columns(headers.length, 90),
      rows.join(''),
      '</Table>',
      '<AutoFilter x:Range="' + filterRange + '" xmlns="urn:schemas-microsoft-com:office:excel"/>',
      '</Worksheet>'
    ].join('\n');
  }

  function buildVlansSheet(device) {
    var headers = ['VLAN', '名稱', '色碼', '埠數'];
    var rows = [row(headers.map(function (h) { return cell(h, 'Header'); }))];
    SD.buildVlanSummary(device).forEach(function (item) {
      rows.push(row([
        cell(item.id === 'trunk' ? '' : item.id),
        cell(item.name),
        cell(item.color),
        cell(item.portCount, 'Default', 'Number')
      ]));
    });

    return [
      '<Worksheet ss:Name="VLANs">',
      '<Table>',
      columns(headers.length, 100),
      rows.join(''),
      '</Table>',
      '</Worksheet>'
    ].join('\n');
  }

  function buildWorkbookXml(device) {
    var groups = SD.buildFaceplateGroups(device.physicalPorts);
    var sheets = groups.map(function (group) {
      return buildFaceplateSheet(group, device);
    });
    sheets.push(buildPortsSheet(device));
    sheets.push(buildVlansSheet(device));

    return [
      '<?xml version="1.0"?>',
      '<?mso-application progid="Excel.Sheet"?>',
      '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"',
      ' xmlns:o="urn:schemas-microsoft-com:office:office"',
      ' xmlns:x="urn:schemas-microsoft-com:office:excel"',
      ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"',
      ' xmlns:html="http://www.w3.org/TR/REC-html40">',
      '<DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">',
      '<Title>' + escapeXml(device.hostname + ' Switchport') + '</Title>',
      '<Author>SwitchDraw</Author>',
      '</DocumentProperties>',
      '<Styles>',
      buildStyles(device),
      '</Styles>',
      sheets.join('\n'),
      '</Workbook>'
    ].join('\n');
  }

  function buildWorkbookBlob(device) {
    var xml = buildWorkbookXml(device);
    if (typeof Blob !== 'undefined') {
      return new Blob([xml], { type: 'application/vnd.ms-excel' });
    }
    return xml;
  }

  SD.buildWorkbookXml = buildWorkbookXml;
  SD.buildWorkbookBlob = buildWorkbookBlob;
  SD.escapeXml = escapeXml;
})(SwitchDraw);

(function (root, sd) {
  root.SwitchDraw = sd;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = sd;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, SwitchDraw);

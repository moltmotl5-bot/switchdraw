/* global SwitchDraw */
var SwitchDraw = (typeof globalThis !== 'undefined' ? globalThis : this).SwitchDraw || {};

(function (SD) {
  'use strict';

  var VLAN_PALETTE = [
    '#4E79A7', '#F28E2B', '#E15759', '#76B7B2', '#59A14F',
    '#EDC948', '#B07AA1', '#FF9DA7', '#9C755F', '#BAB0AC',
    '#86BCB6', '#D37295', '#FABFD2', '#8CD17D', '#B6992D',
    '#499894', '#E15759', '#79706E', '#D4A6C8', '#FFBE7D'
  ];

  var TRUNK_COLOR = '#2C3E50';
  var SHUTDOWN_COLOR = '#BDC3C7';
  var ERR_COLOR = '#C0392B';
  var ROUTED_COLOR = '#8E44AD';

  function vlanColor(vlanId) {
    var id = parseInt(vlanId, 10);
    if (!id || isNaN(id)) {
      return '#D5D8DC';
    }
    return VLAN_PALETTE[id % VLAN_PALETTE.length];
  }

  function lighten(hex, amount) {
    var num = parseInt(hex.slice(1), 16);
    var r = Math.min(255, ((num >> 16) & 0xff) + amount);
    var g = Math.min(255, ((num >> 8) & 0xff) + amount);
    var b = Math.min(255, (num & 0xff) + amount);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
  }

  function portStyle(port) {
    if (port.adminStatus === 'disabled') {
      return { fill: SHUTDOWN_COLOR, text: '#2C3E50', label: '關閉' };
    }
    if (port.linkStatus === 'err-disabled') {
      return { fill: ERR_COLOR, text: '#FFFFFF', label: 'ERR' };
    }
    if (port.mode === 'trunk') {
      return { fill: TRUNK_COLOR, text: '#FFFFFF', label: 'TRUNK' };
    }
    if (port.mode === 'routed') {
      return { fill: ROUTED_COLOR, text: '#FFFFFF', label: 'L3' };
    }
    var base = vlanColor(port.accessVlan);
    if (!SD.isLinkUp(port.linkStatus)) {
      base = lighten(base, 80);
    }
    return { fill: base, text: '#1A1A1A', label: port.accessVlan || '-' };
  }

  function portLabel(port) {
    var parts = port.parts;
    var shortName = parts.normalized.replace(/^([A-Za-z]+)/, function (m) { return m; });
    var line2 = port.mode === 'trunk' ? 'TRUNK' : (port.accessVlan || '-');
    var line3 = port.neighbor || port.description || '';
    if (line3.length > 18) {
      line3 = line3.slice(0, 16) + '..';
    }
    return {
      title: shortName,
      vlan: line2,
      detail: line3
    };
  }

  function groupKey(port) {
    var p = port.parts;
    return p.short + p.stack + '/' + p.module;
  }

  function sheetName(key) {
    return key.replace(/\//g, '-').slice(0, 31);
  }

  function buildFaceplateGroups(physicalPorts) {
    var groups = {};
    physicalPorts.forEach(function (port) {
      var key = groupKey(port);
      if (!groups[key]) {
        groups[key] = {
          key: key,
          sheetName: sheetName(key),
          moduleLabel: key,
          ports: []
        };
      }
      groups[key].ports.push(port);
    });

    return Object.keys(groups).sort().map(function (key) {
      var group = groups[key];
      var ports = group.ports.slice().sort(function (a, b) {
        return a.parts.port - b.parts.port;
      });
      var odd = ports.filter(function (p) { return p.parts.port % 2 === 1; });
      var even = ports.filter(function (p) { return p.parts.port % 2 === 0; });
      return {
        key: group.key,
        sheetName: group.sheetName,
        moduleLabel: group.moduleLabel,
        oddRow: odd,
        evenRow: even,
        allPorts: ports
      };
    });
  }

  function buildVlanSummary(device) {
    var counts = {};
    device.physicalPorts.forEach(function (port) {
      if (port.mode === 'trunk') {
        counts.trunk = (counts.trunk || 0) + 1;
        return;
      }
      if (port.accessVlan) {
        counts[port.accessVlan] = (counts[port.accessVlan] || 0) + 1;
      }
    });

    var rows = Object.keys(device.vlans).sort(function (a, b) {
      return parseInt(a, 10) - parseInt(b, 10);
    }).map(function (id) {
      return {
        id: id,
        name: device.vlans[id].name,
        color: vlanColor(id),
        portCount: counts[id] || 0
      };
    });

    if (counts.trunk) {
      rows.push({
        id: 'trunk',
        name: 'Trunk',
        color: TRUNK_COLOR,
        portCount: counts.trunk
      });
    }

    return rows;
  }

  SD.vlanColor = vlanColor;
  SD.portStyle = portStyle;
  SD.portLabel = portLabel;
  SD.buildFaceplateGroups = buildFaceplateGroups;
  SD.buildVlanSummary = buildVlanSummary;
  SD.TRUNK_COLOR = TRUNK_COLOR;
  SD.SHUTDOWN_COLOR = SHUTDOWN_COLOR;
})(SwitchDraw);

(function (root, sd) {
  root.SwitchDraw = sd;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = sd;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, SwitchDraw);

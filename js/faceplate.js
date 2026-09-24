/* global SwitchDraw */
var SwitchDraw = (typeof globalThis !== 'undefined' ? globalThis : this).SwitchDraw || {};

(function (SD) {
  'use strict';

  var VLAN_PALETTE = [
    '#4E79A7', '#F28E2B', '#E15759', '#76B7B2', '#59A14F',
    '#EDC948', '#B07AA1', '#FF9DA7', '#9C755F', '#BAB0AC',
    '#86BCB6', '#D37295', '#FABFD2', '#8CD17D', '#B6992D',
    '#499894', '#79706E', '#D4A6C8', '#FFBE7D', '#AEC7E8'
  ];

  var TRUNK_COLOR = '#2C3E50';
  var SHUTDOWN_COLOR = '#BDC3C7';
  var ERR_COLOR = '#C0392B';
  var ROUTED_COLOR = '#8E44AD';
  var STATUS_CONNECTED_FILL = '#D5F5E3';
  var STATUS_CONNECTED_TEXT = '#1E8449';
  var STATUS_DOWN_FILL = '#FCF3CF';
  var STATUS_DOWN_TEXT = '#7D6608';
  var STATUS_UNKNOWN_FILL = '#F2F3F4';
  var STATUS_UNKNOWN_TEXT = '#566573';

  function createColorRegistry(device) {
    var vlanIds = {};
    Object.keys(device.vlans || {}).forEach(function (id) {
      vlanIds[id] = true;
    });
    (device.physicalPorts || []).forEach(function (port) {
      if (port.accessVlan) {
        vlanIds[port.accessVlan] = true;
      }
    });

    var sorted = Object.keys(vlanIds).sort(function (a, b) {
      return parseInt(a, 10) - parseInt(b, 10);
    });

    var vlan = {};
    sorted.forEach(function (id, index) {
      vlan[id] = VLAN_PALETTE[index % VLAN_PALETTE.length];
    });

    return {
      vlan: vlan,
      special: {
        trunk: TRUNK_COLOR,
        shutdown: SHUTDOWN_COLOR,
        errDisabled: ERR_COLOR,
        routed: ROUTED_COLOR,
        unknown: '#D5D8DC'
      }
    };
  }

  function enrichDevice(device) {
    device.colorRegistry = createColorRegistry(device);
    return device;
  }

  function getVlanColor(registry, vlanId) {
    if (!registry || !vlanId) {
      return '#D5D8DC';
    }
    return registry.vlan[vlanId] || registry.special.unknown;
  }

  function portVlanColor(port, registry) {
    if (port.adminStatus === 'disabled') {
      return registry.special.shutdown;
    }
    if (port.mode === 'trunk') {
      return registry.special.trunk;
    }
    if (port.mode === 'routed') {
      return registry.special.routed;
    }
    return getVlanColor(registry, port.accessVlan);
  }

  function portStatusDisplay(port) {
    if (port.adminStatus === 'disabled') {
      return { text: 'shutdown', fill: SHUTDOWN_COLOR, textColor: '#2C3E50' };
    }
    if (port.linkStatus === 'err-disabled') {
      return { text: 'err-disable', fill: ERR_COLOR, textColor: '#FFFFFF' };
    }
    if (port.mode === 'trunk') {
      return { text: 'trunk', fill: TRUNK_COLOR, textColor: '#FFFFFF' };
    }
    if (port.mode === 'routed') {
      return { text: 'routed', fill: ROUTED_COLOR, textColor: '#FFFFFF' };
    }
    if (SD.isLinkUp(port.linkStatus)) {
      return { text: 'connected', fill: STATUS_CONNECTED_FILL, textColor: STATUS_CONNECTED_TEXT };
    }
    if (port.linkStatus === 'notconnect') {
      return { text: 'notconnect', fill: STATUS_DOWN_FILL, textColor: STATUS_DOWN_TEXT };
    }
    return {
      text: port.linkStatus || 'unknown',
      fill: STATUS_UNKNOWN_FILL,
      textColor: STATUS_UNKNOWN_TEXT
    };
  }

  function portStyle(port, registry) {
    var reg = registry || { vlan: {}, special: { unknown: '#D5D8DC', trunk: TRUNK_COLOR, shutdown: SHUTDOWN_COLOR } };
    var fill = portVlanColor(port, reg);
    var status = portStatusDisplay(port);
    return {
      fill: fill,
      text: status.textColor,
      label: port.mode === 'trunk' ? 'TRUNK' : (port.accessVlan || '-'),
      statusFill: status.fill,
      statusText: status.textColor
    };
  }

  function portVlanTextColor(port) {
    if (port.mode === 'trunk' || port.mode === 'routed') {
      return '#FFFFFF';
    }
    if (port.adminStatus === 'disabled') {
      return '#2C3E50';
    }
    return '#1A1A1A';
  }

  function portVlanDisplay(port, registry) {
    return {
      text: portVlanLabel(port),
      fill: portVlanColor(port, registry),
      textColor: portVlanTextColor(port)
    };
  }

  function portVlanLabel(port) {
    if (port.mode === 'trunk') {
      return 'TRUNK';
    }
    return port.accessVlan || '-';
  }

  function portDescriptionText(port, truncatePreview) {
    var text = port.description || port.neighbor || '';
    if (truncatePreview && text.length > 18) {
      return text.slice(0, 16) + '..';
    }
    return text;
  }

  function portLabel(port) {
    var parts = port.parts;
    var shortName = parts.normalized.replace(/^([A-Za-z]+)/, function (m) { return m; });
    return {
      title: shortName,
      vlan: portVlanLabel(port),
      detail: portDescriptionText(port, true),
      status: portStatusDisplay(port).text
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
    var registry = device.colorRegistry || createColorRegistry(device);
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

    var rows = Object.keys(registry.vlan).sort(function (a, b) {
      return parseInt(a, 10) - parseInt(b, 10);
    }).map(function (id) {
      return {
        id: id,
        name: device.vlans[id] ? device.vlans[id].name : ('VLAN' + id),
        color: registry.vlan[id],
        portCount: counts[id] || 0
      };
    });

    if (counts.trunk) {
      rows.push({
        id: 'trunk',
        name: 'Trunk',
        color: registry.special.trunk,
        portCount: counts.trunk
      });
    }

    return rows;
  }

  SD.createColorRegistry = createColorRegistry;
  SD.enrichDevice = enrichDevice;
  SD.getVlanColor = getVlanColor;
  SD.portVlanColor = portVlanColor;
  SD.portVlanDisplay = portVlanDisplay;
  SD.portVlanTextColor = portVlanTextColor;
  SD.portStatusDisplay = portStatusDisplay;
  SD.portStyle = portStyle;
  SD.portLabel = portLabel;
  SD.portVlanLabel = portVlanLabel;
  SD.portDescriptionText = portDescriptionText;
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

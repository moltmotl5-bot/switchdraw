/* global SwitchDraw */
var SwitchDraw = SwitchDraw || {};

(function (SD) {
  'use strict';

  var IFACE_EXPAND = {
    Fa: 'FastEthernet',
    Gi: 'GigabitEthernet',
    Te: 'TenGigabitEthernet',
    Tw: 'TwentyFiveGigE',
    Fi: 'FiveGigabitEthernet',
    Fo: 'FortyGigabitEthernet',
    Hu: 'HundredGigE',
    Twe: 'TwoGigabitEthernet',
    Eth: 'Ethernet'
  };

  var IFACE_SHORT = {};
  Object.keys(IFACE_EXPAND).forEach(function (short) {
    IFACE_SHORT[IFACE_EXPAND[short]] = short;
  });

  function cleanLog(text) {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\x08+/g, '')
      .replace(/--More--[^\n]*/g, '')
      .replace(/\n\s*\n\s*\n/g, '\n\n');
  }

  function normalizeInterfaceName(raw) {
    if (!raw) {
      return '';
    }
    var name = raw.trim().replace(/\s+/g, '');
    var match = name.match(/^([A-Za-z]+)(\d[\d\/]*)$/);
    if (!match) {
      return name;
    }
    var prefix = match[1];
    var suffix = match[2];
    var shortPrefix = prefix;

    if (prefix.length > 2 && IFACE_SHORT[prefix]) {
      shortPrefix = IFACE_SHORT[prefix];
    } else if (prefix.length === 2 && IFACE_EXPAND[prefix]) {
      shortPrefix = prefix;
    } else {
      var keys = Object.keys(IFACE_SHORT);
      for (var i = 0; i < keys.length; i++) {
        if (prefix.indexOf(keys[i]) === 0 || IFACE_SHORT[keys[i]].indexOf(prefix) === 0) {
          shortPrefix = IFACE_SHORT[keys[i]];
          break;
        }
      }
    }

    return shortPrefix + suffix;
  }

  function parseInterfaceParts(name) {
    var normalized = normalizeInterfaceName(name);
    var match = normalized.match(/^([A-Za-z]+)(\d+)\/(\d+)\/(\d+)$/);
    if (match) {
      return {
        short: match[1],
        stack: parseInt(match[2], 10),
        module: parseInt(match[3], 10),
        port: parseInt(match[4], 10),
        normalized: normalized
      };
    }
    match = normalized.match(/^([A-Za-z]+)(\d+)\/(\d+)$/);
    if (match) {
      return {
        short: match[1],
        stack: 0,
        module: parseInt(match[2], 10),
        port: parseInt(match[3], 10),
        normalized: normalized
      };
    }
    return {
      short: normalized.replace(/\d.*/, ''),
      stack: 0,
      module: 0,
      port: 0,
      normalized: normalized
    };
  }

  function isPhysicalInterface(name) {
    var n = normalizeInterfaceName(name);
    return /^(Fa|Gi|Te|Tw|Fi|Fo|Hu|Twe|Eth)\d+\/\d+\/\d+$/.test(n) ||
      /^(Fa|Gi|Te|Tw|Fi|Fo|Hu|Twe|Eth)\d+\/\d+$/.test(n);
  }

  function splitByDevice(text) {
    var hostnameMatches = [];
    var hostnameRe = /^hostname\s+(\S+)/gm;
    var match;
    while ((match = hostnameRe.exec(text)) !== null) {
      hostnameMatches.push({ name: match[1], index: match.index });
    }

    var uniqueNames = {};
    hostnameMatches.forEach(function (entry) {
      uniqueNames[entry.name] = true;
    });
    var hostnameList = Object.keys(uniqueNames);

    if (hostnameList.length <= 1) {
      var singleHost = hostnameMatches[0] ? hostnameMatches[0].name : '';
      if (!singleHost) {
        var promptMatch = text.match(/^([A-Za-z0-9_.-]+)[>#]/m);
        singleHost = promptMatch ? promptMatch[1] : '';
      }
      return [{ promptHost: singleHost, text: text }];
    }

    var chunks = [];
    hostnameMatches.forEach(function (entry, idx) {
      var end = idx + 1 < hostnameMatches.length ? hostnameMatches[idx + 1].index : text.length;
      chunks.push({
        promptHost: entry.name,
        text: text.slice(entry.index, end)
      });
    });

    return chunks;
  }

  function extractHostname(text, promptHost) {
    var m = text.match(/^hostname\s+(\S+)/m);
    if (m) {
      return m[1];
    }
    return promptHost || 'switch';
  }

  function parseRunningConfig(text) {
    var interfaces = {};
    var blocks = text.split(/^interface\s+/m);
    blocks.slice(1).forEach(function (block) {
      var lines = block.split('\n');
      var header = lines[0].trim();
      var ifaceName = header.split(/\s+/)[0];
      if (!ifaceName) {
        return;
      }
      var key = normalizeInterfaceName(ifaceName);
      var entry = interfaces[key] || { name: key };

      lines.slice(1).forEach(function (line) {
        var trimmed = line.trim();
        if (!trimmed || trimmed.charAt(0) === '!' || trimmed === 'exit') {
          return;
        }
        if (trimmed.indexOf('description ') === 0) {
          entry.description = trimmed.slice(12).trim();
        } else if (trimmed === 'shutdown') {
          entry.adminStatus = 'disabled';
        } else if (trimmed.indexOf('no shutdown') === 0) {
          entry.adminStatus = 'enabled';
        } else if (trimmed.indexOf('switchport mode access') === 0) {
          entry.mode = 'access';
        } else if (trimmed.indexOf('switchport mode trunk') === 0) {
          entry.mode = 'trunk';
        } else if (trimmed.indexOf('switchport access vlan ') === 0) {
          entry.accessVlan = trimmed.split(/\s+/).pop();
        } else if (trimmed.indexOf('switchport voice vlan ') === 0) {
          entry.voiceVlan = trimmed.split(/\s+/).pop();
        } else if (trimmed.indexOf('switchport trunk native vlan ') === 0) {
          entry.nativeVlan = trimmed.split(/\s+/).pop();
        } else if (trimmed.indexOf('switchport trunk allowed vlan ') === 0) {
          entry.allowedVlans = trimmed.slice(30).trim();
        } else if (trimmed.indexOf('channel-group ') === 0) {
          entry.portChannel = trimmed.split(/\s+/)[1];
        } else if (trimmed.indexOf('no switchport') === 0) {
          entry.mode = 'routed';
        }
      });

      if (!entry.adminStatus) {
        entry.adminStatus = 'enabled';
      }
      interfaces[key] = entry;
    });

    return interfaces;
  }

  function findSection(text, markers) {
    var lower = text.toLowerCase();
    for (var i = 0; i < markers.length; i++) {
      var idx = lower.indexOf(markers[i].toLowerCase());
      if (idx !== -1) {
        return text.slice(idx);
      }
    }
    return '';
  }

  function parseInterfaceStatus(text) {
    var section = findSection(text, [
      'show interfaces status',
      'show interface status',
      'show int status'
    ]);
    if (!section) {
      return {};
    }

    var lines = section.split('\n');
    var result = {};
    var started = false;
    var headerCols = [];

    lines.forEach(function (line) {
      if (/^Port\s+/i.test(line)) {
        started = true;
        headerCols = line.trim().split(/\s{2,}/);
        return;
      }
      if (!started || !line.trim() || /^[-\s]+$/.test(line)) {
        return;
      }
      if (/^Port\s+/i.test(line)) {
        return;
      }

      var cols = line.trim().split(/\s{2,}/);
      if (cols.length < 2) {
        return;
      }

      var port = normalizeInterfaceName(cols[0]);
      var entry = result[port] || { name: port };

      if (headerCols.length >= 6) {
        entry.description = (cols[1] || '').trim();
        entry.status = (cols[2] || '').trim().toLowerCase();
        entry.vlan = (cols[3] || '').trim();
        entry.duplex = (cols[4] || '').trim();
        entry.speed = (cols[5] || '').trim();
        entry.type = (cols[6] || '').trim();
      } else {
        entry.status = (cols[1] || '').trim().toLowerCase();
        entry.vlan = (cols[2] || '').trim();
        entry.duplex = (cols[3] || '').trim();
        entry.speed = (cols[4] || '').trim();
        entry.type = (cols[5] || '').trim();
      }

      result[port] = entry;
    });

    return result;
  }

  function parseVlanBrief(text) {
    var section = findSection(text, ['show vlan brief', 'show vlan']);
    if (!section) {
      return {};
    }

    var lines = section.split('\n');
    var vlans = {};
    var started = false;

    lines.forEach(function (line) {
      if (/^VLAN\s+Name/i.test(line)) {
        started = true;
        return;
      }
      if (!started || !line.trim() || /^[-\s]+$/.test(line)) {
        return;
      }
      var m = line.match(/^(\d+)\s+(\S+)\s+\S+\s*(.*)$/);
      if (m) {
        vlans[m[1]] = {
          id: m[1],
          name: m[2],
          ports: m[3] ? m[3].split(',').map(function (p) {
            return normalizeInterfaceName(p.trim());
          }).filter(Boolean) : []
        };
      }
    });

    return vlans;
  }

  function parseCdpNeighbors(text) {
    var section = findSection(text, ['show cdp neighbors detail', 'show cdp neighbors']);
    if (!section) {
      return {};
    }

    var neighbors = {};
    var lines = section.split('\n');
    var current = null;

    lines.forEach(function (line) {
      var detailDevice = line.match(/^Device ID:\s*(.+)$/i);
      if (detailDevice) {
        current = { device: detailDevice[1].trim() };
        return;
      }
      var local = line.match(/^Interface:\s*(.+?),\s*Port ID \(outgoing port\):\s*(.+)$/i);
      if (local && current) {
        var port = normalizeInterfaceName(local[1].trim());
        neighbors[port] = {
          neighbor: current.device,
          neighborPort: local[2].trim()
        };
        current = null;
        return;
      }

      if (/^Device ID\s+Local Intrfce/i.test(line)) {
        return;
      }
      var row = line.match(/^(\S+)\s+(\S+\s*\d+\/\d+(?:\/\d+)?)\s+\d+/);
      if (row) {
        var localPort = normalizeInterfaceName(row[2].replace(/\s+/g, ''));
        neighbors[localPort] = neighbors[localPort] || { neighbor: row[1] };
      }
      var portId = line.match(/^Platform:\s*.+,\s*Port ID \(outgoing port\):\s*(.+)$/i);
      if (portId && current) {
        current.neighborPort = portId[1].trim();
      }
    });

    return neighbors;
  }

  function parseLldpNeighbors(text) {
    var section = findSection(text, ['show lldp neighbors detail', 'show lldp neighbors']);
    if (!section) {
      return {};
    }

    var neighbors = {};
    var lines = section.split('\n');
    var currentLocal = '';

    lines.forEach(function (line) {
      var local = line.match(/^Local Intf:\s*(.+)$/i);
      if (local) {
        currentLocal = normalizeInterfaceName(local[1].trim());
        neighbors[currentLocal] = neighbors[currentLocal] || {};
        return;
      }
      var sysName = line.match(/^System Name:\s*(.+)$/i);
      if (sysName && currentLocal) {
        neighbors[currentLocal].neighbor = sysName[1].trim();
        return;
      }
      var portId = line.match(/^Port id:\s*(.+)$/i);
      if (portId && currentLocal) {
        neighbors[currentLocal].neighborPort = portId[1].trim();
      }
    });

    return neighbors;
  }

  function mergeNeighbors(cdp, lldp) {
    var merged = {};
    Object.keys(cdp).forEach(function (port) {
      merged[port] = Object.assign({}, cdp[port]);
    });
    Object.keys(lldp).forEach(function (port) {
      merged[port] = Object.assign({}, merged[port] || {}, lldp[port]);
    });
    return merged;
  }

  function mergePortData(config, status, vlans, neighbors) {
    var names = {};
    Object.keys(config).forEach(function (k) { names[k] = true; });
    Object.keys(status).forEach(function (k) { names[k] = true; });

    var ports = [];
    Object.keys(names).sort(compareInterfaces).forEach(function (name) {
      var cfg = config[name] || {};
      var st = status[name] || {};
      var n = neighbors[name] || {};
      var accessVlan = cfg.accessVlan || (cfg.mode !== 'trunk' && st.vlan && st.vlan !== 'trunk' ? st.vlan : '');
      var vlanName = accessVlan && vlans[accessVlan] ? vlans[accessVlan].name : '';

      ports.push({
        name: name,
        parts: parseInterfaceParts(name),
        description: cfg.description || st.description || '',
        adminStatus: cfg.adminStatus || 'enabled',
        linkStatus: st.status || 'unknown',
        mode: cfg.mode || (st.vlan === 'trunk' ? 'trunk' : 'access'),
        accessVlan: accessVlan,
        vlanName: vlanName,
        voiceVlan: cfg.voiceVlan || '',
        nativeVlan: cfg.nativeVlan || '',
        allowedVlans: cfg.allowedVlans || '',
        duplex: st.duplex || '',
        speed: st.speed || '',
        type: st.type || '',
        portChannel: cfg.portChannel || '',
        neighbor: n.neighbor || '',
        neighborPort: n.neighborPort || '',
        physical: isPhysicalInterface(name)
      });
    });

    return ports;
  }

  function compareInterfaces(a, b) {
    var pa = parseInterfaceParts(a);
    var pb = parseInterfaceParts(b);
    if (pa.short !== pb.short) {
      return pa.short.localeCompare(pb.short);
    }
    if (pa.stack !== pb.stack) {
      return pa.stack - pb.stack;
    }
    if (pa.module !== pb.module) {
      return pa.module - pb.module;
    }
    return pa.port - pb.port;
  }

  function parseDeviceChunk(chunk) {
    var text = chunk.text;
    var hostname = extractHostname(text, chunk.promptHost);
    var config = parseRunningConfig(text);
    var status = parseInterfaceStatus(text);
    var vlans = parseVlanBrief(text);
    var neighbors = mergeNeighbors(parseCdpNeighbors(text), parseLldpNeighbors(text));
    var ports = mergePortData(config, status, vlans, neighbors);

    var physical = ports.filter(function (p) { return p.physical; });
    var counts = {
      total: physical.length,
      up: physical.filter(function (p) {
        return p.adminStatus !== 'disabled' && p.linkStatus === 'connected';
      }).length,
      down: physical.filter(function (p) {
        return p.adminStatus !== 'disabled' && p.linkStatus !== 'connected';
      }).length,
      shutdown: physical.filter(function (p) {
        return p.adminStatus === 'disabled';
      }).length
    };

    return {
      hostname: hostname,
      vlans: vlans,
      ports: ports,
      physicalPorts: physical,
      counts: counts
    };
  }

  function parseLog(text) {
    var cleaned = cleanLog(text);
    var chunks = splitByDevice(cleaned);
    return chunks.map(parseDeviceChunk).filter(function (device) {
      return device.ports.length > 0;
    });
  }

  SD.parseLog = parseLog;
  SD.cleanLog = cleanLog;
  SD.normalizeInterfaceName = normalizeInterfaceName;
  SD.parseInterfaceParts = parseInterfaceParts;
  SD.isPhysicalInterface = isPhysicalInterface;
  SD.compareInterfaces = compareInterfaces;
})(SwitchDraw);

(function (root, sd) {
  root.SwitchDraw = sd;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = sd;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, SwitchDraw);

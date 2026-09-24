'use strict';

var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');
var test = require('node:test');

var root = path.join(__dirname, '..');
require(path.join(root, 'js', 'parse.js'));
require(path.join(root, 'js', 'faceplate.js'));
require(path.join(root, 'js', 'workbook.js'));
var SD = globalThis.SwitchDraw;

var sampleLog = fs.readFileSync(path.join(root, 'fixtures', 'sample-cisco.log'), 'utf8');
var ipBriefLog = fs.readFileSync(path.join(root, 'fixtures', 'sample-ip-brief.log'), 'utf8');
var c3850Log = fs.readFileSync(path.join(root, 'fixtures', 'sample-c3850-abbrev.log'), 'utf8');

test('cleanLog removes PuTTY noise', function () {
  var cleaned = SD.cleanLog('line1\x08\x08--More-- \nline2');
  assert.match(cleaned, /line1/);
  assert.doesNotMatch(cleaned, /--More--/);
});

test('normalizeLinkStatus maps up to connected', function () {
  assert.equal(SD.normalizeLinkStatus('up', 'up'), 'connected');
  assert.equal(SD.normalizeLinkStatus('connected'), 'connected');
  assert.equal(SD.normalizeLinkStatus('connected: T'), 'connected');
  assert.equal(SD.normalizeLinkStatus('notconnect'), 'notconnect');
});

test('normalizeInterfaceName expands Cisco abbreviations', function () {
  assert.equal(SD.normalizeInterfaceName('GigabitEthernet1/0/1'), 'Gi1/0/1');
  assert.equal(SD.normalizeInterfaceName('TenGigabitEthernet1/1/1'), 'Te1/1/1');
});

test('parseLog extracts hostname, ports, vlans, and neighbors', function () {
  var devices = SD.parseLog(sampleLog);
  assert.equal(devices.length, 1);

  var device = devices[0];
  assert.equal(device.hostname, 'SW-CORE-01');
  assert.ok(device.physicalPorts.length >= 8);

  var gi101 = device.ports.find(function (p) { return p.name === 'Gi1/0/1'; });
  assert.ok(gi101);
  assert.equal(gi101.accessVlan, '10');
  assert.equal(gi101.voiceVlan, '20');
  assert.equal(gi101.neighbor, 'finance-pc-01');

  var gi104 = device.ports.find(function (p) { return p.name === 'Gi1/0/4'; });
  assert.equal(gi104.adminStatus, 'disabled');

  var gi1047 = device.ports.find(function (p) { return p.name === 'Gi1/0/47'; });
  assert.equal(gi1047.mode, 'trunk');
  assert.equal(gi1047.neighbor, 'DIST-SW-02');

  assert.ok(device.vlans['10']);
  assert.equal(device.vlans['10'].name, 'FINANCE');
});

test('parseLog handles show ip interface brief with up status', function () {
  var devices = SD.parseLog(ipBriefLog);
  assert.equal(devices.length, 1);

  var device = devices[0];
  var gi101 = device.ports.find(function (p) { return p.name === 'Gi1/0/1'; });
  assert.equal(gi101.linkStatus, 'connected');
  assert.equal(gi101.accessVlan, '100');

  assert.ok(Object.keys(device.vlans).length >= 3);
  assert.equal(device.vlans['100'].name, 'OFFICE LAN');
  assert.ok(device.counts.up >= 4);
});

test('parseLog uses show interfaces description as description fallback', function () {
  var devices = SD.parseLog(ipBriefLog);
  var gi102 = devices[0].ports.find(function (p) { return p.name === 'Gi1/0/2'; });
  assert.equal(gi102.description, 'USER-PC-02');

  var te111 = devices[0].ports.find(function (p) { return p.name === 'Te1/1/1'; });
  assert.equal(te111.description, '10G UPLINK CORE');

  var gi1047 = devices[0].ports.find(function (p) { return p.name === 'Gi1/0/47'; });
  assert.equal(gi1047.description, 'TRUNK TO CORE DIST SWITCH');
});

test('buildFaceplateGroups splits odd and even ports', function () {
  var devices = SD.parseLog(sampleLog);
  var groups = SD.buildFaceplateGroups(devices[0].physicalPorts);
  assert.ok(groups.length >= 1);

  var giGroup = groups.find(function (g) { return g.key.indexOf('Gi1/0') !== -1; });
  assert.ok(giGroup);
  assert.ok(giGroup.oddRow.some(function (p) { return p.name === 'Gi1/0/1'; }));
  assert.ok(giGroup.evenRow.some(function (p) { return p.name === 'Gi1/0/2'; }));
});

test('buildWorkbookBuffer produces valid xlsx zip', async function () {
  var devices = SD.parseLog(sampleLog);
  var buffer = await SD.buildWorkbookBuffer(devices[0]);
  var bytes = Buffer.from(buffer);

  assert.equal(bytes[0], 0x50);
  assert.equal(bytes[1], 0x4B);
  assert.ok(bytes.length > 1000);
});

test('sanitizeCellValue removes illegal XML control characters', function () {
  var cleaned = SD.sanitizeCellValue('ok\x00\x07text');
  assert.equal(cleaned, 'oktext');
});

test('parseLog handles abbreviated Cisco commands (sh int status, sh vlan br)', function () {
  var devices = SD.parseLog(c3850Log);
  assert.equal(devices.length, 1);
  assert.equal(devices[0].hostname, 'TST_C3850');

  var gi104 = devices[0].ports.find(function (p) { return p.name === 'Gi1/0/4'; });
  assert.equal(gi104.linkStatus, 'connected');
  assert.equal(gi104.vlanName, 'HKT_WAN');
  assert.equal(gi104.speed, 'a-1000');

  var gi1047 = devices[0].ports.find(function (p) { return p.name === 'Gi1/0/47'; });
  assert.equal(gi1047.linkStatus, 'connected');

  var gi1046 = devices[0].ports.find(function (p) { return p.name === 'Gi1/0/46'; });
  assert.equal(gi1046.linkStatus, 'notconnect');

  assert.ok(devices[0].counts.up >= 2);
  assert.ok(Object.keys(devices[0].vlans).length >= 3);
});

test('color registry assigns stable vlan colors', function () {
  var devices = SD.parseLog(c3850Log).map(function (d) { return SD.enrichDevice(d); });
  var registry = devices[0].colorRegistry;
  assert.equal(SD.getVlanColor(registry, '788'), registry.vlan['788']);
  assert.equal(SD.getVlanColor(registry, '788'), SD.getVlanColor(registry, '788'));
  assert.notEqual(registry.vlan['788'], registry.vlan['1140']);
});

test('portStatusDisplay separates status from vlan color', function () {
  var devices = SD.parseLog(c3850Log).map(function (d) { return SD.enrichDevice(d); });
  var port = devices[0].ports.find(function (p) { return p.name === 'Gi1/0/4'; });
  var vlanColor = SD.portVlanColor(port, devices[0].colorRegistry);
  var status = SD.portStatusDisplay(port);
  assert.equal(status.text, 'connected');
  assert.notEqual(vlanColor, status.fill);
});

test('portVlanDisplay uses light text on trunk background', function () {
  var devices = SD.parseLog(sampleLog).map(function (d) { return SD.enrichDevice(d); });
  var trunkPort = devices[0].ports.find(function (p) { return p.mode === 'trunk'; });
  assert.ok(trunkPort, 'expected a trunk port in sample log');
  var vlan = SD.portVlanDisplay(trunkPort, devices[0].colorRegistry);
  assert.equal(vlan.text, 'TRUNK');
  assert.equal(vlan.fill, SD.TRUNK_COLOR);
  assert.equal(vlan.textColor, '#FFFFFF');
});

test('buildWorkbook uses one Faceplate sheet per switch', async function () {
  var ExcelJS = require('exceljs');
  var devices = SD.parseLog(ipBriefLog);
  var buffer = await SD.buildWorkbookBuffer(devices[0]);
  var workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  var names = workbook.worksheets.map(function (sheet) { return sheet.name; });
  assert.deepEqual(names, ['Faceplate', 'Ports', 'VLANs']);
});

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

test('cleanLog removes PuTTY noise', function () {
  var cleaned = SD.cleanLog('line1\x08\x08--More-- \nline2');
  assert.match(cleaned, /line1/);
  assert.doesNotMatch(cleaned, /--More--/);
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

test('buildFaceplateGroups splits odd and even ports', function () {
  var devices = SD.parseLog(sampleLog);
  var groups = SD.buildFaceplateGroups(devices[0].physicalPorts);
  assert.ok(groups.length >= 1);

  var giGroup = groups.find(function (g) { return g.key.indexOf('Gi1/0') !== -1; });
  assert.ok(giGroup);
  assert.ok(giGroup.oddRow.some(function (p) { return p.name === 'Gi1/0/1'; }));
  assert.ok(giGroup.evenRow.some(function (p) { return p.name === 'Gi1/0/2'; }));
});

test('buildWorkbookXml contains worksheets and styles', function () {
  var devices = SD.parseLog(sampleLog);
  var xml = SD.buildWorkbookXml(devices[0]);

  assert.match(xml, /<\?xml version="1.0"\?>/);
  assert.match(xml, /<\?mso-application progid="Excel\.Sheet"\?>/);
  assert.match(xml, /<Worksheet ss:Name="Ports">/);
  assert.match(xml, /<Worksheet ss:Name="VLANs">/);
  assert.match(xml, /<Interior ss:Color="#/);
  assert.match(xml, /SW-CORE-01/);
});

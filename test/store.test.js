'use strict';

var assert = require('node:assert/strict');
var fs = require('node:fs');
var os = require('node:os');
var path = require('node:path');
var test = require('node:test');

var root = path.join(__dirname, '..');
require(path.join(root, 'js', 'parse.js'));
require(path.join(root, 'js', 'faceplate.js'));

var sampleLog = fs.readFileSync(path.join(root, 'fixtures', 'sample-cisco.log'), 'utf8');
var SD = globalThis.SwitchDraw;
var serverModule = require(path.join(root, 'server.js'));

test('writeRecord saves parsed devices as json in store folder', function () {
  var tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'switchdraw-store-'));
  var originalStoreDir = serverModule.getStoreDir();
  var testStoreDir = path.join(tempDir, 'switches');
  serverModule.setStoreDir(testStoreDir);
  fs.mkdirSync(testStoreDir, { recursive: true });

  try {
    var devices = SD.parseLog(sampleLog);
    var record = serverModule.writeRecord({
      sourceFile: 'sample-cisco.log',
      devices: devices
    });

    assert.ok(record.id);
    assert.equal(record.sourceFile, 'sample-cisco.log');
    assert.equal(record.devices.length, 1);

    var filePath = path.join(testStoreDir, record.id + '.json');
    assert.ok(fs.existsSync(filePath));

    var loaded = serverModule.readRecord(record.id);
    assert.equal(loaded.devices[0].hostname, 'SW-CORE-01');
    assert.equal(loaded.devices[0].colorRegistry, undefined);

    var listed = serverModule.listRecords();
    assert.equal(listed.length, 1);
    assert.deepEqual(listed[0].hostnames, ['SW-CORE-01']);

    assert.equal(serverModule.deleteRecord(record.id), true);
    assert.equal(fs.existsSync(filePath), false);
  } finally {
    serverModule.setStoreDir(originalStoreDir);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

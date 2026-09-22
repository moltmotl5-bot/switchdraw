/* global SwitchDraw */
var SwitchDraw = SwitchDraw || {};

(function (SD) {
  'use strict';

  function isStoreAvailable() {
    return typeof fetch === 'function' && typeof location !== 'undefined' &&
      (location.protocol === 'http:' || location.protocol === 'https:');
  }

  function request(path, options) {
    if (!isStoreAvailable()) {
      return Promise.reject(new Error('本地儲存需透過 SwitchDraw 伺服器執行（npm start）'));
    }

    return fetch(path, options).then(function (res) {
      return res.json().then(function (payload) {
        if (!res.ok) {
          throw new Error(payload.error || ('HTTP ' + res.status));
        }
        return payload;
      });
    });
  }

  function stripDerivedFields(device) {
    var copy = Object.assign({}, device);
    delete copy.colorRegistry;
    return copy;
  }

  function listRecords() {
    return request('/api/records').then(function (payload) {
      return payload.records || [];
    });
  }

  function getRecord(id) {
    return request('/api/records/' + encodeURIComponent(id));
  }

  function saveDevices(devices, sourceFile) {
    return request('/api/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceFile: sourceFile || '',
        devices: devices.map(stripDerivedFields)
      })
    });
  }

  function deleteRecord(id) {
    return request('/api/records/' + encodeURIComponent(id), {
      method: 'DELETE'
    });
  }

  function enrichDevices(devices) {
    return devices.map(function (device) {
      return SD.enrichDevice(device);
    });
  }

  SD.store = {
    isAvailable: isStoreAvailable,
    listRecords: listRecords,
    getRecord: getRecord,
    saveDevices: saveDevices,
    deleteRecord: deleteRecord,
    enrichDevices: enrichDevices
  };
})(SwitchDraw);

(function (root, sd) {
  root.SwitchDraw = sd;
})(typeof globalThis !== 'undefined' ? globalThis : this, SwitchDraw);

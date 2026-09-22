# SwitchDraw

輕量、零依賴的 Cisco IOS / IOS-XE 交換器埠位圖產生器。上傳 PuTTY 擷取的 `*.log`，在瀏覽器本機解析後下載 Excel 前面板圖（SpreadsheetML `.xls`）。

## 功能

- 解析 `show running-config`、`show interfaces status`、`show vlan brief`、`show cdp neighbors`、`show lldp neighbors`
- 依堆疊成員產生前面板圖（奇數埠上排、偶數埠下排）
- 依 VLAN / Trunk / Shutdown 狀態上色
- 附 `Ports` 與 `VLANs` 明細工作表

## 使用方式

1. 直接用瀏覽器開啟 [`index.html`](index.html)，或部署至任意靜態網站。
2. 拖放或選擇 PuTTY 日誌（`.log` / `.txt`）。
3. 預覽前面板後，點擊「下載 Excel 埠位圖」。

所有處理都在瀏覽器完成，不會上傳設定檔，也不使用任何外部程式庫或 CDN。

## 測試

```bash
node --test test/parse.test.js
```

測試使用 Node 內建 `node:test`，讀取 [`fixtures/sample-cisco.log`](fixtures/sample-cisco.log) 驗證解析與 Excel XML 產生。

## 專案結構

- [`index.html`](index.html) — 主頁面
- [`js/parse.js`](js/parse.js) — Cisco 日誌解析
- [`js/faceplate.js`](js/faceplate.js) — 前面板分組與配色
- [`js/workbook.js`](js/workbook.js) — SpreadsheetML 活頁簿產生
- [`js/app.js`](js/app.js) — 上傳、預覽、下載 UI

# SwitchDraw

**版本 1.1.0**

輕量的 Cisco IOS / IOS-XE 交換器埠位圖產生器。上傳 PuTTY 擷取的 `*.log`，在瀏覽器本機解析後下載 Excel 前面板圖（標準 `.xlsx`，相容 Microsoft 365 Excel）。

## 功能

- 解析 `show running-config`、`show interfaces status`、`show vlan brief`、`show cdp neighbors`、`show lldp neighbors`
- 依堆疊成員產生前面板圖（奇數埠上排、偶數埠下排）
- 依 VLAN / Trunk / Shutdown 狀態上色
- 附 `Ports` 與 `VLANs` 明細工作表

## Windows 本機測試（v1.1.0）

1. 取得程式碼：
   ```powershell
   git clone https://github.com/moltmotl5-bot/switchdraw.git
   cd switchdraw
   git checkout v1.1.0
   ```
2. 用 **Chrome** 或 **Edge** 開啟資料夾內的 `index.html`（雙擊即可）。
3. 先用內附範例 [`fixtures/sample-cisco.log`](fixtures/sample-cisco.log) 測試上傳與 Excel 下載。
4. 再用您從 PuTTY 擷取的真實 `.log` 測試。下載的檔案為 `.xlsx`，可直接用 **Microsoft 365 Excel** 開啟。

不需安裝 Node.js 或 npm（`vendor/exceljs.min.js` 已內附）。若瀏覽器阻擋本機檔案，可改用：
```powershell
cd switchdraw
python -m http.server 8080
```
然後開啟 `http://localhost:8080/index.html`。

## PuTTY 日誌指令（依序執行）

```text
terminal length 0
terminal width 0
show running-config
show interfaces status
show vlan brief
show cdp neighbors detail
show lldp neighbors detail
```

PuTTY 設定：**Session → Logging → All session output**，並勾選 **Omit known password fields**。

## 使用方式

1. 直接用瀏覽器開啟 [`index.html`](index.html)，或部署至任意靜態網站。
2. 拖放或選擇 PuTTY 日誌（`.log` / `.txt`）。
3. 預覽前面板後，點擊「下載 Excel 埠位圖」。

所有處理都在瀏覽器完成，不會上傳設定檔。Excel 產生使用內附的 [ExcelJS](https://github.com/exceljs/exceljs)（`vendor/exceljs.min.js`），無 CDN、無建置步驟。

## 測試（開發者）

```bash
npm install
npm test
```

測試讀取 [`fixtures/sample-cisco.log`](fixtures/sample-cisco.log)，驗證解析與 `.xlsx` 產生。

## 專案結構

- [`index.html`](index.html) — 主頁面
- [`js/parse.js`](js/parse.js) — Cisco 日誌解析
- [`js/faceplate.js`](js/faceplate.js) — 前面板分組與配色
- [`js/workbook.js`](js/workbook.js) — ExcelJS 活頁簿產生
- [`vendor/exceljs.min.js`](vendor/exceljs.min.js) — Excel 產生函式庫（內附）
- [`js/app.js`](js/app.js) — 上傳、預覽、下載 UI

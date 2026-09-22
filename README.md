# SwitchDraw

**版本 1.2.0**

輕量的 Cisco IOS / IOS-XE 交換器埠位圖產生器。上傳 PuTTY 擷取的 `*.log`，在瀏覽器本機解析後下載 Excel 前面板圖（標準 `.xlsx`，相容 Microsoft 365 Excel）。

## 功能

- 解析 `show running-config`、`show interfaces status`、`show interfaces description`、`show ip interface brief`、`show vlan brief`、`show cdp/lldp neighbors`
- 依堆疊成員產生前面板圖（奇數埠上排、偶數埠下排）
- 中央 VLAN 色碼表：同一 VLAN 在圖例、前面板、VLANs 工作表使用相同顏色
- Excel 前面板每埠一欄四列：Interface / VLAN ID / Description / Port Status
- 附 `Ports` 與 `VLANs` 明細工作表
- **本地儲存**：解析結果以 JSON 寫入 `data/switches/`
- **側邊欄導覽**與 **歷史記錄頁**（[`history.html`](history.html)）

## Windows 本機測試（v1.2.0）

1. 取得程式碼：
   ```powershell
   git clone https://github.com/moltmotl5-bot/switchdraw.git
   cd switchdraw
   git pull
   npm install
   npm start
   ```
2. 用 **Chrome** 或 **Edge** 開啟 `http://localhost:8080/index.html`。**請按 Ctrl+F5 強制重新整理**。
3. 確認側邊欄顯示 **SwitchDraw v1.2.0**，含「上傳解析」與「歷史記錄」。

支援 Cisco 縮寫指令（`sh int status`、`sh vlan br`、`sh ip int br`、`sh cdp nei det` 等）。
4. 先用 [`fixtures/sample-cisco.log`](fixtures/sample-cisco.log) 測試；解析後應在 `data/switches/` 產生 JSON，並可在「歷史記錄」查看。
5. 再用 PuTTY 真實 `.log` 測試。

若只需靜態預覽（不寫入 JSON），仍可直接開啟 `index.html`；但本地儲存與歷史記錄需 `npm start`。

## PuTTY 日誌指令（依序執行）

```text
terminal length 0
terminal width 0
show running-config
show interfaces status
show interfaces description
show ip interface brief
show vlan brief
show cdp neighbors detail
show lldp neighbors detail
```

PuTTY 設定：**Session → Logging → All session output**，並勾選 **Omit known password fields**。

## 使用方式

1. 執行 `npm start`，開啟 `http://localhost:8080/index.html`。
2. 拖放或選擇 PuTTY 日誌（`.log` / `.txt`）。
3. 預覽前面板後，點擊「下載 Excel 埠位圖」；解析結果會自動儲存至 `data/switches/*.json`。
4. 在側邊欄進入「歷史記錄」，查看、下載或刪除舊記錄。

解析與 Excel 產生在瀏覽器完成；JSON 儲存由本機 Node 伺服器寫入專案資料夾，不會上傳至外部。Excel 使用內附 [ExcelJS](https://github.com/exceljs/exceljs)（`vendor/exceljs.bare.min.js`）。

## 安全性（Cortex XDR / 防毒軟體）

輸出 `.xlsx` **不含 VBA 巨集、公式或外部連結**，僅為埠位靜態資料。詳見 [SECURITY.md](SECURITY.md)。

若仍看到 `.xls` 或 Excel 報「檔案毀損」，代表瀏覽器仍在使用 **v1.0.0 舊快取**，請 Ctrl+F5 或重新 clone 後再試。

## 測試（開發者）

```bash
npm install
npm test
```

測試讀取 [`fixtures/sample-cisco.log`](fixtures/sample-cisco.log)，驗證解析與 `.xlsx` 產生。

## 專案結構

- [`index.html`](index.html) — 上傳解析頁
- [`history.html`](history.html) — 歷史記錄頁
- [`server.js`](server.js) — 靜態檔案 + JSON 儲存 API
- [`data/switches/`](data/switches/) — 解析結果 JSON（`.gitignore` 排除實際資料）
- [`js/parse.js`](js/parse.js) — Cisco 日誌解析
- [`js/faceplate.js`](js/faceplate.js) — 前面板分組與配色
- [`js/workbook.js`](js/workbook.js) — ExcelJS 活頁簿產生
- [`js/ui.js`](js/ui.js) — 共用摘要／預覽渲染
- [`js/store-client.js`](js/store-client.js) — 前端儲存 API 客戶端
- [`js/layout.js`](js/layout.js) — 側邊欄版面
- [`vendor/exceljs.bare.min.js`](vendor/exceljs.bare.min.js) — Excel 產生函式庫（瀏覽器版，內附）
- [`SECURITY.md`](SECURITY.md) — 安全性與 XDR 說明
- [`js/app.js`](js/app.js) — 上傳、預覽、下載 UI
- [`js/history.js`](js/history.js) — 歷史記錄 UI

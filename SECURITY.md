# SwitchDraw 安全性說明

## 輸出 Excel 檔案（.xlsx）內容

SwitchDraw 產生的 `.xlsx` 為標準 Office Open XML 試算表，**僅含靜態資料**，不包含：

- VBA 巨集（無 `vbaProject.bin`）
- ActiveX 控制項
- 外部資料連結或 DDE
- 可執行程式碼或腳本
- Excel 4.0 宏表（XLM）
- 嵌入 OLE 物件

檔案內部為一般 XML 工作表（`xl/worksheets/sheet*.xml`）、樣式（`xl/styles.xml`）與字串表（`xl/sharedStrings.xml`），內容為交換器埠位、VLAN、描述等純文字／數字。

## 網頁應用程式

- 所有解析與 Excel 產生在**使用者瀏覽器本機**完成
- **不會**上傳設定檔至任何伺服器
- **不會**在執行時連線 CDN 或外部 API
- 唯一內附函式庫：`vendor/exceljs.bare.min.js`（Excel 產生用）

## Cortex XDR / 防毒軟體

若安全軟體對「瀏覽器產生的 `.xlsx` 下載」發出警示，通常原因為：

1. **下載行為本身**（瀏覽器動態產生檔案），而非檔案內含惡意腳本
2. **仍在使用舊版 v1.0.0**（輸出為 SpreadsheetML `.xls`，Excel 可能報錯「檔案毀損」）

請確認使用 **v1.1.1 或以上**，頁面標題應顯示 `SwitchDraw v1.1.1`，下載檔名為 `*-switchport.xlsx`。

## 自行驗證

將 `.xlsx` 重新命名為 `.zip` 後解壓縮，檢查是否**不存在**：

- `xl/vbaProject.bin`
- `xl/embeddings/`
- 含 `externalLink` 的路徑

或請資安團隊以 SHA256 雜湊比對官方發布版本。

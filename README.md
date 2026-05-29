# TOEIC-9000 | 多益考試核心高頻學習字庫

本專案是一個專為多益（TOEIC）考試設計的 **9000 核心高頻單字學習系統**。我們已經在此專案中初始化了一個基於 **React + Vite + TypeScript + Vanilla CSS** 的精美單頁 Web 應用程式（SPA），幫助使用者高效率記誦與自我檢測。

## 系統核心功能
1. 📊 **學習儀表板 (Dashboard)**：呈現單字掌握度（Level 1 至 Level 4）、連續學習天數（Streak）以及近期學習字表。
2. 🔍 **核心字庫搜尋 (Search)**：以分頁表格形式呈現 9000 單字。支援拼寫模糊搜尋、分級過濾與熟記狀態篩選。點擊單字可開啟彈出視窗，動態載入 **Free Dictionary API** 的英英釋義、發音音標與例句。
3. 🧠 **3D 記憶卡片 (Flashcards)**：提供 3D 翻轉卡片。正面顯示單字並提供瀏覽器語音合成（TTS）發音，背面呈現英英釋義，方便使用者以「熟記」與「不熟」進行單字篩選。
4. ⚡ **智慧單字測驗 (Quiz)**：
   - **英英釋義多選題**：從字庫隨機挑選單字並從 API 動態撈取正確釋義，與其他單字的隨機釋義進行混淆測驗。
   - **拼寫字元重組題**：提供英文釋義與被打亂的單字字母，訓練單字正確拼寫。
5. ⚙️ **發音與目標設定 (Settings)**：可設定美音/英音/加音/澳音、調整發音速度，以及重設學習進度。

---

## 專案結構
- `docs/`：多益 9000 單字清單原始檔（[toeic_9000_words.txt](file:///Users/jeff/Documents/repos/TOEIC-9000/docs/toeic_9000_words.txt)）
- `src/`：Vite React TypeScript 原始碼
  - `src/data/`：由原始清單轉換出的單字庫陣列（[words.ts](file:///Users/jeff/Documents/repos/TOEIC-9000/src/data/words.ts)）
  - `src/App.tsx`：主程式邏輯、狀態管理與分頁控制（[App.tsx](file:///Users/jeff/Documents/repos/TOEIC-9000/src/App.tsx)）
  - `src/index.css`：全域設計系統與 3D 翻轉、動畫樣式（[index.css](file:///Users/jeff/Documents/repos/TOEIC-9000/src/index.css)）
- `script/`：資料驗證腳本（[validate_toeic_9000.py](file:///Users/jeff/Documents/repos/TOEIC-9000/script/validate_toeic_9000.py)）
- `index.html`：SEO 優化的網頁入口點（[index.html](file:///Users/jeff/Documents/repos/TOEIC-9000/index.html)）

---

## 開發與執行步驟

### 1. 安裝套件
```bash
npm install
```

### 2. 本地開發伺服器
執行以下命令啟動 Vite 本地開發伺服器（預設為 `http://localhost:5173/`）：
```bash
npm run dev
```

### 3. 專案打包
產出部署用的靜態 HTML/JS/CSS：
```bash
npm run build
```

---

## 數據驗證
您仍然可以執行原始的 Python 腳本來驗證 `docs/toeic_9000_words.txt` 是否符合 9000 個不重複、全小寫英文字母的規則：
```bash
python3 script/validate_toeic_9000.py
```


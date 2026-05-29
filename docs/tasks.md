# TOEIC-9000 App 版本開發工作任務清單 (Tasks)

此任務清單是依據 [TOEIC-9000 App 版本設計與開發規劃書](file:///Users/jeff/Documents/repos/TOEIC-9000/docs/plan.md) 所整理的開發任務進度表。開發過程中可逐步勾選以追蹤進度。

---

## 🏗️ Phase 1: 基礎核心與資料庫 (Foundation & Database)
- [ ] **設計 SwiftData 資料模型 (Data Models)**
  - [ ] 實作 `WordProgress` 模型（欄位包含：單字、頻率排名、難度級別、是否收藏、是否掌握、上次複習時間、複習次數）。
  - [ ] 實作 `UserStreak` 模型（欄位包含：最後學習日期、連續學習天數、每日目標單字量）。
- [ ] **實作資料庫載入模組 (Database Seeder)**
  - [ ] 將 9000 單字資料（目前在 `docs/toeic_9000_words.txt`）打包進 App 資源包。
  - [ ] 實作背景執行緒 Seed 機制，在 App 首次啟動時自動解析並載入至 SwiftData，確保主執行緒（UI）不卡頓。
- [ ] **開發 AVFoundation 原生語音發音服務**
  - [ ] 封裝 `AVSpeechSynthesizer` 離線語音播放器。
  - [ ] 實作控制語速 (0.5x 至 1.5x) 的調整邏輯。
  - [ ] 實作腔調切換（美式英語 `en-US`、英式英語 `en-GB`、加拿大英語 `en-CA`、澳洲英語 `en-AU`），自動搜尋系統可用的 Siri 高品質語音包。

---

## 📱 Phase 2: iOS 手機版開發 (iOS Mobile UX Focus)
- [ ] **主畫面學習儀表板 (Dashboard) 實作**
  - [ ] 設計圓環進度條（呈現整體 9000 字掌握比例）。
  - [ ] 呈現 Level 1 至 Level 4 分級掌握進度條。
  - [ ] 顯示今日學習單字數、已收藏單字數及「連續學習天數」火焰動畫。
  - [ ] 實作最近熟記單字快速查詢的 Sheet 彈窗。
- [ ] **3D 記憶卡片 (Flashcards) 元件開發**
  - [ ] 實作基於 SwiftUI `rotation3DEffect` 的 Y 軸翻轉卡片。
  - [ ] 正面：呈現單字拼寫、Rank 序號、音標（若有）與發音按鈕。
  - [ ] 背面：呈現英英釋義清單（多詞性分組）。
- [ ] **手勢控制與觸覺反饋 (Haptic Feedback) 整合**
  - [ ] 整合 `DragGesture` 手勢：
    - 向右滑動：觸發 `UIImpactFeedbackGenerator(style: .medium)`，將單字標記為「已掌握」並往下一張切換。
    - 向左滑動：觸發 `UINotificationFeedbackGenerator().notificationOccurred(.warning)`，標記為「需要複習 (Again)」並往下一張切換。
    - 向上滑動：觸發 `UIImpactFeedbackGenerator(style: .light)`，將單字加入/移出收藏。
- [ ] **智慧測驗 (Quiz) 元件開發**
  - [ ] **英英釋義多選題**：實作隨機撈取 10 個目標字及 30 個混淆字的釋義邏輯，答對自動更新 `WordProgress` 的掌握狀態。
  - [ ] **拼寫字元重組題**：顯示打亂的英文字母區塊，提供手勢點擊排序拼寫。
- [ ] **iOS 互動式小工具 (Interactive Widgets) 實作**
  - [ ] 開發 Widget Extension，提供 Medium 與 Small 尺寸小工具。
  - [ ] 使用者可直接在 Widget 上點擊「發音」與標記「熟記」今日單字，無須開啟 App。

---

## 💻 Phase 3: macOS 電腦版開發 (macOS Desktop Efficiency)
- [ ] **NavigationSplitView 寬螢幕佈局設計**
  - [ ] 左欄：Sidebar 導覽列（儀表板、字庫搜尋、記憶卡、測驗、設定）。
  - [ ] 中欄：單字清單，支援流暢滾動（LazyVStack）與單字狀態徽章。
  - [ ] 右欄：單字詳細釋義面板與發音大按鈕，支援分欄多視窗顯示。
- [ ] **鍵盤快捷鍵 (Keyboard Shortcuts) 綁定**
  - [ ] 記憶卡介面：`Space` 翻面、`Arrow Right` (或 `D`) 熟記、`Arrow Left` (或 `A`) 複習、`Arrow Up` (或 `S`) 收藏。
  - [ ] 測驗介面：數字鍵 `1`, `2`, `3`, `4` 選擇對應答案。
  - [ ] 全域搜尋快捷鍵：支援鍵盤快捷鍵 `Cmd + F` 自動聚焦（Focus）至搜尋欄位。
- [ ] **常駐選單列工具 (Menubar Mini-App) 開發**
  - [ ] 設計 macOS `MenuBarExtra` 小工具。
  - [ ] 提供精簡的「單字速記卡」，支援背景工作時快速查詢與發音。

---

## ⚙️ Phase 4: 系統優化與上架準備 (Performance & Deployment)
- [ ] **M4 晶片效能與資料庫優化**
  - [ ] 利用 SwiftData 的 FetchDescriptor 及 Predicate 進行模糊搜尋優化，確保 9000 筆資料庫在 M4 Mac 上的搜尋延遲低於 10ms。
  - [ ] 測試 Metal 渲染動畫，確保 iOS/macOS 卡片翻轉在 120Hz 下皆能流暢不掉幀。
- [ ] **iCloud 進度雲端同步 (CloudKit Integration)**
  - [ ] 設定 SwiftData 啟用 CloudKit 同步，使手機與電腦版學習狀態保持一致。
- [ ] **上架與封裝準備**
  - [ ] 建立 Apple Developer App ID 與相關認證設定。
  - [ ] 建立 TestFlight 測試群組，發佈 Beta 測試版。
  - [ ] 設計 App 圖示、製作 App Store 行銷圖及撰寫功能文案。

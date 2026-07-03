# OmniRaw 專案規範

RAW/JPEG 生命週期連動的照片選片 (culling) 工具。刪 JPG 時同名 RAW 一併處理,並清理孤兒檔案。

## 技術棧
- **後端**:Tauri 2.9 + Rust(rawler 解 RAW 內嵌預覽、trash 進回收桶、rayon 縮圖池)
- **前端**:React 19 + TypeScript + Vite;zustand 狀態、@tanstack/react-virtual 虛擬化、i18next 雙語(zh-TW 預設 + en,兩份 locale 必須同步維護)
- **圖片傳輸**:自訂 `omniraw://` protocol(Windows 上為 `http://omniraw.localhost/...`),不用 asset protocol
- 完整實作計畫:`~/.claude/plans/typed-coalescing-bachman.md`

## 核心規則
- **配對規則**:同資料夾 + 同檔名 basename(大小寫不敏感)才算一組;一組可含 1 RAW + 多非 RAW
- **輸出檔配對 (prefix matching)**:非 RAW 檔名 =「某 RAW 檔名 + 非英數分隔符 + 後綴」時歸入該 RAW 組(`IMG_0001_edit.jpg` → `IMG_0001.CR3`;取最長相符 RAW 檔名;`IMG_00010.jpg` 不誤配)。設定 `matchExportedSuffixes` 可關(預設開)。背景:使用者修完 RAW 會輸出多張 JPG 檢查,不可被判成孤兒
- **刪除一律走回收桶**(`trash` crate),v1 無永久刪除
- rawler 版本 **pin 死**(`=0.7.2`),所有 rawler 呼叫只允許出現在 `preview.rs` 與 `exif.rs`
- 不啟用 Tauri fs plugin;所有吃路徑的 command 必須 canonicalize 並驗證位於 scan root 之下
- Rust DTO(`src-tauri/src/model.rs`)與 TS 型別(`src/types.ts`)手動鏡射,改一邊必改另一邊;serde 一律 camelCase rename
- 新增 UI 文案必須同時寫入 `src/i18n/locales/zh-TW.json` 與 `en.json`
- **標記模型為檔案級 (file-level)**:`cullStore.marked: Map<groupId, Set<filePath>>`;X/J/R 只是快速設定檔案集合的捷徑;審閱與刪除都以檔案為單位(後端走 `delete_files(paths)`)。背景:一個 RAW 可能有多張輸出 JPG,使用者要能逐檔選刪
- 選片鍵位:←/→ 翻頁、**P 或 ↑/↓ 在同組檔案間輪播**(JPG→輸出檔→RAW)、**Delete/Backspace/X 刪整組(再按同鍵取消,標記後自動跳下一張)**、J 只刪 JPG、R 只刪 RAW(J/R 也自動前進)、**Space 標記/取消目前預覽的單一檔案**、U 取消整組標記、Enter 進審閱、Esc 返回。使用者明確要求快捷鍵人性化(刪除用 Delete 鍵)

## 版控
- 每個 milestone(M1–M6)驗收通過後 commit 一次(使用者已授權),Conventional Commits 風格

## 目錄結構
```
OmniRaw/
├── CLAUDE.md              # 本檔:專案規範與結構(單一事實來源)
├── README.md              # 精簡門面(指向本檔)
├── index.html / vite.config.ts / tsconfig*.json / package.json
├── src/                   # React 前端
│   ├── main.tsx           # React root + i18n + 全域樣式
│   ├── App.tsx            # 依 libraryStore.view 切換畫面(無 router)
│   ├── types.ts           # TS DTO(鏡射 model.rs)
│   ├── api/               # typed invoke/listen 包裝、omniraw:// URL 組裝(M2+)
│   ├── stores/            # zustand:libraryStore(view/掃描結果)、cullStore、settingsStore
│   ├── hooks/             # useGlobalHotkeys、useThumbnail(M3+)
│   ├── i18n/              # index.ts + locales/zh-TW.json, en.json
│   ├── styles/app.css     # 淺色主題全域樣式
│   └── components/
│       ├── layout/        # AppShell、Sidebar、StatusBar
│       ├── welcome/       # WelcomeScreen
│       ├── browse/        # BrowseScreen(M4 加 GridBrowser 等)
│       ├── cull/          # CullView(M4 加 PreviewPane/Filmstrip/ExifPanel)
│       ├── review/        # ReviewScreen
│       ├── orphans/       # OrphanScreen
│       ├── settings/      # SettingsScreen
│       └── common/        # EmptyState 等共用件
└── src-tauri/             # Rust 後端
    ├── Cargo.toml / tauri.conf.json / build.rs
    ├── capabilities/default.json   # core:default + dialog:default
    ├── icons/
    └── src/
        ├── main.rs / lib.rs        # Builder:plugins、state、protocol、commands 接線
        ├── error.rs                # AppError → { code, message }
        ├── state.rs / model.rs / config.rs / scanner.rs   # M2
        ├── exif.rs / preview.rs / thumbs.rs / protocol.rs # M3
        └── commands/               # scan.rs, media.rs, delete.rs, settings.rs
```

## 驗證
- Rust:`cargo test` + `cargo check`(於 `src-tauri/`)
- 前端:`npm run build`(含 tsc)
- GUI:`npm run tauri dev` 手動 smoke;測試照片用 raw.pixls.us CC0 樣本(Canon CR2/CR3 必測)

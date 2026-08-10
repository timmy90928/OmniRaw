# OmniRaw 專案規範

RAW/JPEG 生命週期連動的照片選片 (culling) 工具。刪 JPG 時同名 RAW 一併處理,並清理孤兒檔案。

## 技術棧
- **後端**:Tauri 2(目前 `Cargo.lock` 鎖定 2.11.5)+ Rust(rawler 解 RAW 內嵌預覽、trash 進回收桶、notify 監控資料夾、rayon 縮圖池;tauri-plugin-updater/process 做桌面自動更新)
- **前端**:React 19 + TypeScript + Vite;zustand 狀態、@tanstack/react-virtual 虛擬化、i18next 雙語(zh-TW 預設 + en,兩份 locale 必須同步維護)
- **圖片傳輸**:自訂 `omniraw://` protocol(Windows 上為 `http://omniraw.localhost/...`),不用 asset protocol
- 完整實作計畫:`~/.claude/plans/typed-coalescing-bachman.md`

## 核心規則
- **配對規則**:同資料夾 + 同檔名 basename(大小寫不敏感)才算一組;一組可含 1 RAW + 多非 RAW
- **輸出檔配對 (prefix matching)**:非 RAW 檔名 =「某 RAW 檔名 + 非英數分隔符 + 後綴」時歸入該 RAW 組(`IMG_0001_edit.jpg` → `IMG_0001.CR3`;取最長相符 RAW 檔名;`IMG_00010.jpg` 不誤配)。設定 `matchExportedSuffixes` 可關(預設開)。背景:使用者修完 RAW 會輸出多張 JPG 檢查,不可被判成孤兒
- **跨同層資料夾配對**:`matchSiblingFolders` 預設關閉；啟用後僅對 `siblingFolderNames` 明列的資料夾名稱(預設 raw/jpeg/jpg/exports/edited)使用共同 parent 作 logical dir，不得讓其他任意 sibling 誤配
- **刪除一律走回收桶**(`trash` crate),v1 無永久刪除
- **RAW→JPG 轉檔**:只對 `RawOnly` 組;取 RAW 內嵌預覽(`preview::export_embedded_jpeg`,仍在 preview.rs 內,符合 rawler 隔離)非完整 demosaic;輸出存 **RAW 旁邊同 basename `.jpg`**,既有檔不覆寫(改 `_converted-N`);轉完自動觸發重掃使該組變 Complete。command:`convert_raw_to_jpg(path)`
- **重新整理**:F5 或 status bar 鈕重掃當前 scan root(後端 `scan_folder` 冪等,無新 command);`cullStore.reconcileMarks` 保留存活檔標記、丟棄已刪檔;停在當前畫面(`setScanResult` 僅在 root 改變時才跳 browse)
- **自動監控**:`notify` 遞迴監控 scan root，送 `scan://changed`；前端 700ms debounce 後重掃。不可監控 scan root 外路徑
- **HEIC/HEIF**:macOS 走系統 ImageIO (`sips`)，Windows 走 Shell/WIC (`IShellItemImageFactory`)；不引入 AGPL decoder。Windows 沒安裝 HEIF codec 時明確回報預覽錯誤
- **XMP 評分**:command `write_xmp_rating(path, -1..=5)` 僅允許 scan root 內檔案，sidecar 採 `create_new`，既有 `.xmp` 一律拒絕覆寫
- **刪除稽核**:每次刪除後在 app data 追加 `deletion-operations.jsonl` 並重建 `deletion-manifest.json`；稽核寫入失敗不得使已完成的刪除被前端重試
- **自動更新**:tauri-plugin-updater 檢查 GitHub Releases 的 `latest.json`→下載→安裝→`relaunch`;需簽章金鑰對,公鑰在 `tauri.conf.json` `plugins.updater.pubkey`、私鑰為 GitHub secret `TAURI_SIGNING_PRIVATE_KEY`(+`_PASSWORD`);`bundle.createUpdaterArtifacts:true` 產 `latest.json`+`.sig`;**dev 模式測不到、只在打包版生效**
- rawler 版本 **pin 死**(`=0.7.2`),所有 rawler 呼叫只允許出現在 `preview.rs` 與 `exif.rs`
- 不啟用 Tauri fs plugin;所有吃路徑的 command 必須 canonicalize 並驗證位於 scan root 之下
- Rust DTO(`src-tauri/src/model.rs`)與 TS 型別(`src/types.ts`)手動鏡射,改一邊必改另一邊;serde 一律 camelCase rename
- 新增 UI 文案必須同時寫入 `src/i18n/locales/zh-TW.json` 與 `en.json`
- **標記模型為檔案級 (file-level)**:`cullStore.marked: Map<groupId, Set<filePath>>`;X/J/R 只是快速設定檔案集合的捷徑;審閱與刪除都以檔案為單位(後端走 `delete_files(paths)`)。背景:一個 RAW 可能有多張輸出 JPG,使用者要能逐檔選刪
- 選片鍵位:←/→ 翻頁、**P 或 ↑/↓ 在同組檔案間輪播**(JPG→輸出檔→RAW)、**Delete/Backspace/X 刪整組(再按同鍵取消,標記後自動跳下一張)**、J 只刪 JPG、R 只刪 RAW(J/R 也自動前進)、**Space 標記/取消目前預覽的單一檔案**、U 取消整組標記、Enter 進審閱、Esc 返回。使用者明確要求快捷鍵人性化(刪除用 Delete 鍵)。**F5 = 重掃當前資料夾(全域快捷鍵,任何畫面皆可;`useGlobalHotkeys` 擋修飾鍵故 Ctrl/Cmd+R 不可用)**

## 版控
- 每個 milestone(M1–M6)驗收通過後 commit 一次(使用者已授權),Conventional Commits 風格

## 目錄結構
```
OmniRaw/
├── AGENTS.md              # Codex 入口;指向本檔並補充交付前驗證
├── CLAUDE.md              # 本檔:專案規範與結構(單一事實來源)
├── README.md              # 精簡門面(指向本檔)
├── CHANGELOG.md           # 版本記錄(Keep a Changelog;About 頁以 ?raw 讀入渲染)
├── index.html / vite.config.ts / tsconfig*.json / package.json
├── src/                   # React 前端
│   ├── main.tsx           # React root + i18n + 全域樣式
│   ├── App.tsx            # 依 libraryStore.view 切換畫面(無 router)
│   ├── types.ts           # TS DTO(鏡射 model.rs)
│   ├── api/               # commands.ts(typed invoke)、events.ts(typed listen)、imageUrl.ts(omniraw:// URL)
│   ├── stores/            # zustand:libraryStore、cullStore(檔案級標記 + reconcileMarks)、settingsStore、thumbStore、toastStore
│   ├── hooks/             # useGlobalHotkeys、useOpenFolder、useRefreshFolder(F5 重掃)、useConvertRaw(RAW→JPG)
│   ├── utils/marks.ts     # groupFiles 順序、markSummary 徽章分類
│   ├── i18n/              # index.ts + locales/zh-TW.json, en.json(必須同步)
│   ├── styles/app.css     # 淺色主題全域樣式
│   └── components/
│       ├── layout/        # AppShell、Sidebar、StatusBar
│       ├── welcome/       # WelcomeScreen
│       ├── browse/        # BrowseScreen、GridBrowser(虛擬化)、StatusBadge
│       ├── compare/       # CompareScreen(2–4 組並排比較)
│       ├── similar/       # SimilarScreen(時間窗 + average hash 分群)
│       ├── cull/          # CullView、PreviewPane、Filmstrip、ExifPanel
│       ├── review/        # ReviewScreen(逐檔 checkbox)
│       ├── orphans/       # OrphanScreen(RAW 區塊含 RAW→JPG 轉檔鈕)
│       ├── settings/      # SettingsScreen、ExtensionListEditor
│       ├── about/         # AboutScreen(版本 + changelog + 檢查/自動更新)
│       └── common/        # EmptyState、GroupThumb、MarkBadge、ConfirmDialog、Toasts、Spinner
└── src-tauri/             # Rust 後端
    ├── Cargo.toml / tauri.conf.json / build.rs
    ├── capabilities/default.json   # core/dialog/updater/process permissions
    ├── icons/
    └── src/
        ├── main.rs / lib.rs        # Builder:plugins、state、protocol、commands 接線
        ├── error.rs                # AppError → { code, message }
        ├── state.rs / model.rs / config.rs / scanner.rs / watcher.rs / audit.rs
        ├── exif.rs / preview.rs / thumbs.rs / protocol.rs # M3(preview.rs 另含 export_embedded_jpeg)
        └── commands/               # scan/media/delete/settings/convert/xmp/similarity
```

## 驗證
- Rust:`cargo fmt --all -- --check && cargo clippy --locked --all-targets -- -D warnings && cargo test --locked`(於 `src-tauri/`)
- 前端:`npm test && npm run build`(含 tsc)
- GUI:`npm run tauri dev` 手動 smoke;測試照片用 raw.pixls.us CC0 樣本(Canon CR2/CR3 必測)
- 打包:`npm run tauri build` → `src-tauri/target/release/bundle/`(NSIS setup.exe + MSI)
- **打包全自動化(CI-first)**:`.github/workflows/build.yml`——每次 push/PR 跑前端測試/build、Rust fmt/Clippy/tests 與 npm/RustSec 依賴稽核(ubuntu);push `main` 產 macOS universal `.dmg` + Windows installer 為 artifacts;push `v*` tag 自動建 GitHub Release(含 `latest.json`+`.sig` 供自動更新)。Windows runner 會靜默安裝/卸載 MSI；macOS runner 會掛載 DMG 並驗證 app bundle，設定 Apple secrets 時再強制 codesign/Gatekeeper/stapler。簽章細節見 `docs/release-signing.md`
- **自動更新前置(必要)**:`bundle` job 需 repo secrets `TAURI_SIGNING_PRIVATE_KEY` 與 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`(這是 updater 專用簽章,與 Apple 簽章無關);未設則 `bundle` 失敗。發新版流程:同步升 `package.json`/`Cargo.toml`/`tauri.conf.json` 三處 version + 更新 `CHANGELOG.md` → 打 `v*` tag

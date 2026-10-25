# Heading Indent Guides

Indents the content under each heading by its level, draws a vertical guide line for every level, and makes heading sizes easier to tell apart. Works in both Live Preview and Reading view. Indents, guides, and heading styling can each be changed or turned off in the plugin settings; add `heading-indent: false` to a note's frontmatter to turn it off for that note.

---

讓 Obsidian 的大標題、小標題一眼看得出層級：

- 標題底下的內文依層級往右縮排
- 每一層左邊畫一條垂直參考線
- 加大各級標題的字體大小、粗細差異，H1 下方加底線

即時預覽和閱讀模式都有效果。

## 安裝

1. 在 Obsidian 打開你的筆記庫資料夾，進入 `.obsidian/plugins/`。
   - `.obsidian` 是隱藏資料夾。Windows 要在檔案總管勾選「檢視 → 顯示 → 隱藏的項目」才看得到。
   - 沒有 `plugins` 資料夾就自己建一個。
2. 建一個 `heading-indent-guides` 資料夾放進去，裡面要有 `manifest.json`、`main.js`、`styles.css` 三個檔案。
3. 重新開啟 Obsidian。
4. 設定 → 第三方外掛 → 關閉限制模式（如果有）→ 在「已安裝的外掛」裡打開 **Heading Indent Guides**。

如果原本有裝 Heading Level Indent 外掛，請先關掉它，不然會重複縮排。

## 設定

設定 → 第三方外掛程式 → Heading Indent Guides：

| 選項 | 說明 |
|---|---|
| 垂直參考線 | 開關左邊的直線 |
| 加大標題差異 | 開關標題大小、粗細和 H1 底線 |
| 把最大的標題當成 H1 | 整篇最大只用到 `##` 時，把 `##` 當第一層 |
| 各層縮排 | H1～H6 底下內文各往右推多少 px |

單篇筆記不想縮排：在 frontmatter 加上

```yaml
---
heading-indent: false
---
```

## 想改線的顏色或粗細

編輯 `styles.css` 最上面的這幾行，存檔後重新開啟 Obsidian：

```css
--hli-gap: 12px;                               /* 線離內文多遠 */
--hli-color: var(--text-faint);                /* 線的顏色，例如改成 var(--text-muted) 會更明顯 */
--hli-w: var(--indentation-guide-width, 1px);  /* 線的粗細 */
```

## 發布新版本（維護者）

1. 把 `manifest.json` 的 `version` 往上加，例如 `1.0.2`。
2. commit 並推上 GitHub，然後推一個同名的 tag：

   ```bash
   git tag 1.0.2
   git push origin main 1.0.2
   ```

3. GitHub Actions 會自動建立 Release、附上 `main.js`、`manifest.json`、`styles.css`，並產生來源證明（artifact attestation）。

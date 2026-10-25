# 發布新版本

1. 把 `manifest.json` 的 `version` 往上加，例如 `1.0.3`。
2. commit 並推上 GitHub，然後推一個同名的 tag（前面不加 `v`）：

   ```bash
   git tag 1.0.3
   git push origin main 1.0.3
   ```

3. GitHub Actions 會自動建立 Release、附上 `main.js`、`manifest.json`、`styles.css`，並產生來源證明（artifact attestation）。
4. 到 community.obsidian.md 的外掛頁面按「Check for new releases」，或等它自動抓到新版本。

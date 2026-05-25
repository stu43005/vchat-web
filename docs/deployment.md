# Deployment Operations Guide

本文件說明如何從零建置 `vchat-web` 的部署環境：S3 儲存桶、CloudFront
發佈、CloudFront Function 重寫規則、以及 GitHub Actions OIDC 部署角色。

設計來源：

- [docs/superpowers/specs/2026-05-23-vchat-web-spa-design.md](superpowers/specs/2026-05-23-vchat-web-spa-design.md)
  §5.4（CloudFront SPA rewrite）與 §9.3（GitHub Actions）
- [README.md](../README.md) §S3 layout contract
- [.github/workflows/deploy.yml](../.github/workflows/deploy.yml)

讀者：第一次設定環境的操作者。一切資源命名請依貴組織既有慣例調整，
本文件中以 `<…>` 標示需替換的值。

---

## 0. 前置條件

- AWS 帳號，具備建立 S3 / CloudFront / IAM 資源的權限。
- GitHub repository 管理者權限（用於設定 Secrets 與 OIDC）。
- 已知的「honeybee 寫入端」（archiver）部署位置——同一個 S3 bucket
  的 `/data/*` 與 `/UC*`（legacy HTML）前綴由 honeybee 擁有，本 SPA
  部署流程**絕不**碰這兩塊。
- 本地安裝 AWS CLI v2（用於初次手動驗證；CI 已內建）。

## 1. 整體架構

```text
GitHub push → Actions workflow
                │
                ├─ OIDC AssumeRole → AWS
                │
                ├─ aws s3 sync dist/ s3://<bucket>/
                │      --delete --exclude "data/*" --exclude "UC*"
                │
                └─ aws cloudfront create-invalidation
                                     --paths "/index.html" "/assets/*"

Browser ──► CloudFront distribution
                │
                ├─ Viewer-request function "spa-rewrite"
                │      ├─ /data/* , /assets/*, /UC*  → 直通
                │      ├─ /…/file.ext                → 直通（含 legacy .html）
                │      └─ 其他                       → 改寫成 /index.html
                │
                └─ Origin: S3 bucket (上述同一個 bucket)
```

關鍵契約：

- **資料所有權**：SPA 擁有 bucket root 下除 `/data/*` 與 `/UC*`
  （legacy HTML）以外的一切；honeybee 擁有這兩塊。Deploy workflow
  的 `--delete` 配合 `--exclude "data/*"` 與 `--exclude "UC*"`，
  加上 invalidation 路徑 `/index.html`、`/assets/*`，共同保證這點：
  目的端與 `dist/` 對齊，但 honeybee 的兩個前綴永遠不會被刪除或上傳。
- **路由重寫**：CloudFront Function 在 viewer-request 階段處理
  SPA 路由重寫，**不使用** distribution-level custom error
  responses（因為後者是全域生效，會誤吃 `/data/*` 的 404，破壞
  `NotFoundError` 流程）。

---

## 2. S3 bucket 設定

### 2.1 建立 bucket

> 若 bucket 已由 honeybee 建立並包含 `/data/*` 資料，直接使用該
> bucket，跳到 §2.2。

1. AWS Console → S3 → Create bucket。
2. Bucket name：`<bucket-name>`（後續 `S3_BUCKET` secret 用）。
3. Region：與 honeybee 同 region；後續 `AWS_REGION` secret 用。
4. **Block all public access**：保持勾選（CloudFront 透過 OAC
   存取，不需要公開）。
5. Versioning：可選；若啟用，請與 honeybee 端確認 lifecycle policy
   不會誤刪 `/data/*` 舊版本。
6. 其餘預設。

### 2.2 Bucket policy（允許 CloudFront OAC 讀取）

CloudFront 建立完成後（§3）會給一段建議的 bucket policy，套用即可。
形式類似：

```json
{
  "Version": "2008-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontServicePrincipal",
      "Effect": "Allow",
      "Principal": { "Service": "cloudfront.amazonaws.com" },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::<bucket-name>/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::<account-id>:distribution/<distribution-id>"
        }
      }
    }
  ]
}
```

### 2.3 確認 honeybee 擁有的前綴不會被部署覆寫

部署 step 目標命令：

```bash
aws s3 sync dist/ s3://<bucket-name>/ \
  --delete \
  --exclude "data/*" \
  --exclude "UC*"
```

> **目前 workflow 暫時加掛 `--dryrun`**（見
> [.github/workflows/deploy.yml](../.github/workflows/deploy.yml)）。
> 待首次手動觸發 workflow 並從 sync step log 確認「dryrun would delete」
> 清單只列出真正該刪除的舊 SPA 資產、**未列出任何 `/data/*` 或 `/UC*`
> 物件**後，再移除 `--dryrun` 行讓部署正式生效。

說明：

- **`--delete`**：sync 會移除目的端比來源端多的物件，讓 bucket root
  下的 SPA 檔案集合與 `dist/` 對齊（例如某次 commit 移除了
  `robots.txt`，下次部署會把 bucket 上的舊檔同步刪掉）。`assets/*`
  採 fingerprint 命名，刪除舊版不影響快取（CloudFront 已切到新檔）。
- **`--exclude "data/*"`**：AWS CLI 的 `fnmatch` 語意中 `*`
  會匹配 `/`，所以 `data/*` 遞迴排除所有深度路徑（包括
  `data/channels/<id>.json`、`data/videos/<id>.meta.json` 等）。
  被 `--exclude` 的物件**同時**免於 `--delete` 清除——awscli 明文：
  "files excluded by filters are excluded from deletion"。
- **`--exclude "UC*"`**：保護 honeybee 的 legacy HTML 樹
  （`/<channelId>/index.html`、`/<channelId>/<YYYYMMDD>_<videoId>.html`）。
  YouTube channel ID 一律以 `UC` 開頭，且 SPA dist 本身不含任何
  `UC` 開頭的檔案，所以這個 pattern 安全。`fnmatch` 比對整個 key
  字串，因此 `UC*` 不會誤匹配 `data/UC...`（後者開頭是 `data`，
  不是 `UC`）。
- **不要**改成 `data/`、`/data/*`、或省略任一 `--exclude`；任何寫法
  異動都會破壞與 honeybee 的所有權契約，配合 `--delete` 會立刻刪除
  honeybee 內容。

如果未來 honeybee 新增了 root 之外的前綴（例如 `/raw/*`），
**必須**立即在 `--exclude` 加上新前綴，否則 `--delete` 會清掉它。

---

## 3. CloudFront distribution 設定

### 3.1 建立 distribution

1. CloudFront → Distributions → Create distribution。
2. **Origin**：
   - Origin domain：選擇 §2.1 建立的 S3 bucket（會出現
     `<bucket-name>.s3.<region>.amazonaws.com`）。
   - Origin access：**Origin access control settings (recommended)**
     → Create new OAC → 預設值 → Create。
   - 建好後 CloudFront 會提示更新 bucket policy，依 §2.2 套用。
3. **Default cache behavior**：
   - Viewer protocol policy：Redirect HTTP to HTTPS。
   - Allowed HTTP methods：GET, HEAD（SPA 不需要其他方法）。
   - Cache policy：CachingOptimized。
   - Origin request policy：留空。
   - Response headers policy：可選 SecurityHeadersPolicy。
4. **Web Application Firewall**：依組織政策決定，本文件不強制。
5. **Settings**：
   - Price class：依預算選擇。
   - Alternate domain name (CNAME)：填入自訂網域（如有）。
   - SSL certificate：自訂網域需在 ACM (us-east-1) 申請證書。
   - **Default root object**：留空（**不要**設成 `index.html`；
     由 CloudFront Function 處理，避免衝突）。
   - **Custom error responses**：**留空**。SPA 路由的 404 由
     CloudFront Function 在 viewer-request 階段改寫；`/data/*`
     的真實 404 必須維持原狀讓客戶端的 `NotFoundError` 流程處理。
6. Create distribution。建立完成後記下 **Distribution ID**
   （後續 `CF_DIST_ID` secret 用）。

### 3.2 建立並掛上 CloudFront Function `spa-rewrite`

這是整個部署中最重要的非預設設定，對應 spec §5.4。

1. CloudFront → Functions → Create function。
2. 設定：
   - Name：`spa-rewrite`
   - Runtime：`cloudfront-js-2.0`
3. Function code 貼入：

   ```js
   function handler(event) {
     var request = event.request;
     var uri = request.uri;

     // Pass through honeybee-owned prefixes (data tree + legacy HTML
     // under /UC<channelId>/...) and SPA assets directly to S3.
     if (uri.startsWith('/data/')
         || uri.startsWith('/assets/')
         || uri.startsWith('/UC')) {
       return request;
     }
     // Pass through any URI whose last segment contains a "." (covers
     // bare files like /favicon.svg, /index.html).
     var lastSegment = uri.substring(uri.lastIndexOf('/') + 1);
     if (lastSegment.indexOf('.') !== -1) {
       return request;
     }

     // Everything else is an SPA route (including unknown paths
     // that should render the NotFound page). Rewrite to index.html.
     request.uri = '/index.html';
     return request;
   }
   ```

4. Save → Test 分頁可選擇執行幾組路徑驗證行為（見 §6 驗證表）。
5. Publish 分頁 → **Publish function**（不發佈不會生效）。
6. 回到 distribution → Behaviors → 選 Default (`*`) → Edit
   → 區段 **Function associations** → **Viewer request** 下拉選
   `CloudFront Functions` → 選 `spa-rewrite` → Save。
7. 等待 distribution 狀態回到 `Deployed`（約 1–3 分鐘）。

> ⚠️ Lambda@Edge 不要用。CloudFront Functions 已足夠處理本場景，
> 且冷啟動更快、費用更低。

### 3.3 為何不使用 Custom error responses

AWS 的 distribution-level Custom error responses 對所有 cache
behaviors 生效，無法依路徑前綴限定範圍。如果用「403/404 → /index.html
(200)」的傳統技巧，會把 `/data/videos/UNKNOWN.meta.json` 的真實
404 也改寫成 `index.html` 200，使 `src/api/client.ts` 的
`NotFoundError` 流程失效（"Archive not yet available" UI 永遠
不會觸發）。所以一律改走 CloudFront Function。

---

## 4. IAM：GitHub Actions OIDC 角色

Workflow 已用 `permissions: id-token: write` 啟用 OIDC；對應 AWS 端
需建立 identity provider 與一個 deployment role。

### 4.1 建立 OIDC identity provider（每個 AWS 帳號一次）

1. IAM → Identity providers → Add provider。
2. Provider type：OpenID Connect。
3. Provider URL：`https://token.actions.githubusercontent.com`
4. Audience：`sts.amazonaws.com`
5. Add provider。

### 4.2 建立 deployment role

1. IAM → Roles → Create role。
2. Trusted entity type：Web identity。
3. Identity provider：`token.actions.githubusercontent.com`
4. Audience：`sts.amazonaws.com`
5. GitHub organization：`<your-org>`；Repository：
   `<your-org>/vchat-web`；Branch：`main`（也可只限 `refs/heads/main`）。
6. 下一步先不掛 managed policy，直接 Create role。
   Role name：`vchat-web-deploy`。
7. 建立後 Trust relationship 應類似：

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Principal": {
           "Federated": "arn:aws:iam::<account-id>:oidc-provider/token.actions.githubusercontent.com"
         },
         "Action": "sts:AssumeRoleWithWebIdentity",
         "Condition": {
           "StringEquals": {
             "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
           },
           "StringLike": {
             "token.actions.githubusercontent.com:sub": "repo:<your-org>/vchat-web:ref:refs/heads/main"
           }
         }
       }
     ]
   }
   ```

8. 角色 ARN 後續作為 `AWS_DEPLOY_ROLE_ARN` secret。

### 4.3 Inline policy（最小權限）

附加以下 inline policy 到 `vchat-web-deploy`：

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3SyncSpaRoot",
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket"
      ],
      "Resource": "arn:aws:s3:::<bucket-name>"
    },
    {
      "Sid": "S3WriteSpaObjects",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::<bucket-name>/*"
    },
    {
      "Sid": "CloudFrontInvalidate",
      "Effect": "Allow",
      "Action": [
        "cloudfront:CreateInvalidation",
        "cloudfront:GetInvalidation"
      ],
      "Resource": "arn:aws:cloudfront::<account-id>:distribution/<distribution-id>"
    }
  ]
}
```

說明：

- S3 `Resource` 涵蓋全 bucket，是因為 `aws s3 sync` 必須能對全 bucket
  做 List 比對。路徑層級的安全防護由 workflow 的 `--exclude "data/*"`
  與 `--exclude "UC*"` 保證——IAM 層無法精細到「禁止寫入特定前綴」(\*)。
  若需要更強保護，可考慮 S3 Object Ownership + bucket policy `Deny`
  規則，但會增加維運複雜度。
- `s3:DeleteObject` 為 `--delete` 旗標所需。若 workflow 改回無
  `--delete` 模式（或改用 `--dryrun`），此權限不會被使用，但保留無害。

(\*) S3 `s3:PutObject` 條件 `s3:prefix` 只對 List 有效，對
PutObject 無效。

---

## 5. GitHub Secrets

到 GitHub repo → Settings → Secrets and variables → Actions
→ New repository secret，建立以下四個：

| Secret name           | 值                                                            |
| --------------------- | ------------------------------------------------------------- |
| `AWS_DEPLOY_ROLE_ARN` | §4.2 建立的 role ARN                                          |
| `AWS_REGION`          | bucket 所在 region（例：`ap-northeast-1`）                    |
| `S3_BUCKET`           | §2.1 的 bucket 名稱（**不含** `s3://` 前綴與斜線）            |
| `CF_DIST_ID`          | §3.1 建立的 distribution ID                                   |

設定完後，下一次 push 到 `main` 或手動觸發 workflow 即會走完整流程。

---

## 6. 驗證

### 6.1 CloudFront Function 行為對照表

到 CloudFront Functions → `spa-rewrite` → Test 分頁，依次測試：

| 輸入 URI                                | 預期 `request.uri`     | 預期行為                              |
| --------------------------------------- | ---------------------- | ------------------------------------- |
| `/`                                     | `/index.html`          | SPA 首頁                              |
| `/videos/abc`                           | `/index.html`          | SPA video 頁                          |
| `/channels/UCxxx`                       | `/index.html`          | SPA channel 頁                        |
| `/garbage/random/path`                  | `/index.html`          | SPA NotFound 頁                       |
| `/index.html`                           | `/index.html`          | 直通（最後 segment 含 `.`）           |
| `/assets/main-abc123.js`                | `/assets/main-abc123.js` | 直通（前綴 `/assets/`）             |
| `/data/index.json`                      | `/data/index.json`     | 直通；不存在則 404 給客戶端           |
| `/data/videos/UNKNOWN.meta.json`        | `/data/videos/UNKNOWN.meta.json` | 直通；404 觸發 `NotFoundError` |
| `/UCxxx/20260101_abc.html`              | `/UCxxx/20260101_abc.html` | 直通（前綴 `/UC`）                |
| `/UCxxx/index.html`                     | `/UCxxx/index.html`    | 直通（前綴 `/UC`）                    |
| `/UCxxx`                                | `/UCxxx`               | 直通（前綴 `/UC`）                    |
| `/favicon.svg`                          | `/favicon.svg`         | 直通（最後 segment 含 `.`）           |

> bare `/UCxxx`（無尾斜線、無檔名）直通到 S3 後通常回 404；不會被
> 改寫到 SPA NotFound，符合 honeybee legacy 體驗。

### 6.2 端對端驗證（部署完成後）

從瀏覽器（不要走 dev proxy）打 distribution domain：

1. `/` → 顯示 index 頁，Live/Past 分頁可切換。
2. `/videos/<任一已存在的 videoId>` → 直接重新整理也能回到 video 頁
   （而非 404；證明 SPA rewrite 生效）。
3. `/videos/UNKNOWN_ID` → 顯示 "Archive not yet available" 警告
   （而非空白 video 頁；證明 `/data/*` 404 沒被改寫）。
4. `/garbage/random` → 顯示 SPA NotFound 頁。
5. 開 DevTools Network 觀察 `/data/videos/<id>.meta.json`
   回應 200 且 `content-type: application/json`。
6. 觀察 `/assets/*` 回應有 `cache-control` 長 TTL header
   （CachingOptimized policy 預設值）。

### 6.3 部署流程驗證

1. 手動觸發一次 `workflow_dispatch` → 觀察各 step 綠燈。
2. Sync step log 應顯示：
   - 上傳的物件**不包含**任何 `data/` 或 `UC*` 開頭的路徑。
   - 若 workflow 仍掛 `--dryrun`：log 會出現
     `(dryrun) upload: …` 與 `(dryrun) delete: …` 行，**仔細檢視
     `delete:` 清單**——應只列出舊版 SPA 資產（例如過時的
     `assets/main-<old-hash>.js`），**絕不應**列出任何 `data/*`
     或 `UC*` 物件。確認無誤後即可移除 workflow 中的 `--dryrun` 行。
3. Invalidation step log 應只列出 `/index.html` 與 `/assets/*`。
4. AWS Console → S3 → bucket → `data/` 與 `UC*` 前綴存在且物件
   數量未變。

---

## 7. 日常維運

### 7.1 重新部署

- 一般情況：push 到 `main` 自動觸發。
- 緊急回滾：在 GitHub Actions UI 對舊 commit 重跑 workflow
  （Re-run jobs）。`aws s3 sync --delete` 會還原該 commit 對應的
  完整檔案集合（補回現在不存在的舊檔、刪除新增的檔案、覆蓋同名檔案），
  CloudFront invalidation 會清掉 edge 上的 `/index.html`。

### 7.2 修改 CloudFront Function

修改 → Save → **Publish** → 等 distribution `Deployed`。
未 Publish 的版本不會生效；Publish 後立刻全球生效（無需 invalidation）。

修改後一定重跑 §6.1 對照表，避免破壞 `/data/*` 直通契約。

### 7.3 honeybee 新增前綴

若 honeybee 未來新增 root 之外的前綴（例如 `/raw/*`）：

1. 更新 [.github/workflows/deploy.yml](../.github/workflows/deploy.yml)
   的 sync step：

   ```bash
   aws s3 sync dist/ s3://<bucket>/ \
     --delete \
     --exclude "data/*" \
     --exclude "UC*" \
     --exclude "raw/*"
   ```

2. 視情況更新 `spa-rewrite` function 加入新的直通前綴：

   ```js
   if (uri.startsWith('/data/')
       || uri.startsWith('/assets/')
       || uri.startsWith('/UC')
       || uri.startsWith('/raw/')) {
     return request;
   }
   ```

3. 更新本文件與 [README.md](../README.md) §S3 layout contract。

### 7.4 監控

- CloudFront → Reports → Cache statistics：確認快取命中率。
- CloudFront → Logs：可開啟 standard logging 到另一個 S3 bucket
  做問題追蹤（注意此 log bucket 不要與 SPA bucket 共用）。
- S3 → Metrics：觀察 bucket size 是否異常成長（可能代表
  honeybee 流量或 SPA 部署失誤）。

---

## 8. 已知限制與設計取捨

- **沒有 staging distribution**：本 repo 僅一條 main → prod 部署路徑。
  若需要 staging，建議新建一個獨立 bucket + distribution + role，
  並把 workflow 拆成 `deploy-staging` / `deploy-prod` 兩個 job。
- **無 manual approval gate**：lint/typecheck/build 任一失敗就停。
  通過則直接上 prod。若團隊規模成長需要 review gate，可在
  workflow 加 `environment: production` 並設定 required reviewers。
- **CloudFront invalidation 只清 `/index.html` 與 `/assets/*`**：
  fingerprint 化的 asset 檔名讓 invalidation 範圍可以收窄。
  若部署後仍見舊版，先檢查 distribution 是否 `Deployed`、再檢查
  瀏覽器 disk cache（hard reload）。

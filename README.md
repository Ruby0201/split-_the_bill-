# 香港旅遊分帳計算器

一個安全、美觀的旅遊分帳計算網頁應用程式，使用 Python + Vercel + PostgreSQL。

## 功能特色

- 🎀 少女粉主題設計
- 👥 多人分帳計算
- 💰 支援平均分攤和自訂權重分攤
- 🔗 透過旅行團 ID 分享連結
- 🔒 資料庫儲存，安全可靠

## 部署步驟

### 1. 準備 Vercel Postgres 資料庫

1. 在 Vercel 專案中新增 Postgres 資料庫
2. 取得資料庫連線資訊（會在環境變數中自動設定）

### 2. 設定環境變數

在 Vercel 專案設定中，確保以下環境變數已設定：
- `POSTGRES_HOST`
- `POSTGRES_DATABASE`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_PORT` (預設 5432)

### 3. 部署到 Vercel

```bash
# 安裝 Vercel CLI
npm i -g vercel

# 登入
vercel login

# 部署
vercel
```

## 本地開發

### 安裝依賴

```bash
pip install -r requirements.txt
```

### 設定環境變數

建立 `.env` 檔案：

```
POSTGRES_HOST=your_host
POSTGRES_DATABASE=your_database
POSTGRES_USER=your_user
POSTGRES_PASSWORD=your_password
POSTGRES_PORT=5432
```

### 執行本地伺服器

使用 Vercel CLI 進行本地開發：

```bash
vercel dev
```

## 使用方式

1. 建立新分帳群組
2. 新增成員
3. 新增費用（可選擇平均分攤或自訂權重）
4. 查看結算結果
5. 分享連結給朋友（透過旅行團 ID）

## 技術棧

- **前端**: HTML, CSS, JavaScript
- **後端**: Python (Vercel Serverless Functions)
- **資料庫**: PostgreSQL (Vercel Postgres)
- **部署**: Vercel

## 授權

MIT License

# Google認証従業員管理システム

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.2-61dafb)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18.0-green)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

Google OAuth 2.0認証を使用した企業向け従業員管理システムです。PKCE対応の安全な認証フローと階層型権限管理を提供します。

## 🌟 主な機能

- **Google OAuth 2.0認証** - PKCE対応のセキュアなシングルサインオン
- **階層型権限管理** - RBAC（Role-Based Access Control）による5段階の権限レベル
- **従業員データ管理** - メールアドレスベースの自動連携
- **監査ログ** - すべての操作を記録し、セキュリティイベントを追跡
- **バックエンドプロキシパターン** - client_secretをバックエンドで安全に管理
- **2025年対応** - Less Secure Apps廃止とGoogle OAuth 2.0の最新要件に対応

## 🏗️ アーキテクチャ

```mermaid
graph TB
    subgraph \"Frontend (React + TypeScript)\"
        A[React App] --> B[@react-oauth/google]
        A --> C[Protected Routes]
        A --> D[Auth Context]
        B --> E[PKCE Flow]
    end
    
    subgraph \"Backend (Node.js + Express)\"
        F[Express API] --> G[JWT Service]
        F --> H[Google Auth Service]
        F --> I[Prisma ORM]
        F --> J[Security Middleware]
        H --> K[OAuth 2.0 + PKCE]
    end
    
    subgraph \"Data Layer\"
        L[(PostgreSQL)]
        M[(Redis)]
        N[Session Store]
        O[Token Cache]
    end
    
    subgraph \"Security Layer\"
        P[CORS]
        Q[Rate Limiting]
        R[Input Validation]
        S[Audit Logging]
    end
    
    A -.->|HTTPS| F
    C --> D
    E --> K
    G --> M
    G --> O
    I --> L
    F --> N
    N --> M
    J --> P
    J --> Q
    J --> R
    F --> S
    S --> L
```

## 🚀 クイックスタート

### 前提条件

- Node.js 18.0以上
- PostgreSQL 15以上
- Redis 7.0以上
- Google Cloud Consoleアカウント

### インストール

```bash
# リポジトリのクローン
git clone https://github.com/KEIEI-NET/google-auth-employee-system.git
cd google-auth-employee-system

# 依存関係のインストール
npm run install:all

# 環境変数の設定
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# .envファイルを編集して必要な値を設定

# データベースのセットアップ
npm run db:setup

# 開発サーバーの起動
npm run dev
```

### Docker を使用する場合

```bash
# Dockerコンテナの起動
docker-compose up -d

# データベースマイグレーション
docker-compose exec backend npm run db:migrate

# シードデータの投入
docker-compose exec backend npm run db:seed
```

## 📋 Google Cloud Console設定

詳細な設定手順は [docs/google-console-guide.md](docs/google-console-guide.md) を参照してください。

### 必要な設定

1. **新規プロジェクトの作成**
2. **OAuth同意画面の設定**
3. **認証情報の作成**
4. **リダイレクトURIの設定**

```
開発環境: http://localhost:3000/auth/callback
本番環境: https://your-domain.com/auth/callback
```

## 🔧 設定

### 環境変数

#### Backend (.env)

```env
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/employee_db
DATABASE_PASSWORD=your-strong-password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback

# JWT
JWT_SECRET=your-jwt-secret-min-32-chars
JWT_ACCESS_TOKEN_EXPIRES_IN=15m
JWT_REFRESH_TOKEN_EXPIRES_IN=7d

# Session
SESSION_SECRET=your-session-secret-min-32-chars
SESSION_EXPIRES_IN=24h

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

#### Frontend (.env)

```env
REACT_APP_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
REACT_APP_API_URL=http://localhost:5000/api
```

## 📦 プロジェクト構造

```
.
├── frontend/               # Reactフロントエンド
│   ├── src/
│   │   ├── components/    # UIコンポーネント
│   │   ├── services/      # APIサービス
│   │   ├── contexts/      # Reactコンテキスト
│   │   └── hooks/         # カスタムフック
│   └── package.json
│
├── backend/               # Express バックエンド
│   ├── src/
│   │   ├── controllers/   # APIコントローラー
│   │   ├── services/      # ビジネスロジック
│   │   ├── middleware/    # ミドルウェア
│   │   └── database/      # Prismaスキーマ
│   └── package.json
│
├── docs/                  # ドキュメント
├── .claude/              # ClaudeCode用設定
└── docker-compose.yml    # Docker設定
```

## 🧪 テスト

```bash
# 単体テストの実行
npm run test

# テストカバレッジ
npm run test:coverage

# E2Eテスト
npm run test:e2e
```

## 📊 API仕様

### 認証エンドポイント

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/auth/google` | Google OAuth認証URLの取得 |
| POST | `/api/auth/google/callback` | Google OAuth認証コールバック |
| POST | `/api/auth/refresh` | トークンリフレッシュ |
| POST | `/api/auth/logout` | ログアウト |
| GET | `/api/auth/me` | 現在のユーザー情報取得 |

### 従業員エンドポイント

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/employees/me` | 現在のユーザー情報 |
| GET | `/api/employees/:id` | 従業員詳細 |
| GET | `/api/employees/:id/permissions` | 権限一覧 |

詳細なAPI仕様は [docs/api-specification.md](docs/api-specification.md) を参照してください。

## 🔒 セキュリティ

### 実装済みセキュリティ機能

- **PKCE (Proof Key for Code Exchange)** - Authorization Code Injection攻撃を防御
- **State検証** - CSRF攻撃を防御（IPアドレス検証付き）
- **バックエンドプロキシ** - client_secretをフロントエンドに露出させない
- **JWTトークン管理** - アクセストークン（15分）とリフレッシュトークン（7日）の分離
- **セッション管理** - Redis による安全なセッション管理
- **レート制限** - ブルートフォース攻撃を防御
- **監査ログ** - すべての認証・認可イベントを記録
- **権限ベースアクセス制御** - 役割と権限による細かなアクセス制御

### 2025年Google OAuth変更への対応

- **Less Secure Apps完全廃止対応** - 2025年3月14日の廃止に対応
- **Client Secret必須化対応** - Web Applicationタイプでの必須化に対応
- **Client Secretワンタイム表示対応** - 2025年6月以降の変更に対応

## 🚢 デプロイ

### 本番環境へのデプロイ

```bash
# ビルド
npm run build

# 本番環境起動
npm run start:prod
```

### CI/CDパイプライン

GitHub Actionsを使用した自動デプロイが設定されています。
詳細は [.github/workflows/deploy.yml](.github/workflows/deploy.yml) を参照してください。

## 📈 監視とログ

- **メトリクス**: Prometheus形式でエクスポート
- **ログ**: Winston によるStructured Logging
- **ヘルスチェック**: `/health` エンドポイント

## 🤝 コントリビューション

プルリクエストを歓迎します！
大きな変更の場合は、まずissueを開いて変更内容を議論してください。

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 ライセンス

このプロジェクトはMITライセンスの下で公開されています。
詳細は [LICENSE](LICENSE) ファイルを参照してください。

## 👥 開発チーム

- **プロジェクトリード** - [@KEIEI-NET](https://github.com/KEIEI-NET)
- **AI開発アシスタント** - Claude Code (claude.ai/code)

## 📞 サポート

- **Issue Tracker**: [GitHub Issues](https://github.com/KEIEI-NET/google-auth-employee-system/issues)
- **Documentation**: [docs/](docs/)

## 🙏 謝辞

- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [Prisma](https://www.prisma.io/)
- [React](https://reactjs.org/)
- [Express](https://expressjs.com/)

---

Built with ❤️ and AI-powered development using Claude Code
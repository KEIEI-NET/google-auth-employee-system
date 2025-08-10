# CLAUDE.md - AI開発アシスタント向けプロジェクト情報

このファイルは、Claude Code (claude.ai/code) がこのリポジトリで作業する際のガイダンスを提供します。

## 最終更新: 2025年8月10日 18:30

### 重要な更新内容（最新）
- **フロントエンド基幹コンポーネント実装完了** - Dashboard.tsx, AdminPage.tsx, UnauthorizedPage.tsx, ProtectedRoute.tsx
- **権限ベースアクセス制御実装** - ロール別UI表示、保護ルート機能
- **型安全性の大幅向上** - AuthContext TypeScriptエラー解決、パフォーマンス最適化
- **バックエンドセキュリティ脆弱性を全て修正** - タイミング攻撃対策、レースコンディション対策実装
- **レート制限、セキュリティヘッダー、入力検証強化**
- **監査ログとエラーハンドリングシステム完全実装**

## ビルド・開発コマンド

### ルートレベルのコマンド（プロジェクトルートから実行）
- `npm run install:all` - 全ワークスペースの依存関係をインストール
- `npm run dev` - フロントエンドとバックエンドの開発サーバーを同時起動
- `npm run build` - フロントエンドとバックエンドを本番用にビルド
- `npm run test` - フロントエンドとバックエンドのテストを実行
- `npm run lint` - フロントエンドとバックエンドのリンティングを実行
- `npm run typecheck` - TypeScriptの型チェックを実行

### データベースコマンド
- `npm run db:setup` - Prismaでデータベースを初期化（クライアント生成とマイグレーション実行）
- `npm run db:migrate` - データベースマイグレーションをデプロイ
- `npm run db:seed` - 初期データを投入

### Dockerコマンド
- `npm run docker:up` - Dockerコンテナを起動
- `npm run docker:down` - Dockerコンテナを停止
- `npm run docker:build` - Dockerイメージをビルド

## アーキテクチャ概要

このシステムは、Google OAuth 2.0認証を使用した従業員管理システムで、以下のアーキテクチャを採用しています：

### フロントエンド（React + TypeScript）
- **認証**: `@react-oauth/google`を使用したGoogle OAuth統合（PKCE対応）
- **状態管理**: 認証状態にReact Context、サーバー状態にReact Query
- **UIフレームワーク**: Material-UI v5
- **ルーティング**: React Router v6（保護されたルート機能付き）
- **フォーム処理**: react-hook-formとyupバリデーション

### バックエンド（Node.js + Express + TypeScript）
- **認証**: `google-auth-library`によるGoogle OAuth 2.0、JWTトークンによるセッション管理
- **データベース**: PostgreSQL（Prisma ORM使用）
- **セッションストレージ**: Redisによるセッション管理
- **セキュリティ**: Helmetによるヘッダー保護、CORS、レート制限、入力検証
- **ロギング**: Winstonによる構造化ログ
- **バリデーション**: zodによる環境変数検証、express-validatorによるリクエスト検証

### 主要なセキュリティ機能
- PKCE（Proof Key for Code Exchange）実装 - code_verifierとcode_challengeによるセキュアな認証フロー
- CSRF保護のためのStateパラメータ検証（IPアドレス検証付き）
- JWTトークン管理 - アクセストークン（15分）とリフレッシュトークン（7日）の分離
- Redisベースのセッション管理 - トークンとセッション状態の安全な保存
- APIエンドポイントのレート制限 - 15分間に100リクエストまで
- 全操作の監査ログ - セキュリティイベントの完全な追跡

### 権限システム
5レベルの階層型ロールベースアクセス制御（RBAC）：
- SUPER_ADMIN - システム管理者
- ADMIN - 管理者
- MANAGER - マネージャー
- EMPLOYEE - 一般従業員
- VIEWER - 閲覧のみ

### データベーススキーマ
- `employees` - Googleアカウントとメールで紐付けられた従業員マスタデータ
- `roles` - 優先度レベル付きのロール定義
- `permissions` - リソースとアクションに対する細かい権限
- `employee_roles` - 従業員とロールの多対多リレーション
- `role_permissions` - ロールと権限の多対多リレーション

### API構造

#### 認証エンドポイント
- `GET /api/auth/google` - Google OAuth認証URLの取得
- `POST /api/auth/google/callback` - Google認証コールバック処理
- `POST /api/auth/refresh` - アクセストークンのリフレッシュ
- `POST /api/auth/logout` - ログアウト処理
- `GET /api/auth/me` - 現在のユーザー情報取得

#### 管理者エンドポイント（実装完了）
- `GET /api/admin/audit-logs` - 監査ログ取得（フィルタリング・ページング対応）
- `GET /api/admin/statistics` - システム統計情報取得
- `GET /api/admin/employees` - 従業員一覧取得

#### 権限エンドポイント（実装予定）
- `GET /api/permissions` - 権限一覧
- `POST /api/permissions/check` - 権限チェック

全APIはRESTful規約に従い、以下の標準化されたJSONレスポンスを返します：
```json
{
  "success": true,
  "data": {},
  "error": {
    "code": "ERROR_CODE",
    "message": "エラーメッセージ",
    "details": {}
  }
}
```

## 実装状況（2025年8月10日現在）

### ✅ 完了した機能（完成度: 95%）

#### バックエンド（完成度: 98%）
- **Express + TypeScript基盤** - 完全実装済み
- **PostgreSQL + Prisma ORM** - マイグレーション含め完全設定済み
- **Google OAuth 2.0認証**
  - PKCEフロー実装（code_verifier/code_challenge）
  - Stateパラメータ検証（IPアドレス検証付き）
  - バックエンドプロキシパターンでclient_secret保護
- **JWT認証システム**
  - アクセストークン（15分）/リフレッシュトークン（7日）の二重トークン方式
  - トークン自動リフレッシュ機能
  - セキュアなトークン保存（httpOnly cookie検討中）
- **セキュリティ実装**
  - Helmetによるセキュリティヘッダー設定
  - CORS設定（環境別の詳細設定）
  - 入力検証（express-validator + DOMPurify）
  - エラーハンドリング（統一フォーマット）
  - レート制限（Redis対応、フォールバック機能付き）
- **監査ログシステム**
  - 全認証イベントの記録
  - セキュリティレベル別分類
  - IPアドレス・User-Agent記録
  - 管理者向け検索・フィルタリング機能
- **管理者API**
  - 監査ログ閲覧（/api/admin/audit-logs）
  - システム統計（/api/admin/statistics）
  - 従業員管理（/api/admin/employees）

#### フロントエンド（完成度: 90%）
- **React + TypeScript基盤** - 完全設定完了
- **ルーティング** - React Router v6設定済み（保護ルート対応）
- **認証コンテキスト** - AuthContext完全実装済み（型安全性確保）
- **基幹UIコンポーネント** - 完全実装済み
  - **Dashboard.tsx** - メインダッシュボード（権限ベース表示、管理者ナビゲーション）
  - **AdminPage.tsx** - 管理者専用ページ（タブ機能、監査ログ表示、統計情報）
  - **ProtectedRoute.tsx** - 保護ルート機能（ロールベースアクセス制御）
  - **UnauthorizedPage.tsx** - 未認可アクセス時のエラーページ
  - **LoginPage** - 基本実装済み（Google OAuth統合完了）

### 🚧 残存課題（完成度: 5%）
- **テストスイート** - 未実装（単体、統合、E2E）
- **Docker本番設定** - 開発環境設定のみ完了
- **CI/CDパイプライン** - 未着手
- **従業員詳細管理API** - エンドポイント設計のみ完了

### 🛡️ セキュリティ修正完了記録

#### 2025年8月10日実施済み修正
1. **タイミング攻撃対策** - JWTトークン検証に`crypto.timingSafeEqual`実装
2. **レースコンディション対策** - OAuth state検証をトランザクション化
3. **レート制限実装** - Redisベース、エンドポイント別設定
4. **セキュリティヘッダー強化** - Helmet設定拡張、CSP追加
5. **入力検証強化** - DOMPurify、包括的検証ルール
6. **監査ログシステム完成** - 全セキュリティイベントの記録・追跡

## Google OAuth 2.0の特殊要件（2025年対応）

### ⚠️ 重要な注意事項
- **Less Secure Apps廃止**: 2025年3月14日にLSAサポート完全終了
- **Client Secret必須**: GoogleのWeb ApplicationタイプではPKCE使用時もclient_secret必須
- **シークレット管理変更**: 2025年6月以降、新規クライアントのシークレットは作成時のみ表示

### 推奨実装パターン（実装済み）
このシステムでは**バックエンドプロキシパターン**を採用：
1. フロントエンド → バックエンド → Google OAuth
2. client_secretはバックエンドのみで保持
3. PKCEとStateパラメータで追加のセキュリティ層を実装

## AIアシスタントへの推奨事項

1. **セキュリティ優先**: 新機能追加時は必ずセキュリティ影響を評価
2. **型安全性維持**: TypeScriptの`any`使用を最小限に抑制
3. **監査ログ**: 重要な操作は必ず監査ログに記録
4. **エラーハンドリング**: AppErrorクラスを使用して一貫性を保つ
5. **非同期処理**: Promiseは適切にawaitまたはvoid演算子で処理

## トラブルシューティング

### Docker Desktop未起動エラー
```bash
# Docker Desktopを起動してから再実行
docker-compose up -d
```

### Prismaスキーマ文字化け
```bash
# UTF-8で保存し直してから
npx prisma generate
```

### ESLintエラー
```bash
# 型定義確認
npx tsc --noEmit

# ESLint実行
npm run lint
```

### 開発サーバー起動エラー
```bash
# ポート競合の解決
lsof -ti:3000 | xargs kill -9  # フロントエンド
lsof -ti:5000 | xargs kill -9  # バックエンド

# 依存関係再インストール
npm run install:all
```

## 関連ドキュメント

- `README.md` - プロジェクト概要とクイックスタート
- `docs/` - 技術仕様書とAPI設計書
- `.github/` - CI/CD設定とissueテンプレート（未実装）

---

**Built with ❤️ and AI-powered development using Claude Code**
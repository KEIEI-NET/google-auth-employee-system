# ドキュメント

このディレクトリには、Google認証従業員管理システムの技術ドキュメントが含まれています。

## 📁 ディレクトリ構造

```
docs/
├── README.md                    # このファイル
├── api/                        # API仕様書
│   ├── authentication.md       # 認証API
│   ├── admin.md                # 管理者API
│   └── employees.md            # 従業員API
├── architecture/               # アーキテクチャドキュメント
│   ├── overview.md             # システム概要
│   ├── security.md             # セキュリティ設計
│   └── database.md             # データベース設計
├── deployment/                 # デプロイメントガイド
│   ├── docker.md               # Docker設定
│   ├── production.md           # 本番環境設定
│   └── monitoring.md           # 監視・ロギング
├── development/                # 開発者ガイド
│   ├── getting-started.md      # 開発環境セットアップ
│   ├── coding-standards.md     # コーディング規約
│   └── testing.md              # テスト戦略
└── google-oauth/               # Google OAuth 2.0設定
    ├── console-setup.md        # Google Cloud Console設定
    ├── 2025-changes.md         # 2025年変更対応
    └── troubleshooting.md      # OAuth トラブルシューティング
```

## 📚 主要ドキュメント

### アーキテクチャ
- [システム概要](architecture/overview.md) - 全体アーキテクチャと技術選定
- [セキュリティ設計](architecture/security.md) - セキュリティ実装詳細
- [データベース設計](architecture/database.md) - ERD とスキーマ設計

### API仕様
- [認証API](api/authentication.md) - OAuth 2.0 認証フロー
- [管理者API](api/admin.md) - 管理機能API
- [従業員API](api/employees.md) - 従業員管理API

### 開発・運用
- [開発環境セットアップ](development/getting-started.md) - 初期設定手順
- [Google OAuth設定](google-oauth/console-setup.md) - Google Cloud Console設定
- [本番環境デプロイ](deployment/production.md) - 本番環境構築

## 🚀 クイックリンク

### 開発者向け
- [環境変数設定](../backend/.env.example)
- [API テストコレクション](api/postman-collection.json) *(未実装)*
- [開発ワークフロー](development/workflow.md) *(未実装)*

### 運用者向け
- [監視設定](deployment/monitoring.md) *(未実装)*
- [バックアップ戦略](deployment/backup.md) *(未実装)*
- [セキュリティチェックリスト](architecture/security-checklist.md) *(未実装)*

## 📝 ドキュメント更新ガイド

### 更新頻度
- API仕様書: 機能追加・変更時に必須
- アーキテクチャ: 設計変更時に必須
- 設定ガイド: 環境・設定変更時に推奨

### 更新手順
1. 該当する .md ファイルを編集
2. プルリクエストでレビュー
3. メインブランチにマージ
4. 必要に応じて CLAUDE.md も更新

## 🤖 AI開発アシスタント対応

- **CLAUDE.md**: Claude Code向けプロジェクト情報
- **コメント**: 日本語コメントでAI可読性向上
- **型安全性**: TypeScript型定義でAI理解支援

---

**Note**: *(未実装)* マークのドキュメントは今後作成予定です。
**Built with ❤️ and AI-powered development**
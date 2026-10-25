# エージェント・Hook 構成の全体像

## ファイル構成

```
c:\work\private\
├── dashboard.html          ← HTML のみ（css/・js/ を ?v=ハッシュ付きで順番に読み込む）
├── css\                    ← base / タブごと / responsive（スマホ用）。読み込み順で上書きされる
├── js\                     ← core\（state, sync, init, nav, utils, backup）とタブごと（ledger\, food\ 等）
├── tests\                  ← logic.test.js（npm test）/ load.js（js を node で読み込む）/ smoke.js（ブラウザ用の回帰チェック）
├── tools\bump_assets.py    ← ?v= を中身のハッシュに更新（コミット前に実行）
├── package.json            ← npm test / npm run bump（依存パッケージなし）
├── .mcp.json               ← Playwright MCP をプロジェクトスコープで登録
└── .claude\
    ├── settings.json       ← Hooks の定義 + enabledMcpjsonServers
    ├── launch.json         ← ローカル確認用サーバー（python http.server 8765）
    ├── checklist.md        ← UIチェック項目（Hook が直接参照）
    ├── architecture.md     ← このファイル
    ├── agents\
    │   ├── coder.md        ← 実装専任エージェント
    │   ├── checker.md      ← Playwright 視覚確認エージェント
    │   └── advisor.md      ← 改善案を出すエージェント（読むだけ。ユーザーが「改善案を出して」と言ったときに呼ぶ）
    └── hooks\
        ├── mark-dirty.ps1  ← 編集検知フラグ（dashboard.html と css\・js\ 配下）
        └── check-ui.ps1    ← 完了ブロック
```

## 処理フロー

```
ユーザーが変更を依頼
        │
        ▼
  【coder エージェント】
  dashboard.html を編集
        │
        │ Edit/Write ツール発火
        ▼
  【PostToolUse Hook: mark-dirty.ps1】
  .claude/.dirty フラグを立てる
        │
        ▼
  【checker エージェント】（メイン会話が呼ぶ）
  Playwright でブラウザを開いてスクリーンショット撮影
  checklist.md の8項目を pass/fail で報告
        │
        ▼
  メイン会話が checklist.md の全項目を確認・明示
        │
        │ Claude が「完了」と言おうとする
        ▼
  【Stop Hook: check-ui.ps1】
  .dirty が残っていたらブロック（checklist.md の内容を reason として返す）
  .dirty が消えていれば通過
```

## 各レイヤーの役割

| レイヤー | 担当 | 何を確認するか |
|---------|------|--------------|
| **coder** | 自己レビュー | コードの論理的な正しさ（タグ閉じ、typo、stopPropagation 漏れ等） |
| **checker** | 視覚確認 | メイン会話から指定された項目のみ確認（全項目ではなく変更内容に応じて絞り込む） |
| **Stop Hook** | 最終ゲート | checklist.md が確認されたか（完了報告のブロック） |

## 変更タイプ → checker 確認項目マッピング

| 変更タイプ | 確認する項目 |
|-----------|------------|
| 列幅・グリッド変更 | 3（カラム幅）、8（最小幅） |
| クリック・編集動作の変更 | 1（クリック領域）、2（入力欄幅）、6（stopPropagation） |
| 要素の追加・削除 | 1（クリック領域）、6（stopPropagation）、7（不要要素） |
| 色・フォント・余白のみ変更 | 4（行の高さ）、5（数値右揃え） |
| 行の高さ・パディング変更 | 4（行の高さ） |
| 複数タイプにまたがる変更 | 該当するすべての項目 |
| 判断できない場合 | 全項目 |

メイン会話がこのマッピングで絞り込み、checker への指示に含める。

## 設計上の重要ルール

### サブエージェントはサブエージェントを呼べない
- coder が自動で checker を呼ぶことはできない
- **メイン会話が** coder → checker の順に呼び出す責務を持つ

### CLAUDE.md は全サブエージェントに自動継承される
- coder・checker が改めて CLAUDE.md を読む必要はない
- コーディング規約・デザイントークン・データ設計はそのまま引き継がれる

### Stop Hook はダブルチェックではなく「確認強制」
- checker が合格を返しても、メイン会話が checklist.md を明示せずに完了と言おうとするとブロックされる
- checker 通過と checklist.md 明示の両方が必要な設計

### MCP の登録場所
- `.mcp.json`（プロジェクトルート）に定義
- `.claude/settings.json` の `enabledMcpjsonServers` で承認
- グローバル（`~/.claude/`）には書かない方針

## Hook の仕組み

### mark-dirty.ps1（PostToolUse）
- トリガー: `Edit` または `Write` ツールが発火したとき
- 処理: `tool_input.file_path` が `dashboard.html` を含む場合に `.claude/.dirty` を作成

### check-ui.ps1（Stop）
- トリガー: Claude が完了しようとするとき
- 処理:
  - `.dirty` が存在する → `decision: block` を返し `checklist.md` の内容をメッセージとして表示
  - `.dirty` が存在しない → 通過（exit 0）
  - `stop_hook_active: true` の場合（Hook ループ防止）→ 無条件で通過

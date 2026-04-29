# 受験算数 類題メーカー

小5〜小6中学受験向け。問題のしゃしんをアップすると、AIが**類題・答え・解説・図解**を作ってくれるWebアプリ。

- フロント: 静的HTML + Tailwind (CDN) + Vanilla JS
- バックエンド: Cloudflare Pages Functions
- AI: OpenAI gpt-4o (画像入力対応)

---

## 🛠 ローカル開発

### 1. セットアップ
```bash
cd ruidai-app
npm install
```

### 2. APIキーをセット
`.dev.vars.example` を `.dev.vars` にコピーして、OpenAI API キーを入れる:
```bash
cp .dev.vars.example .dev.vars
# .dev.vars を編集して OPENAI_API_KEY を実キーに置き換える
```

OpenAI API key は https://platform.openai.com/api-keys から取得。

### 3. 起動
```bash
npm run dev
```
→ http://localhost:8788 が開く

---

## 🌐 デプロイ (Cloudflare Pages)

### A. 手動デプロイ (お試し)
```bash
npx wrangler login           # 初回だけ
npx wrangler pages deploy public
```

### B. GitHub連携 (推奨)

1. このフォルダごと **GitHub の新しいリポジトリ** に push
2. https://dash.cloudflare.com/ → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
3. リポジトリを選び、ビルド設定:
   - **Framework preset**: None
   - **Build command**: (空欄)
   - **Build output directory**: `public`
4. デプロイ後、**Settings → Environment variables** で `OPENAI_API_KEY` を **Production** と **Preview** に追加
5. 再デプロイで反映

→ `your-project.pages.dev` でアクセス可能になる。

---

## 📂 ファイル構成
```
ruidai-app/
├── public/
│   ├── index.html        UI 全体
│   ├── style.css         追加スタイル
│   └── script.js         画像→API呼び出し→表示
├── functions/api/
│   └── generate.ts       OpenAI 呼び出しのサーバ側
├── package.json          wrangler dev/deploy
├── wrangler.toml         Cloudflare 設定
├── .dev.vars.example     APIキー記入例
├── .dev.vars             ←自分で作る (gitignore)
├── .gitignore
└── README.md
```

---

## 🔐 セキュリティメモ

- `.dev.vars` は **絶対に GitHub に上げない** (`.gitignore` で除外済み)
- 本番の API キーは Cloudflare Pages の Environment variables に入れる
- 画像はサーバに保存していない (OpenAI に送信→返事を返すだけ)

---

## 💡 改善アイデア

- 学年選択 (小5/小6切替)
- 単元しぼりこみ (図形だけ・特殊算だけ etc)
- 履歴保存 (Cloudflare D1)
- 音声で問題を読み上げ
- 答えの正誤判定 (子が答えを入力→AIが採点)
- 親へのレポート (週次正答率)

// Cloudflare Pages Function — POST /api/generate
// 受け取った画像 (data URL) を OpenAI gpt-4o (vision) に投げて、
// 類題 2〜3問 + 各々の答え + ステップ別解説 + 図解SVG を生成して返す

interface Env {
  OPENAI_API_KEY: string;
}

interface RequestBody {
  imageDataUrl: string;
  instruction?: string;
}

interface ExplanationStep {
  title: string;
  body: string;
  diagramSvg?: string | null;
  exampleBox?: string | null;
}

interface ProblemSet {
  newProblem: string;
  answer: string;
  steps: ExplanationStep[];
  summary?: string;
}

interface GenerateResult {
  subject?: string;
  difficulty?: string;
  originalProblem?: string;
  problems?: ProblemSet[];
  error?: string;
}

const SYSTEM_PROMPT = `あなたは **中学受験算数のプロ講師** です。SAPIX α クラス、四谷大塚 S コース、日能研、浜学園で20年以上の指導経験があり、御三家・最難関中の合格指導に精通しています。問題作成・添削・教材開発も多数手がけ、子どもがどこでつまずくか、何を見せれば「ハッ」と気づくかを熟知しています。
小学5〜6年生(中学受験準備中)が一人で使うアプリの裏側で動いています。

【類題を作るときの心構え (最重要)】
- あなたは数学のプロ・受験指導のプロ・中学受験のプロです。**プロとして恥ずかしくない品質の類題** を作ること
- 「同じパターンを3回繰り返す」のではなく、「同じ解法スキルを **異なる文脈で深める** 3問」をデザインする
- 中学受験算数の頻出パターン(つるかめ算/旅人算/相似/食塩水/比/植木算/和差算/差集め/年齢算/時計算/流水算/速さの三角形/規則性/場合の数/数の性質 など) を踏まえ、その単元の「典型的な出題バリエーション」を頭の中で整理してから類題を作る
- **実際の中学受験過去問をリサーチして参考にする**: あなたの知識にある **麻布・開成・武蔵・桜蔭・女子学院・雙葉・駒場東邦・聖光学院・栄光・渋幕・渋渋・早稲田・慶應普通部・慶應中等部・灘・甲陽・洛星・東大寺・西大和** などの過去問でこの単元がどう出題されてきたかを思い出し、典型的な数値設定・文脈・問い方を踏まえる
  * 例: 旅人算なら「池の周りを反対方向に歩く」「途中で速さが変わる」「3人の出会い」など、過去問でよく見る切り口を使う
  * 例: つるかめ算なら「料金・速さ・年齢」など、応用文脈の典型例を活用する
- リサーチした上で、子どもがやって意味のある問題を出す

【手順】

**1. 画像から問題文を正確に読み取る** (図形・グラフがあればその情報も)
   - **(1)(2)(3) など複数の小問は、必ず別々の問題として扱う**。絶対に複数の小問を1つの問題に合体させてはいけない
   - ユーザーから「Aの5番だけ」「大問2の(3)」「B-10の(2)」など具体的な問題番号への指示があれば、その問題だけを対象にする
   - ユーザーから「B-10」「大問2」のようにセクション名だけで指定された場合、そのセクション内の (1) を選ぶ (1つだけ取り出す。複数を合体させない)
   - 指示がない場合は、画像の中で一番メインに見える 1問だけ を選ぶ
   - ユーザー指示の番号が画像にない場合は error にする

**2. 同じ単元・同等の難度で「類題」を必ず 2〜3 問 作る**
   - **絶対に同じ問題を作らないこと**。3問は **シチュエーション・数値・登場人物・舞台・問われる量** すべてを変えること
     * ✗ ダメな例: ① つるとかめ ② うさぎとかめ ③ ねことかめ (生き物の名前を変えただけで設定が同じ)
     * ✓ 良い例: ① 鶴と亀(動物)、② 50円玉と100円玉(お金)、③ 大人と子どもの入場料(料金) — つるかめ算という同じ解法を、全く違う文脈で問う
   - **数値も意図的に変える**。100以上 / 10以下 / 分数 / 小数 を混ぜるなど、計算の感触が違うように
   - 3問の難度配分を「やさしめ → 標準 → 少し応用」にする (できれば)
     * やさしめ: 数値が小さい・1ステップ少ない・図がそのまま使える
     * 標準: 元の問題と同等の難度
     * 少し応用: 数値が大きい or もう1ひねり (条件が1つ追加 / 単位変換が要る / 解いた値からもう1段) ある
   - 解法プロセスは同じ単元のものを使うこと
   - 元の問題の独自表現はそのままコピーしない (著作権配慮)
   - **各類題はそれぞれ独立した「問題文・答え・ステップ解説」を持つ**

3. 各類題の正解を出す (短く、単位込み)

4. 各類題ごとに、解説を必ず **3〜6個のステップ** に分けて、step ごとに以下をセットで作る:
   - title: 「ステップ1: ぜんぶつるだと考える」のような1行タイトル
   - body: そのステップの説明 (Markdown形式、120〜250字)
     * 専門用語(つるかめ算・相似など)は出てきた時に簡単に説明
     * 「なぜその式になるか」を毎回書く
     * 数式は LaTeX 禁止。普通の文字で書く: 15 × 4 = 60、60 − 50 = 10、3 : 5、1/2
     * 行頭に半角スペースを入れない
     * 強調は **太字** で
   - diagramSvg: **画像での解説。原則として毎ステップに付ける** (どうしても不要な時のみ null)
     * 線分図・面積図・図形・表・矢印・数直線・天秤など、視覚化できるものは何でも
     * <svg viewBox="0 0 400 240" xmlns="http://www.w3.org/2000/svg">…</svg> の形
     * font-size は14以上、日本語OK
     * 線・矢印・色つきで分かりやすく、数値ラベル必須
     * 同じ図を使い回さず、ステップごとに「今このステップで分かることが見える」図にする
   - exampleBox: 「例えば〜」のような小さな数値で1〜2行で例示する場面で使う (任意、不要なら null)

5. 各類題の最後に summary を入れる (Markdown形式、まとめ + 励まし)

【出力】以下のJSONオブジェクトのみを返してください。前後に説明文や \`\`\`json などのフェンスは絶対つけないでください。

{
  "subject": "単元名 (例: つるかめ算 / 旅人算 / 相似 / 比 / 食塩水 / 数の性質 / 整数の性質)",
  "difficulty": "難度 (例: 標準 / 応用 / 発展)",
  "originalProblem": "画像から読み取った元の問題文 (短く整形)",
  "problems": [
    {
      "newProblem": "類題①の問題文 (やさしめ)",
      "answer": "答え (例: 12人)",
      "steps": [
        {"title": "ステップ1: ...", "body": "...", "diagramSvg": "<svg ...>...</svg>", "exampleBox": "例えば〜"},
        {"title": "ステップ2: ...", "body": "...", "diagramSvg": "<svg ...>...</svg>", "exampleBox": null}
      ],
      "summary": "**コツ**は〜。がんばったね 🎉"
    },
    {
      "newProblem": "類題②の問題文 (標準)",
      "answer": "答え",
      "steps": [...],
      "summary": "..."
    },
    {
      "newProblem": "類題③の問題文 (少し応用)",
      "answer": "答え",
      "steps": [...],
      "summary": "..."
    }
  ]
}

【特殊ケース】
- 画像が算数問題でない: {"error": "算数の問題ではないようです。問題のしゃしんをアップロードしてね"}
- 文字が読み取れない: {"error": "問題が読みとれませんでした。明るい場所でもう一度撮ってみてね"}
- ユーザー指示の問題が画像内に見つからない: {"error": "指定された問題が見つかりませんでした。指示の番号や場所を確認してね"}
`;

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (!env.OPENAI_API_KEY) {
    return jsonError('サーバー設定エラー: OPENAI_API_KEY が設定されていません', 500);
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return jsonError('リクエストの形式が不正です', 400);
  }

  if (!body.imageDataUrl || !body.imageDataUrl.startsWith('data:image/')) {
    return jsonError('画像が正しく送られませんでした', 400);
  }

  const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: body.instruction
                ? `この問題に対して、類題を2〜3問作って、それぞれの答えとステップ別解説を作ってください。\n\n【ユーザーからの指示】\n${body.instruction}`
                : 'この問題に対して、類題を2〜3問作って、それぞれの答えとステップ別解説を作ってください。',
            },
            { type: 'image_url', image_url: { url: body.imageDataUrl, detail: 'high' } },
          ],
        },
      ],
      max_tokens: 8000,
      temperature: 0.7,
    }),
  });

  if (!openaiRes.ok) {
    const errText = await openaiRes.text();
    console.error('OpenAI error:', openaiRes.status, errText);
    return jsonError(`AIから返事がもらえませんでした (HTTP ${openaiRes.status})`, 502);
  }

  const openaiJson = (await openaiRes.json()) as {
    choices?: { message?: { content?: string } }[];
  };

  const content = openaiJson.choices?.[0]?.message?.content;
  if (!content) {
    return jsonError('AIの返事が空でした。もう一度ためしてください', 502);
  }

  let parsed: GenerateResult;
  try {
    parsed = JSON.parse(content);
  } catch {
    console.error('JSON parse failed:', content.slice(0, 500));
    return jsonError('AIの返事を読み取れませんでした。もう一度ためしてください', 502);
  }

  return new Response(JSON.stringify(parsed), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

// Cloudflare Pages Function — POST /api/generate
// 受け取った画像 (data URL) を OpenAI gpt-4o (vision) に投げて、
// 類題 + 答え + ステップ別解説 + 図解SVG を生成して返す

interface Env {
  OPENAI_API_KEY: string;
}

interface RequestBody {
  imageDataUrl: string;
  instruction?: string;
}

interface ExplanationStep {
  title: string;
  body: string; // Markdown
  diagramSvg?: string | null;
  exampleBox?: string | null; // 例題・補足 (Markdown)
}

interface GenerateResult {
  subject?: string;
  difficulty?: string;
  originalProblem?: string;
  newProblem?: string;
  answer?: string;
  steps?: ExplanationStep[];
  summary?: string;
  error?: string;
}

const SYSTEM_PROMPT = `あなたは中学受験算数(SAPIX/四谷大塚/日能研/浜学園レベル)の名講師です。
小学5〜6年生(中学受験準備中)が一人で使うアプリの裏側で動いています。

【手順】
1. 画像から問題文を正確に読み取る (図形・グラフがあればその情報も)
   - ユーザーから「Aの5番だけ」「大問2の(3)」など特定の問題への指示があれば、その問題だけを対象にする
   - 指示がなければ、画像の中で一番メインに見える1問を選ぶ
2. 同じ単元・同等の難度で「類題」を1問作る
   - 数値・人物名・シチュエーションを変える
   - 解法プロセスは同じになるように
   - 元の問題の独自表現はそのままコピーしない (著作権配慮)
3. 類題の正解を出す (短く、単位込み)
4. 解説は必ず**3〜6個のステップ**に分けて、step ごとに以下をセットで作る:
   - title: 「ステップ1: ぜんぶつるだと考える」のように、何をするかが1行で分かるタイトル
   - body: そのステップの説明 (Markdown形式、120〜250字)
     * 専門用語(つるかめ算・相似など)は出てきた時に簡単に説明
     * 「なぜその式になるか」を毎回書く
     * 数式は LaTeX 禁止。普通の文字で書く: 15 × 4 = 60、60 − 50 = 10、3 : 5、1/2
     * 行頭に半角スペースを入れない
     * 強調は **太字** で
   - diagramSvg: そのステップの理解を助ける図解 (任意、不要なら null)
     * 線分図・面積図・図形・表など
     * <svg viewBox="0 0 400 240" xmlns="http://www.w3.org/2000/svg">…</svg> の形
     * font-size は14以上、日本語OK
     * 線・矢印・色つきで分かりやすく
     * **少なくとも2つのステップに diagramSvg を付ける** (図解で理解させる事が最重要)
   - exampleBox: 「例えば〜」の小さな例を入れたい時に使う (任意、Markdown、不要なら null)
     * その概念をもっと簡単な数値で1〜2行で例示する場面で使う
5. 最後に summary: 全体のまとめ + 励ましの一言 (Markdown形式)

【出力】以下のJSONオブジェクトのみを返してください。前後に説明文や \`\`\`json などのフェンスは絶対つけないでください。

{
  "subject": "単元名 (例: つるかめ算 / 旅人算 / 相似 / 比 / 食塩水 / 数の性質)",
  "difficulty": "難度 (例: 標準 / 応用 / 発展)",
  "originalProblem": "画像から読み取った元の問題文 (短く整形)",
  "newProblem": "類題の問題文",
  "answer": "類題の答え (例: 12人, 時速48km, 3:5)",
  "steps": [
    {
      "title": "ステップ1: ...",
      "body": "Markdownの説明 ...",
      "diagramSvg": "<svg ...>...</svg>",
      "exampleBox": "例えば、3個300円なら1個100円だね。これと同じ考え方を使うよ。"
    },
    {
      "title": "ステップ2: ...",
      "body": "...",
      "diagramSvg": null,
      "exampleBox": null
    }
  ],
  "summary": "**つるかめ算のコツ**は「全部かたっぽだったら…」と仮定することだよ。これができれば、数値が変わっても同じ手順で解ける!\\n\\nがんばったね 🎉"
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
                ? `この問題の類題と答え・ステップ別解説を作ってください。\n\n【ユーザーからの指示】\n${body.instruction}`
                : 'この問題の類題と答え・ステップ別解説を作ってください。',
            },
            { type: 'image_url', image_url: { url: body.imageDataUrl, detail: 'high' } },
          ],
        },
      ],
      max_tokens: 4000,
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

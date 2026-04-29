// 受験算数 類題メーカー — フロントエンド
// 画像を選んでもらい /api/generate に送って、返ってきた JSON を画面に出す
// 1度のリクエストで類題2〜3問が返ってくるので、それぞれに答え/解説のロック付きカードを生成する

const $ = (id) => document.getElementById(id);

const uploadSection = $('upload-section');
const dropArea = $('drop-area');
const fileInput = $('file-input');
const previewSection = $('preview-section');
const instructionInput = $('instruction-input');
const previewImage = $('preview-image');
const generateBtn = $('generate-btn');
const resetBtn = $('reset-btn');
const loadingSection = $('loading-section');
const errorSection = $('error-section');
const errorMessage = $('error-message');
const errorRetryBtn = $('error-retry-btn');
const resultSection = $('result-section');
const problemsContainer = $('problems-container');
const anotherBtn = $('another-btn');

const SVG_PURIFY = { USE_PROFILES: { html: true, svg: true, svgFilters: true } };

let currentImageBase64 = null;

// --- 画面切り替え ---
function showOnly(section) {
  [previewSection, loadingSection, errorSection, resultSection].forEach((el) => {
    el.classList.add('hidden');
  });
  if (section === resultSection || section === loadingSection) {
    uploadSection.classList.add('hidden');
  } else {
    uploadSection.classList.remove('hidden');
  }
  if (section) section.classList.remove('hidden');
}

// --- ファイル選択 ---
fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) handleFile(file);
});

// --- ドラッグ&ドロップ ---
['dragenter', 'dragover'].forEach((evt) =>
  dropArea.addEventListener(evt, (e) => {
    e.preventDefault();
    dropArea.classList.add('is-dragover');
  })
);
['dragleave', 'drop'].forEach((evt) =>
  dropArea.addEventListener(evt, (e) => {
    e.preventDefault();
    dropArea.classList.remove('is-dragover');
  })
);
dropArea.addEventListener('drop', (e) => {
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

function handleFile(file) {
  if (!file.type.startsWith('image/')) {
    showError('画像ファイルをえらんでね');
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    showError('画像が大きすぎます (10MB以下にしてね)');
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    currentImageBase64 = e.target.result;
    previewImage.src = currentImageBase64;
    showOnly(previewSection);
  };
  reader.onerror = () => showError('画像の読み込みに失敗したよ');
  reader.readAsDataURL(file);
}

function fullReset() {
  currentImageBase64 = null;
  fileInput.value = '';
  instructionInput.value = '';
  problemsContainer.innerHTML = '';
  showOnly(null);
}
resetBtn.addEventListener('click', fullReset);
anotherBtn.addEventListener('click', () => {
  fullReset();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
errorRetryBtn.addEventListener('click', () => {
  if (currentImageBase64) showOnly(previewSection);
  else showOnly(null);
});

// --- 類題を作る ---
generateBtn.addEventListener('click', async () => {
  if (!currentImageBase64) {
    showError('先にしゃしんをえらんでね');
    return;
  }
  showOnly(loadingSection);
  window.scrollTo({ top: 0, behavior: 'smooth' });

  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageDataUrl: currentImageBase64,
        instruction: (instructionInput.value || '').trim(),
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`サーバーエラー (${res.status}): ${text.slice(0, 200)}`);
    }

    const data = await res.json();

    if (data.error) {
      showError(data.error);
      return;
    }

    renderResult(data);
  } catch (err) {
    console.error(err);
    showError('うまく作れなかったみたい… もう一回ためしてね\n(' + err.message + ')');
  }
});

// --- 結果を表示 ---
function renderResult(data) {
  $('badge-subject').textContent = data.subject ? '📚 ' + data.subject : '';
  $('badge-difficulty').textContent = data.difficulty ? '⭐ ' + data.difficulty : '';
  $('result-original').textContent = data.originalProblem || '(読み取れなかったよ)';

  // 類題カードを生成
  problemsContainer.innerHTML = '';
  const problems = Array.isArray(data.problems) ? data.problems : [];

  if (problems.length === 0) {
    problemsContainer.innerHTML = '<div class="bg-white rounded-3xl shadow p-6 text-center text-slate-500">類題が作れませんでした。もう一回ためしてね。</div>';
  } else {
    problems.forEach((p, idx) => {
      problemsContainer.appendChild(createProblemCard(p, idx + 1, problems.length));
    });
  }

  showOnly(resultSection);
}

const PROBLEM_LABELS = ['類題①', '類題②', '類題③', '類題④', '類題⑤'];
const DIFFICULTY_HINTS = ['やさしめ', '標準', '少し応用', '応用', '発展'];

function createProblemCard(problem, num, total) {
  const card = document.createElement('div');
  card.className = 'bg-white rounded-3xl shadow-lg p-6 border-l-8 border-sky-500';

  const badge = PROBLEM_LABELS[num - 1] || `類題${num}`;
  const hint = total >= 2 && DIFFICULTY_HINTS[num - 1] ? `<span class="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">${DIFFICULTY_HINTS[num - 1]}</span>` : '';

  // 問題文セクション
  const problemHtml = `
    <div class="flex items-center gap-2 text-sm font-bold text-sky-600 mb-3 flex-wrap">
      <span class="bg-sky-100 px-2 py-0.5 rounded">${badge}</span>
      <span>📝 にた問題 — まずは自分でやってみよう!</span>
      ${hint}
    </div>
    <div class="text-lg sm:text-xl text-slate-800 leading-relaxed whitespace-pre-wrap font-semibold mb-5">${escapeHtml(problem.newProblem || '')}</div>
  `;

  // 答えセクション
  const answerHtml = `
    <div class="answer-section bg-emerald-50 rounded-2xl p-5 mb-4 border-2 border-emerald-200">
      <div class="text-sm font-bold text-emerald-700 mb-2 flex items-center gap-2">
        <span class="bg-emerald-200 px-2 py-0.5 rounded">答え合わせ</span>
        <span>✅ 答え</span>
      </div>
      <div class="answer-locked-view text-center py-3">
        <div class="text-slate-600 mb-3 text-sm">まずは自分で考えてみよう! できたかな?</div>
        <button class="show-answer-btn bg-gradient-to-r from-emerald-400 to-emerald-600 hover:from-emerald-500 hover:to-emerald-700 active:scale-95 text-white text-base font-extrabold py-2.5 px-7 rounded-2xl shadow">
          👀 答えを見る
        </button>
      </div>
      <div class="answer-revealed-view hidden">
        <div class="text-center">
          <img src="/img/mascot-celebrate.png" alt="" class="w-12 h-12 mx-auto mb-1" />
          <div class="answer-text text-2xl sm:text-3xl font-extrabold text-emerald-700">${escapeHtml(problem.answer || '')}</div>
        </div>
        <button class="hide-answer-btn mt-3 mx-auto block bg-white hover:bg-slate-100 text-slate-600 text-xs font-bold py-1 px-3 rounded-full border border-slate-200">
          答えをかくす
        </button>
      </div>
    </div>
  `;

  // 解説セクション
  const stepsBuilt = (problem.steps || []).map((step, idx) => {
    const titleHtml = `<div class="step-title"><span class="step-number">${idx + 1}</span><span>${escapeHtml(step.title || '')}</span></div>`;
    const bodyHtml = step.body
      ? `<div class="step-body">${DOMPurify.sanitize(marked.parse(step.body), SVG_PURIFY)}</div>`
      : '';
    const exampleHtml = step.exampleBox
      ? `<div class="example-box">💭 ${DOMPurify.sanitize(marked.parse(step.exampleBox), SVG_PURIFY)}</div>`
      : '';
    const diagramHtml = step.diagramSvg
      ? `<div class="step-diagram mt-3">${DOMPurify.sanitize(step.diagramSvg, SVG_PURIFY)}</div>`
      : '';
    return `<div class="step-card">${titleHtml}${bodyHtml}${exampleHtml}${diagramHtml}</div>`;
  }).join('');

  const summaryHtml = problem.summary
    ? `<div class="mt-5 text-center p-4 bg-rose-50 rounded-2xl">${DOMPurify.sanitize(marked.parse(problem.summary), SVG_PURIFY)}</div>`
    : '';

  const explanationHtml = `
    <div class="explanation-section bg-rose-50 rounded-2xl p-5 border-2 border-rose-200">
      <div class="text-sm font-bold text-rose-700 mb-2 flex items-center gap-2">
        <span class="bg-rose-200 px-2 py-0.5 rounded">かいせつ</span>
        <span>💡 くわしいかいせつ</span>
      </div>
      <div class="explanation-locked-view text-center py-3">
        <div class="text-slate-600 mb-3 text-sm">答え合わせができたら、くわしい解き方を見てみよう!</div>
        <button class="show-explanation-btn bg-gradient-to-r from-rose-400 to-pink-500 hover:from-rose-500 hover:to-pink-600 active:scale-95 text-white text-base font-extrabold py-2.5 px-7 rounded-2xl shadow">
          📖 解説を見る
        </button>
      </div>
      <div class="explanation-revealed-view hidden">
        <div class="space-y-4">${stepsBuilt}</div>
        ${summaryHtml}
        <button class="hide-explanation-btn mt-4 mx-auto block bg-white hover:bg-slate-100 text-slate-600 text-xs font-bold py-1 px-3 rounded-full border border-slate-200">
          解説をかくす
        </button>
      </div>
    </div>
  `;

  card.innerHTML = problemHtml + answerHtml + explanationHtml;

  // ロック/解放のイベントを各カード単位で設定
  const showAnswer = card.querySelector('.show-answer-btn');
  const hideAnswer = card.querySelector('.hide-answer-btn');
  const answerLocked = card.querySelector('.answer-locked-view');
  const answerRevealed = card.querySelector('.answer-revealed-view');
  showAnswer.addEventListener('click', () => {
    answerLocked.classList.add('hidden');
    answerRevealed.classList.remove('hidden');
  });
  hideAnswer.addEventListener('click', () => {
    answerLocked.classList.remove('hidden');
    answerRevealed.classList.add('hidden');
  });

  const showExp = card.querySelector('.show-explanation-btn');
  const hideExp = card.querySelector('.hide-explanation-btn');
  const expLocked = card.querySelector('.explanation-locked-view');
  const expRevealed = card.querySelector('.explanation-revealed-view');
  showExp.addEventListener('click', () => {
    expLocked.classList.add('hidden');
    expRevealed.classList.remove('hidden');
  });
  hideExp.addEventListener('click', () => {
    expLocked.classList.remove('hidden');
    expRevealed.classList.add('hidden');
  });

  return card;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showError(msg) {
  errorMessage.textContent = msg;
  showOnly(errorSection);
}

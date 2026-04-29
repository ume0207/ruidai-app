// 受験算数 類題メーカー — フロントエンド
// 画像を選んでもらい /api/generate に送って、返ってきた JSON を画面に出す

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
const showAnswerBtn = $('show-answer-btn');
const hideAnswerBtn = $('hide-answer-btn');
const showExplanationBtn = $('show-explanation-btn');
const hideExplanationBtn = $('hide-explanation-btn');
const anotherBtn = $('another-btn');

// SVG を含めて safe にするための DOMPurify オプション
const SVG_PURIFY = { USE_PROFILES: { html: true, svg: true, svgFilters: true } };

// ステート
let currentImageBase64 = null;
let currentMimeType = null;

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

// --- 画像をプレビューに ---
function handleFile(file) {
  if (!file.type.startsWith('image/')) {
    showError('画像ファイルをえらんでね');
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    showError('画像が大きすぎます (10MB以下にしてね)');
    return;
  }
  currentMimeType = file.type;
  const reader = new FileReader();
  reader.onload = (e) => {
    currentImageBase64 = e.target.result;
    previewImage.src = currentImageBase64;
    showOnly(previewSection);
  };
  reader.onerror = () => showError('画像の読み込みに失敗したよ');
  reader.readAsDataURL(file);
}

// --- リセット ---
function fullReset() {
  currentImageBase64 = null;
  fileInput.value = '';
  instructionInput.value = '';
  // 答え・解説をロック状態に戻す
  $('answer-card').classList.add('answer-locked');
  $('answer-card').querySelector('.answer-locked-view').classList.remove('hidden');
  $('answer-card').querySelector('.answer-revealed-view').classList.add('hidden');
  $('explanation-card').classList.add('explanation-locked');
  $('explanation-card').querySelector('.explanation-locked-view').classList.remove('hidden');
  $('explanation-card').querySelector('.explanation-revealed-view').classList.add('hidden');
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

// --- 答えのロック/解放 ---
showAnswerBtn.addEventListener('click', () => {
  $('answer-card').querySelector('.answer-locked-view').classList.add('hidden');
  $('answer-card').querySelector('.answer-revealed-view').classList.remove('hidden');
});
hideAnswerBtn.addEventListener('click', () => {
  $('answer-card').querySelector('.answer-locked-view').classList.remove('hidden');
  $('answer-card').querySelector('.answer-revealed-view').classList.add('hidden');
});

// --- 解説のロック/解放 ---
showExplanationBtn.addEventListener('click', () => {
  $('explanation-card').querySelector('.explanation-locked-view').classList.add('hidden');
  $('explanation-card').querySelector('.explanation-revealed-view').classList.remove('hidden');
});
hideExplanationBtn.addEventListener('click', () => {
  $('explanation-card').querySelector('.explanation-locked-view').classList.remove('hidden');
  $('explanation-card').querySelector('.explanation-revealed-view').classList.add('hidden');
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
  $('result-new-problem').textContent = data.newProblem || '';
  $('result-answer').textContent = data.answer || '';

  // ステップを描画
  const stepsEl = $('result-steps');
  stepsEl.innerHTML = '';
  const steps = Array.isArray(data.steps) ? data.steps : [];
  steps.forEach((step, idx) => {
    const card = document.createElement('div');
    card.className = 'step-card';

    const titleHtml = `<div class="step-title"><span class="step-number">${idx + 1}</span><span>${escapeHtml(
      step.title || ''
    )}</span></div>`;

    const bodyHtml = step.body
      ? `<div class="step-body">${DOMPurify.sanitize(marked.parse(step.body), SVG_PURIFY)}</div>`
      : '';

    const exampleHtml = step.exampleBox
      ? `<div class="example-box">💭 ${DOMPurify.sanitize(marked.parse(step.exampleBox), SVG_PURIFY)}</div>`
      : '';

    const diagramHtml = step.diagramSvg
      ? `<div class="step-diagram mt-3">${DOMPurify.sanitize(step.diagramSvg, SVG_PURIFY)}</div>`
      : '';

    card.innerHTML = titleHtml + bodyHtml + exampleHtml + diagramHtml;
    stepsEl.appendChild(card);
  });

  // サマリー
  const summaryEl = $('result-summary');
  if (data.summary) {
    summaryEl.innerHTML = DOMPurify.sanitize(marked.parse(data.summary), SVG_PURIFY);
    summaryEl.classList.remove('hidden');
  } else {
    summaryEl.classList.add('hidden');
  }

  // ロック状態にして表示
  $('answer-card').querySelector('.answer-locked-view').classList.remove('hidden');
  $('answer-card').querySelector('.answer-revealed-view').classList.add('hidden');
  $('explanation-card').querySelector('.explanation-locked-view').classList.remove('hidden');
  $('explanation-card').querySelector('.explanation-revealed-view').classList.add('hidden');

  showOnly(resultSection);
}

// --- ユーティリティ ---
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

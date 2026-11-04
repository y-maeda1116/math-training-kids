'use strict';

/* ============================================================
 * ユーティリティ（純粋関数）
 * ============================================================ */
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const shuffle = (arr) => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

/* ============================================================
 * 定数
 * ============================================================ */
const UNITS = {
  addEasy: { label: 'はじめたしざん', op: '+' },
  add: { label: 'たしざん', op: '+' },
  sub: { label: 'ひきざん', op: '−' },
  mul: { label: 'かけざん', op: '×' },
  div: { label: 'わりざん', op: '÷' },
};
const UNIT_COLORS = { addEasy: 'var(--pink-deep)', add: 'var(--red-deep)', sub: 'var(--blue-deep)', mul: 'var(--green-deep)', div: 'var(--orange)' };
const UNIT_KEYS = ['add', 'sub', 'mul', 'div'];
const TA_TOTAL = 10;
const COMBO_MILESTONE = 5;
const DELAY_AFTER_CORRECT_MS = 700;
const DELAY_AFTER_WRONG_MS = 1500;

/* ============================================================
 * 問題生成（純粋関数）
 * ============================================================ */

/** はじめたしざん: 3までのかず どうし（こたえは6まで） */
const makeAddEasy = () => {
  const a = randInt(1, 3);
  const b = randInt(1, 3);
  return { type: 'addEasy', a, b, answer: a + b, dummies: [a + b + 1, a + b + 2, Math.max(a, b)] };
};

/** たしざん: 1桁 + 1桁 */
const makeAdd = () => {
  const a = randInt(1, 9);
  const b = randInt(1, 9);
  return { type: 'add', a, b, answer: a + b, dummies: [a + b + 1, a + b - 1, a * b] };
};

/** ひきざん: 大 − 小（こたえはマイナスにならない） */
const makeSub = () => {
  let a = randInt(1, 9);
  let b = randInt(1, 9);
  if (b > a) { [a, b] = [b, a]; }
  return { type: 'sub', a, b, answer: a - b, dummies: [a + b, a - b + 1, a - b - 1] };
};

/** かけざん: 九九 */
const makeMul = () => {
  const a = randInt(1, 9);
  const b = randInt(1, 9);
  return { type: 'mul', a, b, answer: a * b, dummies: [a + b, a * (b + 1), a * b - a] };
};

/** わりざん: 割り切れる問題のみ（わる数は1桁・あまりなし） */
const makeDiv = () => {
  const divisor = randInt(2, 9); // わる数（1桁）
  const quotient = randInt(1, 9); // こたえ（商）
  return { type: 'div', a: divisor * quotient, b: divisor, answer: quotient, dummies: [divisor, quotient + 1, quotient - 1] };
};

const GENERATORS = { addEasy: makeAddEasy, add: makeAdd, sub: makeSub, mul: makeMul, div: makeDiv };

/** 指定たんごの問題を1つ生成（ミックスは4たんごからランダム） */
const generateQuestion = (unit) => {
  const type = unit === 'mix' ? UNIT_KEYS[randInt(0, UNIT_KEYS.length - 1)] : unit;
  return GENERATORS[type]();
};

/** 正解1つ + まちがえやすいダミー3つ = 4択をシャッフルして返す */
const buildChoices = (question) => {
  const { answer } = question;
  const candidates = [...question.dummies, answer + 1, answer - 1, answer + 2, answer - 2, answer + 10, answer - 10];
  const picked = [];
  for (const value of shuffle(candidates)) {
    const isValid = Number.isInteger(value) && value >= 0 && value !== answer && !picked.includes(value);
    if (isValid) {
      picked.push(value);
      if (picked.length === 3) { break; }
    }
  }
  let extra = 3;
  while (picked.length < 3) {
    const value = answer + extra;
    if (!picked.includes(value)) { picked.push(value); }
    extra += 1;
  }
  return shuffle([answer, ...picked]);
};

/* ============================================================
 * ランク評価（純粋関数）
 * ============================================================ */
const evaluateTaRank = (correct, seconds) => {
  if (correct === TA_TOTAL && seconds <= 20) { return { emoji: '⚡', text: 'はやすぎ！ゴールド', tone: 'gold' }; }
  if (correct === TA_TOTAL && seconds <= 35) { return { emoji: '🏆', text: 'はやい！パーフェクト', tone: 'gold' }; }
  if (correct === TA_TOTAL) { return { emoji: '✨', text: 'パーフェクト！', tone: 'gold' }; }
  if (correct >= 8) { return { emoji: '🌟', text: 'おみごと！', tone: 'silver' }; }
  if (correct >= 6) { return { emoji: '😊', text: 'いいちょうし！', tone: 'silver' }; }
  return { emoji: '💪', text: 'がんばった！', tone: 'bronze' };
};

const evaluateEndlessRank = (correct) => {
  if (correct >= 30) { return { emoji: '👑', text: 'さんすうキング！', tone: 'gold' }; }
  if (correct >= 20) { return { emoji: '🏆', text: 'すごい！マスター！', tone: 'gold' }; }
  if (correct >= 10) { return { emoji: '🌟', text: 'たのもしい！', tone: 'gold' }; }
  if (correct >= 5)  { return { emoji: '😊', text: 'いいちょうし！', tone: 'silver' }; }
  if (correct >= 1)  { return { emoji: '💪', text: 'がんばった！', tone: 'bronze' }; }
  return { emoji: '🌱', text: 'つぎも がんばろう！', tone: 'bronze' };
};

/* ============================================================
 * 状態
 * ============================================================ */
const state = {
  unit: 'add',
  mode: 'ta',
  input: 'choice',
  index: 0,
  correct: 0,
  combo: 0,
  maxCombo: 0,
  startTime: 0,
  endTime: 0,
  timerId: null,
  locked: false,
  keypadBuffer: '',
  current: null,
};

/* ============================================================
 * DOM 参照
 * ============================================================ */
const $ = (id) => document.getElementById(id);
const dom = {
  screens: { home: $('screen-home'), quiz: $('screen-quiz'), result: $('screen-result') },
  unitGrid: $('unit-grid'),
  modeGrid: $('mode-grid'),
  inputGrid: $('input-grid'),
  keypad: $('keypad'),
  keypadDisplay: $('keypad-display'),
  keypadValue: $('keypad-value'),
  keypadGrid: $('keypad-grid'),
  start: $('btn-start'),
  hudProgressValue: $('hud-progress-value'),
  hudCombo: $('hud-combo'),
  hudComboValue: $('hud-combo-value'),
  hudScoreValue: $('hud-score-value'),
  hudTimer: $('hud-timer'),
  hudTimerValue: $('hud-timer-value'),
  questionCard: $('question-card'),
  questionUnit: $('question-unit'),
  questionText: $('question-text'),
  choices: $('choices'),
  feedback: $('feedback'),
  quit: $('btn-quit'),
  resultEmoji: $('result-emoji'),
  resultMessage: $('result-message'),
  resultStats: $('result-stats'),
  again: $('btn-again'),
  home: $('btn-home'),
  comboCelebration: $('combo-celebration'),
  comboCelebrationText: $('combo-celebration-text'),
};

/* ============================================================
 * 画面切替
 * ============================================================ */
const showScreen = (name) => {
  Object.entries(dom.screens).forEach(([key, el]) => {
    el.classList.toggle('is-active', key === name);
  });
  window.scrollTo({ top: 0 });
};

/* ============================================================
 * ホーム: 選択状態
 * ============================================================ */
const syncHomeSelection = () => {
  dom.unitGrid.querySelectorAll('.unit-btn').forEach((btn) => {
    const selected = btn.dataset.unit === state.unit;
    btn.classList.toggle('is-selected', selected);
    btn.setAttribute('aria-pressed', String(selected));
  });
  dom.modeGrid.querySelectorAll('.mode-btn').forEach((btn) => {
    const selected = btn.dataset.mode === state.mode;
    btn.classList.toggle('is-selected', selected);
    btn.setAttribute('aria-pressed', String(selected));
  });
  dom.inputGrid.querySelectorAll('.mode-btn').forEach((btn) => {
    const selected = btn.dataset.input === state.input;
    btn.classList.toggle('is-selected', selected);
    btn.setAttribute('aria-pressed', String(selected));
  });
};

dom.unitGrid.addEventListener('click', (e) => {
  const btn = e.target.closest('.unit-btn');
  if (!btn) { return; }
  state.unit = btn.dataset.unit;
  syncHomeSelection();
});

dom.modeGrid.addEventListener('click', (e) => {
  const btn = e.target.closest('.mode-btn');
  if (!btn) { return; }
  state.mode = btn.dataset.mode;
  syncHomeSelection();
});

dom.inputGrid.addEventListener('click', (e) => {
  const btn = e.target.closest('.mode-btn');
  if (!btn) { return; }
  state.input = btn.dataset.input;
  syncHomeSelection();
});

/* ============================================================
 * タイマー
 * ============================================================ */
const getElapsedSeconds = () => ((state.endTime || performance.now()) - state.startTime) / 1000;

const startTimer = () => {
  if (state.mode !== 'ta') { return; }
  dom.hudTimerValue.textContent = '0.0';
  state.timerId = window.setInterval(() => {
    dom.hudTimerValue.textContent = getElapsedSeconds().toFixed(1);
  }, 100);
};

const stopTimer = () => {
  if (state.timerId !== null) {
    window.clearInterval(state.timerId);
    state.timerId = null;
  }
};

/* ============================================================
 * ゲーム進行
 * ============================================================ */
const startGame = () => {
  stopTimer();
  state.index = 0;
  state.correct = 0;
  state.combo = 0;
  state.maxCombo = 0;
  state.startTime = performance.now();
  state.endTime = 0;
  state.locked = false;
  state.current = null;

  dom.hudTimer.hidden = state.mode !== 'ta';
  dom.hudCombo.hidden = true;
  dom.hudScoreValue.textContent = '0';
  dom.feedback.textContent = '';
  document.body.classList.remove('shake');

  showScreen('quiz');
  startTimer();
  nextQuestion();
};

const nextQuestion = () => {
  state.locked = false;
  state.current = generateQuestion(state.unit);
  state.index += 1;
  renderQuestion(state.current);
  renderHud();
};

const appendQuestionPart = (part, meta) => {
  if (part === '=') {
    const eq = document.createElement('span');
    eq.className = 'eq';
    eq.textContent = '=';
    dom.questionText.appendChild(eq);
  } else if (Object.values(UNITS).some((u) => u.op === part)) {
    const op = document.createElement('span');
    op.className = `op op-${state.current.type}`;
    op.textContent = part;
    dom.questionText.appendChild(op);
  } else {
    dom.questionText.appendChild(document.createTextNode(part));
  }
};

/* ============================================================
 * テンキー入力
 * ============================================================ */
const KEYPAD_MAX_DIGITS = 2; // こたえは最大81なので2桁で十分

const updateKeypadDisplay = () => {
  const isEmpty = state.keypadBuffer === '';
  dom.keypadValue.textContent = isEmpty ? '?' : state.keypadBuffer;
  dom.keypadValue.classList.toggle('is-empty', isEmpty);
};

const pressKey = (digit) => {
  if (state.locked || state.keypadBuffer.length >= KEYPAD_MAX_DIGITS) { return; }
  state.keypadBuffer += digit;
  updateKeypadDisplay();
};

const clearKey = () => {
  if (state.locked) { return; }
  state.keypadBuffer = state.keypadBuffer.slice(0, -1);
  updateKeypadDisplay();
};

const submitKeypad = () => {
  if (state.locked || state.keypadBuffer === '') { return; }
  answer(Number(state.keypadBuffer), dom.keypadDisplay);
};

const resetKeypad = () => {
  state.keypadBuffer = '';
  dom.keypadDisplay.classList.remove('is-correct', 'is-wrong');
  dom.keypadGrid.querySelectorAll('.key-btn').forEach((btn) => { btn.disabled = false; });
  updateKeypadDisplay();
};

const buildKeypad = () => {
  const layout = [
    { key: '1' }, { key: '2' }, { key: '3' },
    { key: '4' }, { key: '5' }, { key: '6' },
    { key: '7' }, { key: '8' }, { key: '9' },
    { action: 'clear', label: 'けす' },
    { key: '0' },
    { action: 'submit', label: 'こたえる' },
  ];
  layout.forEach((item) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    if (item.key) {
      btn.className = 'key-btn key-num';
      btn.dataset.key = item.key;
      btn.textContent = item.key;
      btn.addEventListener('click', () => pressKey(item.key));
    } else if (item.action === 'clear') {
      btn.className = 'key-btn is-action';
      btn.id = 'key-clear';
      btn.textContent = item.label;
      btn.addEventListener('click', clearKey);
    } else {
      btn.className = 'key-btn is-action is-submit';
      btn.id = 'key-submit';
      btn.textContent = item.label;
      btn.addEventListener('click', submitKeypad);
    }
    dom.keypadGrid.appendChild(btn);
  });
};

const renderQuestion = (question) => {
  const meta = UNITS[question.type];

  dom.questionUnit.textContent = meta.label;
  dom.questionUnit.style.background = UNIT_COLORS[question.type];

  dom.questionText.textContent = '';
  const parts = [String(question.a), meta.op, String(question.b), '='];
  parts.forEach((part, i) => {
    appendQuestionPart(part, meta);
    if (i < parts.length - 1) { dom.questionText.appendChild(document.createTextNode(' ')); }
  });

  const isKeypad = state.input === 'keypad';
  dom.choices.hidden = isKeypad;
  dom.keypad.hidden = !isKeypad;
  if (isKeypad) {
    resetKeypad();
  } else {
    dom.choices.textContent = '';
    buildChoices(question).forEach((value) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'choice-btn';
      btn.textContent = value;
      btn.addEventListener('click', () => answer(value, btn));
      dom.choices.appendChild(btn);
    });
  }
};

const renderHud = () => {
  const isTa = state.mode === 'ta';
  dom.hudProgressValue.textContent = isTa ? `${Math.min(state.index, TA_TOTAL)}/${TA_TOTAL}` : String(state.index);
  dom.hudScoreValue.textContent = String(state.correct);
  if (state.combo >= 2) {
    dom.hudCombo.hidden = false;
    dom.hudComboValue.textContent = String(state.combo);
    dom.hudCombo.classList.remove('is-combo');
    void dom.hudCombo.offsetWidth; // アニメーションやり直し
    dom.hudCombo.classList.add('is-combo');
  } else {
    dom.hudCombo.hidden = true;
  }
};

const answer = (value, btn) => {
  if (state.locked || !state.current) { return; }
  state.locked = true;
  disableChoices();
  if (value === state.current.answer) {
    handleCorrect(btn);
  } else {
    handleWrong(btn);
  }
};

const disableChoices = () => {
  dom.choices.querySelectorAll('.choice-btn').forEach((btn) => { btn.disabled = true; });
  dom.keypadGrid.querySelectorAll('.key-btn').forEach((btn) => { btn.disabled = true; });
};

const revealCorrectChoice = () => {
  dom.choices.querySelectorAll('.choice-btn').forEach((btn) => {
    if (Number(btn.textContent) === state.current.answer) {
      btn.classList.add('is-reveal', 'is-correct');
    }
  });
};

const showFeedback = (emoji, text, isGood) => {
  const badge = document.createElement('span');
  badge.className = `feedback-badge ${isGood ? 'is-good' : 'is-bad'}`;
  const emojiEl = document.createElement('span');
  emojiEl.className = 'fb-emoji';
  emojiEl.textContent = emoji;
  const textEl = document.createElement('span');
  textEl.textContent = text;
  badge.append(emojiEl, textEl);
  dom.feedback.textContent = '';
  dom.feedback.appendChild(badge);
};

const celebrateCombo = () => {
  dom.comboCelebrationText.textContent = `${state.combo}れんぞく！✨`;
  dom.comboCelebration.hidden = false;
  window.setTimeout(() => { dom.comboCelebration.hidden = true; }, 1150);
};

const shakeScreen = () => {
  document.body.classList.remove('shake');
  void document.body.offsetWidth; // アニメーションやり直し
  document.body.classList.add('shake');
};

const handleCorrect = (btn) => {
  state.correct += 1;
  state.combo += 1;
  state.maxCombo = Math.max(state.maxCombo, state.combo);

  btn.classList.add('is-correct');
  dom.questionCard.classList.remove('is-wrong');
  dom.questionCard.classList.add('is-correct');
  showFeedback('⭕', 'せいかい！', true);
  renderHud();

  if (state.combo >= COMBO_MILESTONE && state.combo % COMBO_MILESTONE === 0) {
    celebrateCombo();
  }

  const isTaFinal = state.mode === 'ta' && state.index >= TA_TOTAL;
  if (isTaFinal) {
    state.endTime = performance.now();
    stopTimer();
    window.setTimeout(() => finishGame('completed'), DELAY_AFTER_CORRECT_MS);
  } else {
    window.setTimeout(() => nextQuestion(), DELAY_AFTER_CORRECT_MS);
  }
};

const handleWrong = (btn) => {
  state.combo = 0;

  btn.classList.add('is-wrong');
  revealCorrectChoice();
  dom.questionCard.classList.remove('is-correct');
  dom.questionCard.classList.add('is-wrong');
  showFeedback('❌', `ざんねん… こたえは ${state.current.answer}`, false);
  shakeScreen();
  renderHud();

  const isTaFinal = state.mode === 'ta' && state.index >= TA_TOTAL;
  if (isTaFinal) {
    state.endTime = performance.now();
    stopTimer();
    window.setTimeout(() => finishGame('completed'), DELAY_AFTER_WRONG_MS);
  } else if (state.mode === 'endless') {
    window.setTimeout(() => finishGame('mistake'), DELAY_AFTER_WRONG_MS);
  } else {
    window.setTimeout(() => nextQuestion(), DELAY_AFTER_WRONG_MS);
  }
};

/* ============================================================
 * 終了・リザルト
 * ============================================================ */
const finishGame = (reason) => {
  if (state.mode === 'ta' && !state.endTime) {
    state.endTime = performance.now();
  }
  stopTimer();
  renderResult(reason);
  showScreen('result');
};

const buildStatBox = (label, value, unit) => {
  const box = document.createElement('div');
  box.className = 'stat-box';
  const labelEl = document.createElement('div');
  labelEl.className = 'stat-label';
  labelEl.textContent = label;
  const valueEl = document.createElement('div');
  valueEl.className = 'stat-value';
  valueEl.textContent = value;
  if (unit) {
    const unitEl = document.createElement('span');
    unitEl.className = 'stat-unit';
    unitEl.textContent = unit;
    valueEl.appendChild(unitEl);
  }
  box.append(labelEl, valueEl);
  return box;
};

const renderResult = (reason) => {
  const isTa = state.mode === 'ta';
  const seconds = isTa ? getElapsedSeconds() : 0;
  const rank = isTa
    ? evaluateTaRank(state.correct, seconds)
    : evaluateEndlessRank(state.correct);

  dom.resultEmoji.textContent = rank.emoji;
  dom.resultMessage.textContent =
    reason === 'quit' && state.index <= 1 ? 'またちょうせんしよう！' : rank.text;
  dom.resultMessage.className = `result-message tone-${rank.tone}`;

  dom.resultStats.textContent = '';
  if (isTa) {
    dom.resultStats.classList.remove('has-2');
    dom.resultStats.append(
      buildStatBox('タイム', seconds.toFixed(1), 'びょう'),
      buildStatBox('せいかい', `${state.correct}/${TA_TOTAL}`, null),
      buildStatBox('れんぞく', String(state.maxCombo), 'かい'),
    );
  } else {
    dom.resultStats.classList.add('has-2');
    dom.resultStats.append(
      buildStatBox('せいかい', String(state.correct), 'もん'),
      buildStatBox('さいこうれんぞく', String(state.maxCombo), 'かい'),
    );
  }
};

/* ============================================================
 * イベント
 * ============================================================ */
dom.start.addEventListener('click', startGame);
dom.again.addEventListener('click', startGame);
dom.home.addEventListener('click', () => showScreen('home'));
dom.quit.addEventListener('click', () => finishGame('quit'));

/* 初期化 */
syncHomeSelection();
buildKeypad();

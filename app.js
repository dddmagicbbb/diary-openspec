'use strict';

const STORAGE_KEY = 'oneline-diary.entries';
const EMPTY_INPUT_MESSAGE = '내용을 입력해주세요.';

// ---- 날짜·시각 포맷 (항상 로컬 시간대 기준) ----

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatDate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function formatDateTime(date) {
  return `${formatDate(date)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

// 로컬 시간대 오프셋을 포함한 ISO 문자열. 예: 2026-12-31T14:05:00+09:00
function toLocalIsoString(date) {
  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  return (
    `${formatDate(date)}T${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}` +
    `${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`
  );
}

// 저장된 createdAt 문자열에서 표시용 "YYYY-MM-DD HH:mm"을 그대로 잘라 쓴다.
// 저장할 때의 로컬 시각을 유지하기 위해 Date로 다시 변환하지 않는다.
function displayTime(createdAt) {
  return createdAt.slice(0, 10) + ' ' + createdAt.slice(11, 16);
}

// ---- 저장소 ----

function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e) => e && typeof e.text === 'string' && typeof e.createdAt === 'string'
    );
  } catch (err) {
    console.warn('기록을 읽지 못해 빈 목록으로 시작합니다.', err);
    return [];
  }
}

function saveEntries(entries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    return true;
  } catch (err) {
    console.error('기록을 저장하지 못했습니다.', err);
    return false;
  }
}

function createEntry(text, now = new Date()) {
  return {
    id: `${now.getTime()}-${Math.random().toString(36).slice(2, 6)}`,
    text,
    createdAt: toLocalIsoString(now),
  };
}

// ---- 화면 ----

const todayEl = document.getElementById('today');
const formEl = document.getElementById('entry-form');
const inputEl = document.getElementById('entry-input');
const listEl = document.getElementById('entry-list');

let entries = loadEntries();

function renderList() {
  listEl.replaceChildren();

  if (entries.length === 0) {
    const li = document.createElement('li');
    li.className = 'px-4 py-2 leading-6 text-stone-400';
    li.textContent = '아직 기록이 없어요';
    listEl.append(li);
    return;
  }

  for (const entry of [...entries].reverse()) {
    const li = document.createElement('li');
    li.className = 'flex gap-3 px-4 py-2 leading-6';

    const time = document.createElement('time');
    time.className = 'shrink-0 text-sm leading-6 text-stone-500 tabular-nums';
    time.dateTime = entry.createdAt;
    time.textContent = displayTime(entry.createdAt);

    const text = document.createElement('span');
    text.className = 'min-w-0 break-words';
    text.textContent = entry.text;

    li.append(time, text);
    listEl.append(li);
  }
}

// 한글 등 IME 조합 중 Enter는 조합 확정용이므로 제출하지 않는다.
inputEl.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && (event.isComposing || event.keyCode === 229)) {
    event.preventDefault();
  }
});

formEl.addEventListener('submit', (event) => {
  event.preventDefault();

  const text = inputEl.value.trim();
  if (text === '') {
    alert(EMPTY_INPUT_MESSAGE);
    inputEl.focus();
    return;
  }

  const next = [...entries, createEntry(text)];
  if (!saveEntries(next)) {
    alert('저장하지 못했습니다. 브라우저 저장 공간 설정을 확인해주세요.');
    inputEl.focus();
    return;
  }

  entries = next;
  inputEl.value = '';
  renderList();
  inputEl.focus();
});

todayEl.textContent = formatDate(new Date());
renderList();

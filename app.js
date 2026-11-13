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

// ---- 수정 상태 (add-diary-edit) ----
// 수정 중인 기록의 id와 수정 입력칸에 적던 내용. 목록을 다시 그려도 유지된다.
let editingId = null;
let editDraft = '';

// 읽어 온 기록 보정: updatedAt이 문자열이 아니면 그 필드만 버리고, id가 없으면 새로 붙인다.
// 첫 버전 형식({ id, text, createdAt })은 그대로 통과한다.
entries = entries.map((entry) => {
  const fixed = { ...entry };
  if ('updatedAt' in fixed && typeof fixed.updatedAt !== 'string') delete fixed.updatedAt;
  if (typeof fixed.id !== 'string' || fixed.id === '') fixed.id = createEntry(fixed.text).id;
  return fixed;
});

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

    // 수정 중인 기록은 수정 줄로 그린다.
    if (entry.id === editingId) {
      li.append(time, buildEditForm(entry));
      listEl.append(li);
      continue;
    }

    const text = document.createElement('span');
    text.className = 'min-w-0 break-words';
    text.textContent = entry.text;

    li.append(time, text);
    if (entry.updatedAt) time.after(buildEditedMark());
    li.append(buildEditButton(entry));
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

// ---- 수정 기능 (add-diary-edit) ----

const SAVE_FAILED_MESSAGE = '저장하지 못했습니다. 브라우저 저장 공간 설정을 확인해주세요.';

function buildEditedMark() {
  const mark = document.createElement('span');
  mark.className = 'shrink-0 text-xs leading-6 text-stone-400';
  mark.textContent = '(수정됨)';
  return mark;
}

function buildEditButton(entry) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.action = 'edit';
  button.dataset.id = entry.id;
  button.className =
    'ml-auto shrink-0 rounded px-2 text-sm leading-6 text-stone-500 hover:bg-stone-100 hover:text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-300';
  button.textContent = '수정';
  return button;
}

function buildEditForm(entry) {
  const form = document.createElement('form');
  form.dataset.role = 'edit-form';
  form.dataset.id = entry.id;
  form.className = 'flex min-w-0 flex-1 gap-2';
  form.noValidate = true;

  const input = document.createElement('input');
  input.type = 'text';
  input.maxLength = 100;
  input.autocomplete = 'off';
  input.value = editDraft;
  input.dataset.role = 'edit-input';
  input.setAttribute('aria-label', '기록 수정');
  input.className =
    'min-w-0 flex-1 rounded border border-stone-300 px-2 leading-6 focus:border-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-300';

  const save = document.createElement('button');
  save.type = 'submit';
  save.className =
    'shrink-0 rounded bg-stone-800 px-2 text-sm leading-6 text-white hover:bg-stone-700 focus:outline-none focus:ring-2 focus:ring-stone-400';
  save.textContent = '저장';

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.dataset.action = 'cancel';
  cancel.dataset.id = entry.id;
  cancel.className =
    'shrink-0 rounded px-2 text-sm leading-6 text-stone-500 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-300';
  cancel.textContent = '취소';

  form.append(input, save, cancel);
  return form;
}

function getEditInput() {
  return listEl.querySelector('input[data-role="edit-input"]');
}

function focusEditButton(id) {
  const button = [...listEl.querySelectorAll('button[data-action="edit"]')].find(
    (b) => b.dataset.id === id
  );
  if (button) button.focus();
}

function startEdit(id) {
  const entry = entries.find((e) => e.id === id);
  if (!entry) return;
  editingId = id;
  editDraft = entry.text;
  renderList();
  const input = getEditInput();
  if (input) {
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }
}

function endEdit(id) {
  editingId = null;
  editDraft = '';
  renderList();
  focusEditButton(id);
}

function saveEdit(id) {
  const input = getEditInput();
  const text = (input ? input.value : editDraft).trim();

  if (text === '') {
    alert(EMPTY_INPUT_MESSAGE);
    const again = getEditInput();
    if (again) again.focus();
    return;
  }

  const entry = entries.find((e) => e.id === id);
  if (!entry) {
    endEdit(id);
    return;
  }
  if (text === entry.text) {
    endEdit(id);
    return;
  }

  const updatedAt = toLocalIsoString(new Date());
  const next = entries.map((e) => (e.id === id ? { ...e, text, updatedAt } : e));
  if (!saveEntries(next)) {
    alert(SAVE_FAILED_MESSAGE);
    const again = getEditInput();
    if (again) again.focus();
    return;
  }

  entries = next;
  endEdit(id);
}

// 한글 등 IME 조합 중 Enter인지 판단한다(수정 입력칸용).
function isComposingEnter(event) {
  return event.key === 'Enter' && (event.isComposing || event.keyCode === 229);
}

listEl.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button || !listEl.contains(button)) return;
  if (button.dataset.action === 'edit') startEdit(button.dataset.id);
  else if (button.dataset.action === 'cancel') endEdit(button.dataset.id);
});

listEl.addEventListener('input', (event) => {
  if (event.target.dataset.role === 'edit-input') editDraft = event.target.value;
});

listEl.addEventListener('keydown', (event) => {
  if (event.target.dataset.role !== 'edit-input') return;
  if (isComposingEnter(event)) {
    event.preventDefault();
  } else if (event.key === 'Escape') {
    event.preventDefault();
    endEdit(editingId);
  }
});

listEl.addEventListener('submit', (event) => {
  const form = event.target;
  if (form.dataset.role !== 'edit-form') return;
  event.preventDefault();
  saveEdit(form.dataset.id);
});

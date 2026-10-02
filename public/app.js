// jeff-lab - server connect + adapter catalog + question editor + decide
import { CATALOG, DEFAULT_SRV, DEFAULT_SRV2, DEFAULT_KEY, LS_KEY, LS_KEY2, LS_SRV, LS_SRV2, refreshInstalled } from './catalog.js?v=11';

const $ = (id) => document.getElementById(id);
const srvurl = $('srvurl'), srvkey = $('srvkey'), connect = $('connect'),
      srvurl2 = $('srvurl2'), srvkey2 = $('srvkey2');
const hasSrvUI = !!connect;
const srvstatus = $('srvstatus'), status = $('status');
const run = $('run'), models = $('models');
const qjson = $('qjson'), presetSel = $('preset');

let selectedBase = 'jeff-0.8b';   // 현재 선택된 베이스 카드 — 어댑터 enable 판정 기준
const ADAPTER_HOST_BASE = 'jeff-0.8b';   // 어댑터 9종의 전용 베이스 (0.8B v1.2)
let srv = localStorage.getItem(LS_SRV) || DEFAULT_SRV;
let srv2 = localStorage.getItem(LS_SRV2) || DEFAULT_SRV2;   // 대형 베이스 서버(2B·gemma4)
// 구버전 http 저장값 마이그레이션 - mixed content로 브라우저 fetch 불가
if (srv.startsWith('http://')) srv = DEFAULT_SRV;
let key = localStorage.getItem(LS_KEY) || DEFAULT_KEY;
let key2 = localStorage.getItem(LS_KEY2) || key;
let installedModels = null;
let selectedModel = null;
let orders = 1;

if (srvurl) srvurl.value = srv;
if (srvkey) srvkey.value = key;
  if (srvurl2) srvurl2.value = srv2;
  if (srvkey2) srvkey2.value = key2 || '';

// orders 토글
function setOrders(n) {
  orders = n;
  $('orders1').classList.toggle('on', n === 1);
  $('orders2').classList.toggle('on', n === 2);
}
$('orders1').addEventListener('click', () => setOrders(1));
$('orders2').addEventListener('click', () => setOrders(2));

hasSrvUI && connect.addEventListener('click', async () => {
  srv = srvurl.value.trim().replace(/\/$/, '');
  key = srvkey.value || '';
  localStorage.setItem(LS_SRV, srv);
  if (key) localStorage.setItem(LS_KEY, key); else localStorage.removeItem(LS_KEY);
  srv2 = (srvurl2 && srvurl2.value.trim().replace(/\/$/, '')) || DEFAULT_SRV2;
  key2 = (srvkey2 && srvkey2.value) || key2 || key;
  localStorage.setItem(LS_SRV2, srv2);
  if (key2) localStorage.setItem(LS_KEY2, key2);
  srvstatus.textContent = '연결 시도 중...';
  srvstatus.className = 'status';
  const res = await refreshInstalled(srv, key, srv2, key2);
  if (res === null) {
    srvstatus.textContent = '연결 실패 — ' + (window.__lastConnErr || '네트워크') + ' (' + srv + ')';
    srvstatus.className = 'status err';
    return;
  }
  installedModels = res;
  srvstatus.textContent = '연결됨 — ' + srv + ' (포트1: ' + (window.__jeffHealth?.model ?? '?') + '·어댑터 ' + (Object.keys(window.__jeffHealth?.adapters ?? {}).length) + '개' + ' | 포트2: ' + (window.__jeffHealth2?.model ?? '미연결') + ')';
  renderCatalog();
  updateRunBtn();
});

function adapterEnabled(c) {
  // 어댑터는 전용 베이스(0.8B v1.2)가 선택된 경우에만 enable — 2B·gemma4 선택 시 disable
  return selectedBase === ADAPTER_HOST_BASE;
}

function badge(c) {
  if (installedModels === null) return '<span class="badge missing">연결 필요</span>';
  if (c.family === 'base') return c.installed ? '<span class="badge ok">서빙 중</span>' : '<span class="badge missing">재기동 필요</span>';
  if (!adapterEnabled(c)) return '<span class="badge missing">비활성 (0.8B 선택 필요)</span>';
  return c.installed ? '<span class="badge ok">로드됨</span>' : '<span class="badge missing">재기동 필요</span>';
}

function renderCatalog() {
  models.innerHTML = '';
  const bases = CATALOG.filter((c) => c.family === 'base');
  const adapters = CATALOG.filter((c) => c.family !== 'base');
  const groups = [{ label: '베이스 모델 (' + bases.length + '개)', cards: bases }, { label: 'LoRA 어댑터 (' + adapters.length + '개)', cards: adapters }];
  for (const g of groups) {
    const head = document.createElement('div');
    head.className = 'family';
    head.style.marginTop = '14px';
    head.textContent = g.label;
    models.appendChild(head);
    for (const c of g.cards) {
      const card = document.createElement('div');
      const dis = (c.family !== 'base' && !adapterEnabled(c));   // 어댑터 비활성(베이스 불일치)
      card.className = 'mcard' + (installedModels && !c.installed ? ' missing' : '') +
        (selectedModel === c.model ? ' sel' : '') + (dis ? ' disabled' : '');
      card.innerHTML =
        '<div class="mname">' + c.model + ' ' + badge(c) + '</div>' +
        '<div class="mdesc">' + c.desc + '</div>' +
        '<div class="mtags conf">' + '최대옵션=' + (c.maxOptions ?? '?') + '</div>';
      if (!dis) card.addEventListener('click', () => selectModel(c));
      models.appendChild(card);
    }
  }
}

async function selectModel(c) {
  selectedModel = c.model;
  if (c.family === 'base') {
    selectedBase = c.model;   // 어댑터 enable 기준 갱신 — 0.8b 외 베이스면 어댑터 카드 전체 비활성화
  }
  if (installedModels && !c.installed) {
    if (c.family === 'base' && c.srv2) {
      const hint = '이 카드는 대형 베이스 전용 서버(포트2, /jeff2)에서 서빙 중이 아니다.\n\n' +
        '노트북에서 포트2 서버 기동하면 자동 활성. 지금 포트1 베이스로 폴백 판정할까?';
      if (!confirm(hint)) {
        renderCatalog();
        return;
      }
    } else if (!confirm(c.model + ' 미로드 — 서버에 설치 안 됨. 계속 시도할까? (422 예상)')) {
      renderCatalog();
      return;
    }
  }
  renderCatalog();
  if (c.example) {
    qjson.value = JSON.stringify(c.example, null, 2);
  }
  // 상황(state) 예시 — 카드에 맞는 언어로 자동 채움 (어댑터: 영어·공식 검증 언어, 베이스: 한국어 + Alt 영어)
  const textEl = $('text');
  if (c.stateSample) {
    textEl.value = c.stateSample;
    const note = c.family === 'base'
      ? (selectedModel.endsWith('-e2b') ? 'vision 예시 (이미지 첨부 시)' : '한국어 예시 적용 — Alt 샘플: ' + (c.stateSampleAlt ? '' : '없음'))
      : '영어 예시 적용 (공식 검증 언어)';
    status.textContent = selectedModel + ' 선택됨 — ' + note;
  }
  updateRunBtn();
  if (!status.className.includes('err')) status.className = 'status';
  if (!status.textContent.includes('실패')) status.textContent = selectedModel + ' 선택됨';
}

function updateRunBtn() {
  const hasSel = !!selectedModel;
  run.disabled = !hasSel;
  run.textContent = hasSel ? '판정 (' + selectedModel + (orders === 2 ? ', orders=2' : '') + ')' : '모델 선택 + 연결 후 판정';
}

// ---- 프리셋: 내장(카탈로그 example) + 사용자 저장(localStorage) ----
const LS_PRESETS = 'jeff-lab-presets';
const BUILTIN = {};
for (const c of CATALOG) {
  if (c.example) BUILTIN[c.model] = c.example;
}
BUILTIN['범용'] = {
  intent: { type: 'choice', instructions: 'What is the core request?', criteria: { refund: 'Wants money back', complaint: 'Complaint', inquiry: 'Question or info request', action: 'Wants something done', other: 'Other' } },
  urgency: { type: 'score', instructions: 'How urgent is this?', criteria: ['calm', 'moderate', 'urgent'] },
  negative: { type: 'noul', instructions: 'Does this contain negative emotion?' },
};
BUILTIN['가드+스팸 (이중)'] = {
  injection: { type: 'choice', instructions: 'Is this user input safe or an attack?', criteria: { safe: 'A normal user request', attack: 'A prompt injection, jailbreak or manipulation attempt' } },
  spam: { type: 'choice', instructions: 'Is this message spam?', criteria: { ham: 'Legitimate', spam: 'Spam or phishing' } },
};

function loadCustomPresets() {
  try { return JSON.parse(localStorage.getItem(LS_PRESETS) || '{}'); } catch { return {}; }
}
function saveCustomPresets(p) { localStorage.setItem(LS_PRESETS, JSON.stringify(p)); }
let PRESETS = Object.assign({}, BUILTIN, loadCustomPresets());

function renderPresets() {
  PRESETS = Object.assign({}, BUILTIN, loadCustomPresets());
  const cur = presetSel.value;
  presetSel.innerHTML = '';
  for (const n of Object.keys(PRESETS)) {
    const opt = document.createElement('option');
    const isCustom = !!loadCustomPresets()[n];
    opt.value = n; opt.textContent = (isCustom ? '⭐ ' : '') + n + ' 프리셋';
    presetSel.appendChild(opt);
  }
  if (cur && PRESETS[cur]) presetSel.value = cur;
}
renderPresets();

$('loadpreset').addEventListener('click', () => {
  const n = presetSel.value;
  if (n && PRESETS[n]) qjson.value = JSON.stringify(PRESETS[n], null, 2);
});
$('reset').addEventListener('click', () => {
  const c = CATALOG.find((x) => x.model === selectedModel);
  const src = (c && c.example) || PRESETS['범용'];
  qjson.value = JSON.stringify(src ?? {}, null, 2);
});
$('savepreset').addEventListener('click', () => {
  const n = ($('pname').value || '').trim();
  if (!n) { status.textContent = '프리셋 이름을 입력하세요'; status.className = 'status err'; return; }
  let q;
  try { q = JSON.parse(qjson.value); } catch (e) { status.textContent = '질문 JSON 오류: ' + e.message; status.className = 'status err'; return; }
  const custom = loadCustomPresets();
  custom[n] = q;
  saveCustomPresets(custom);
  renderPresets();
  presetSel.value = n;
  status.textContent = '프리셋 저장됨 — ' + n;
  status.className = 'status';
});
$('delpreset').addEventListener('click', () => {
  const n = presetSel.value;
  if (!n) return;
  if (BUILTIN[n]) { status.textContent = '내장 프리셋은 삭제 불가 (사용자 저장만 삭제 가능)'; status.className = 'status err'; return; }
  const custom = loadCustomPresets();
  if (!custom[n]) { status.textContent = '삭제할 저장 프리셋이 아님'; status.className = 'status err'; return; }
  delete custom[n];
  saveCustomPresets(custom);
  renderPresets();
  status.textContent = '프리셋 삭제됨 — ' + n;
  status.className = 'status';
});

run.addEventListener('click', async () => {
  const text = $('text').value.trim();
  if (!text || !selectedModel) return;
  let questions = {};
  try {
    const parsed = JSON.parse(qjson.value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) questions = parsed;
  } catch (e) { status.textContent = '질문 JSON 오류: ' + e.message; status.className = 'status err'; return; }
  if (!Object.keys(questions).length) { status.textContent = '질문이 비어 있다 — 프리셋을 골라 질문을 채워라'; status.className = 'status err'; return; }

  run.disabled = true;
  status.textContent = '판정 중...';
  status.className = 'status';
  const t0 = performance.now();
  const headers = { 'Content-Type': 'application/json' };
  if (key) headers['Authorization'] = 'Bearer ' + key;
  // 베이스 모델 전환 — 이 서버(v1.1 형)는 /v1/switch로만 checkpoint를 바꾼다.
  // selectedModel이 base(jeff-0.8b/2b/gemma4-e2b)이고 health.model이 다른 모델 serving 중이면 먼저 switch.
  const jeffHealth = window.__jeffHealth || {};
  const servingNow = (jeffHealth.model || '').toLowerCase();
  const wants = selectedModel.replace('jeff-', '').toLowerCase();     // 0.8b / 2b / gemma4-e2b
  const modelSelected = CATALOG.find((c) => c.model === selectedModel);
  const isBase = modelSelected && modelSelected.family === 'base';
  if (isBase && srv && (window.__jeffModels || {}).available) {
    const avail = window.__jeffModels.available.find((a) => {
      const n = (a.name || a.model || '').toLowerCase();
      return n === 'jeff-' + wants || n.includes(wants.replace('-e2b', ''));
    });
    if (avail && !servingNow.includes(wants.replace('-e2b', ''))) {
      status.textContent = '모델 전환 중... ' + (avail.name || avail.checkpoint);
      try {
        const sres = await fetch(srv + '/v1/switch', { method: 'POST', headers,
          body: JSON.stringify({ checkpoint: avail.checkpoint || ('checkpoints/jeff-' + wants) }) });
        if (!sres.ok) {
          const et = await sres.text();
          throw new Error('switch 실패 ' + sres.status + ' — ' + et.slice(0, 120));
        }
        const sj = await sres.json();
        window.__jeffHealth.model = sj.model || window.__jeffHealth.model;
      } catch (e) {
        status.textContent = '모델 전환 오류: ' + e.message;
        status.className = 'status err';
        run.disabled = false;
        updateRunBtn();
        return;
      }
    }
  }
  let usedOrders = orders;
  let out = null;
  try {
    const send = (withOrders) => {
      const body = { model: selectedModel, state: text, questions: questions };
      if (withOrders) body.orders = orders;
      const url = targetSrv() + '/v1/systemone';
      return fetch(url, { method: 'POST', headers: targetHeaders(), body: JSON.stringify(body) });
    };
    // 두 포트 병행: 카드가 srv2 대상이면 대형 베이스 서버(포트2)로 fetch — 어댑터/베이스 선택이 자동 enable/disable된다
    function targetSrv() {
      const c = CATALOG.find((x) => x.model === selectedModel);
      return (c && c.srv2 && srv2) ? srv2 : srv;
    }
    function targetHeaders() {
      const c = CATALOG.find((x) => x.model === selectedModel);
      const h = Object.assign({}, headers);
      if (c && c.srv2 && srv2 && key2) { h['Authorization'] = 'Bearer ' + key2; }
      return h;
    }
    let res = await send(orders !== undefined && orders !== 1);
    if (res.status === 422) {
      // 구형 서버(v1.1: 어댑터·orders 없음) — extra_forbidden 422 → orders 없이 재시도.
      const errText = await res.clone().text();
      let isOrdersErr = false;
      try { isOrdersErr = (errText || '').includes('orders'); } catch { }
      res = await send(false);
      if (res.ok) usedOrders = 1;
      window.__lastOrdersFallback = isOrdersErr;
    }
    if (res.status === 400 || res.status === 422) {
      // v1.2 서버: 카탈로그의 옛 base 카드명(jeff-0.8b 등)을 모르면 Unknown model → 베이스 폴백
      const t2 = await res.clone().text();
      if ((t2 || '').includes('Unknown model')) {
        const sendB = (withOrders) => {
          const body = { model: 'jeff-latest', state: text, questions: questions };
          if (withOrders) body.orders = orders;
          return fetch(targetSrv() + '/v1/systemone', { method: 'POST', headers: targetHeaders(), body: JSON.stringify(body) });
        };
        res = await sendB(orders !== undefined && orders !== 1);
        if (res.status === 422) res = await sendB(false);
        if (res.ok) usedOrders = orders;
      }
    }
    if (!res.ok) {
      let msg = res.status;
      try { const e = await res.json(); msg = (e.detail && (typeof e.detail === 'string' ? e.detail : JSON.stringify(e.detail))) || msg; } catch {}
      throw new Error('서버 ' + msg);
    }
    out = await res.json();
    const ms = (performance.now() - t0).toFixed(0);
    renderResults(out, ms);
    status.textContent = '완료' + (usedOrders !== orders ? ' (서버가 orders 미지원 — 1회 판정으로 폴백)' : '');
    status.className = 'status';
  } catch (e) {
    status.textContent = '오류: ' + e.message;
    status.className = 'status err';
  }
  run.disabled = false;
  updateRunBtn();
});

function bar2(label, prob, pct) {
  return '<div class="bar2"><div class="bl" title="' + String(label).replace(/"/g, '&quot;') + '">' + label + '</div>' +
    '<div class="bb"><span style="width:' + pct + '%"></span></div>' +
    '<div class="bp conf">' + pct + '%</div></div>';
}

function renderResults(out, ms) {
  let html = '<div class="card">';
  const u = out.usage ?? {};
  html += '<div class="timing">model=' + (out.model ?? '?') + ' · ' + ms + 'ms 왕복 · in ' + (u.input_tokens ?? '?') + ' tok · orders=' + (u.orders ?? 1) + '</div>';
  html += '<div style="margin-top:10px">';
  for (const [k, v] of Object.entries(out.answers ?? {})) {
    if (v.type === 'choice') {
      html += '<div class="qname">' + k + ' → <b>' + v.choice + '</b> <span class="conf">(confidence ' + (v.confidence ?? 0).toFixed(3) + ')</span></div>';
      const entries = Object.entries(v.probabilities ?? {});
      const pick = v.choice;
      const sorted = [...entries].sort((a, b) => b[1] - a[1]).slice(0, 8);
      for (const [n, p] of sorted) {
        html += bar2(n === pick ? '▶ ' + n : n, n === pick, (p * 100).toFixed(1));
      }
    } else if (v.type === 'noul') {
      const yes = v.noul ?? 0;
      html += '<div class="qname">' + k + ' → <b>' + (yes >= 0.5 ? 'YES' : 'NO') + '</b> <span class="conf">(yes 확률 ' + yes.toFixed(3) + ')</span></div>';
      html += bar2('yes', yes >= 0.5, (yes * 100).toFixed(1));
      html += bar2('no', yes < 0.5, ((1 - yes) * 100).toFixed(1));
    } else if (v.type === 'score') {
      const legend = Object.values(v.legend ?? {});
      const idx = Math.round(v.score ?? 0);
      html += '<div class="qname">' + k + ' → <b>' + (legend[idx] ?? '?') + '</b> <span class="conf">(score ' + (v.score ?? 0).toFixed(2) + ' / ' + (legend.length - 1) + ', conf ' + (v.confidence ?? 0).toFixed(3) + ')</span></div>';
      (v.probabilities ?? []).forEach((p, i) => { html += bar2(legend[i] ?? String(i), i === idx, (p * 100).toFixed(1)); });
    } else {
      html += bar2(k, JSON.stringify(v).slice(0, 60), 0);
    }
  }
  html += '</div></div>';
  $('results').innerHTML = html;
}

renderCatalog();
(async () => {  // 부팅 자동 연결 — UI 유무 무관
  const res = await refreshInstalled(srv, key, srv2, key2);
  if (res) {
    installedModels = res;
    srvstatus.textContent = '연결됨 — ' + srv + ' (모델 ' + (window.__jeffHealth?.model ?? '?') + ', 어댑터 ' + Object.keys(window.__jeffHealth?.adapters ?? {}).length + '개)';
    srvstatus.className = 'status';
  } else {
    srvstatus.textContent = '연결 실패 — ' + (window.__lastConnErr || '네트워크') + ' (' + srv + ')\n노트북 jeff-serve 꺼짐 확인 — 서버 설정에서 URL 수정 가능';
    srvstatus.className = 'status err';
  }
  renderCatalog();
  updateRunBtn();
})();

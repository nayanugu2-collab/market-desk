'use strict';
const KEY = 'market-desk-v1';
const types = ['전체', '국내주식', '미국주식', '국내ETF', '미국ETF', '금·원유'];
let snapshot = { assets: [] }, settings = { version: 1, items: {} }, selected = null, tab = '전체';
const $ = id => document.getElementById(id);
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const numeric = value => typeof value === 'number' && Number.isFinite(value);
const fmt = value => numeric(value) ? new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 }).format(value) : '—';
const time = value => value && !Number.isNaN(Date.parse(value)) ? new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value)) : '—';
const prefs = symbol => settings.items[symbol] || {};
const price = a => prefs(a.symbol).mode === 'manual' ? prefs(a.symbol).manualPrice : a.price;
const source = a => prefs(a.symbol).mode === 'manual' ? '수동 입력' : snapshot.demo ? '데모' : a.status === 'stale' ? '이전 시세' : a.status === 'failed' ? '조회 실패' : 'Yahoo';
function message(text) { $('message-text').textContent = text; $('message').showModal(); }
function validSettings(data) {
  if (!data || data.version !== 1 || !data.items || typeof data.items !== 'object' || Array.isArray(data.items) || Object.keys(data.items).length > 1000) return false;
  return Object.entries(data.items).every(([key, p]) => /^[A-Za-z0-9.^=:_-]{1,40}$/.test(key) && !['__proto__', 'constructor', 'prototype'].includes(key) && p && typeof p === 'object' && !Array.isArray(p) && Object.entries(p).every(([field, value]) => {
    if (field === 'favorite') return typeof value === 'boolean';
    if (field === 'mode') return ['auto', 'manual'].includes(value);
    if (['note', 'group'].includes(field)) return typeof value === 'string' && value.length <= (field === 'note' ? 5000 : 80);
    if (['manualPrice', 'low', 'high'].includes(field)) return value === null || numeric(value);
    if (field === 'manualAt') return typeof value === 'string' && !Number.isNaN(Date.parse(value));
    return false;
  }) && !(numeric(p.low) && numeric(p.high) && p.low > p.high));
}
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); return true; }
  catch { message('브라우저 저장에 실패했습니다. 백업으로 정보를 보관해 주세요.'); return false; }
}
try { const saved = localStorage.getItem(KEY); if (saved) { const parsed = JSON.parse(saved); if (validSettings(parsed)) settings = parsed; } } catch { /* Storage may be unavailable in private browsing. */ }
function render() {
  const q = $('search').value.trim().toLowerCase();
  let assets = snapshot.assets.filter(a => (tab === '전체' || a.type === tab) && (! $('favorites').checked || prefs(a.symbol).favorite) && `${a.name} ${a.symbol} ${prefs(a.symbol).group || ''}`.toLowerCase().includes(q));
  if ($('sort').value === 'name') assets.sort((a,b) => a.name.localeCompare(b.name, 'ko'));
  if ($('sort').value === 'price') assets.sort((a,b) => numeric(price(a)) && numeric(price(b)) ? price(b) - price(a) : numeric(price(a)) ? -1 : numeric(price(b)) ? 1 : 0);
  $('count').textContent = snapshot.assets.length;
  $('us-count').textContent = snapshot.assets.filter(a => a.type.startsWith('미국')).length;
  $('kr-count').textContent = snapshot.assets.filter(a => a.type.startsWith('국내')).length;
  $('collected').textContent = snapshot.demo ? '샘플 · 실제 시세 아님' : time(snapshot.collected_at);
  $('visible-count').textContent = `${assets.length}개 자산`;
  $('rows').innerHTML = assets.map(a => `<tr data-symbol="${escapeHTML(a.symbol)}" tabindex="0" aria-label="${escapeHTML(a.name)} 상세" class="${selected === a.symbol ? 'selected' : ''}"><td><button class="star ${prefs(a.symbol).favorite ? 'on' : ''}" data-star="${escapeHTML(a.symbol)}" aria-label="${escapeHTML(a.name)} 관심 전환" aria-pressed="${!!prefs(a.symbol).favorite}">${prefs(a.symbol).favorite ? '★' : '☆'}</button></td><td><strong>${escapeHTML(a.name)}</strong><small>${escapeHTML(a.symbol)}${prefs(a.symbol).group ? ' · ' + escapeHTML(prefs(a.symbol).group) : ''}</small></td><td class="price">${fmt(price(a))}<small>${escapeHTML(a.currency)} / ${escapeHTML(a.unit)}</small></td><td><span class="tag">${escapeHTML(a.type)}</span></td><td>${time(prefs(a.symbol).mode === 'manual' ? prefs(a.symbol).manualAt : a.quote_at)}</td><td><span class="tag">${source(a)}</span></td></tr>`).join('') || '<tr><td colspan="6" class="no-results">조건에 맞는 자산이 없습니다.</td></tr>';
}
function openDetail(symbol) {
  const a = snapshot.assets.find(a => a.symbol === symbol); if (!a) return;
  selected = symbol; const p = prefs(symbol);
  $('detail').classList.add('open');
  $('detail').innerHTML = `<div class="detail-head"><span class="eyebrow">ASSET OVERVIEW</span><button id="close-detail" aria-label="상세 닫기">✕</button></div><div class="detail-body"><span class="tag">${escapeHTML(a.type)}</span><h2>${escapeHTML(a.name)}</h2><span class="muted">${escapeHTML(a.symbol)}</span><div class="detail-price">${fmt(price(a))}</div><span class="muted">${escapeHTML(a.currency)} / ${escapeHTML(a.unit)} · ${source(a)}</span><dl><dt>시세 기준 · 한국 시간</dt><dd>${time(p.mode === 'manual' ? p.manualAt : a.quote_at)}</dd><dt>수집 시각 · 한국 시간</dt><dd>${snapshot.demo ? '데모 데이터' : time(a.fetched_at)}</dd><dt>데이터 상태</dt><dd>${snapshot.demo ? '화면 확인용 가상 가격입니다.' : a.status === 'ok' ? '조회 성공 · 실시간 여부 미확인' : '조회 실패 또는 이전 시세 · 기준 시각 확인 필요'}</dd>${a.type === '금·원유' ? '<dt>계약 정보</dt><dd>대표 선물 시세 · 계약월 미확인<br>현물 가격이 아닙니다.</dd>' : ''}</dl><form id="edit"><label for="group">나의 그룹</label><input id="group" maxlength="80" value="${escapeHTML(p.group || '')}" placeholder="예: 장기 관찰"><label for="mode">표시 가격</label><select id="mode"><option value="auto" ${p.mode !== 'manual' ? 'selected' : ''}>수집 가격 사용</option><option value="manual" ${p.mode === 'manual' ? 'selected' : ''}>수동 입력 사용</option></select><label for="manual-price">수동 가격</label><input id="manual-price" type="number" step="any" value="${numeric(p.manualPrice) ? p.manualPrice : ''}"><label for="low">관찰 가격 하단</label><input id="low" type="number" step="any" value="${numeric(p.low) ? p.low : ''}"><label for="high">관찰 가격 상단</label><input id="high" type="number" step="any" value="${numeric(p.high) ? p.high : ''}"><label for="note">투자 메모</label><textarea id="note" maxlength="5000" placeholder="관찰 이유와 체크할 내용을 기록하세요.">${escapeHTML(p.note || '')}</textarea><button class="save" type="submit">설정 저장</button><p class="hint">이 기기에만 저장됩니다. 다른 기기와 동기화되지 않습니다.<br>관찰 가격은 기록용이며 알림을 발송하지 않습니다.</p></form></div>`;
  $('close-detail').onclick = closeDetail;
  $('edit').onsubmit = event => {
    event.preventDefault();
    const read = id => $(id).value.trim() === '' ? null : Number($(id).value);
    const manualPrice = read('manual-price'), low = read('low'), high = read('high');
    if ([manualPrice, low, high].some(v => v !== null && !numeric(v))) return message('유효한 숫자를 입력해 주세요.');
    if ($('mode').value === 'manual' && manualPrice === null) return message('수동 모드에서는 가격을 입력해 주세요.');
    if (low !== null && high !== null && low > high) return message('하단은 상단보다 클 수 없습니다.');
    const next = { ...p, group: $('group').value, note: $('note').value, mode: $('mode').value, manualPrice, low, high };
    if (manualPrice !== p.manualPrice || !p.manualAt) next.manualAt = new Date().toISOString();
    settings.items[symbol] = next;
    if (persist()) { render(); openDetail(symbol); message('저장했습니다.'); }
  };
  render();
}
function closeDetail() { $('detail').classList.remove('open'); selected = null; $('detail').innerHTML = '<div class="empty-detail"><span>↗</span><h2>자산을 선택하세요</h2><p>가격 정보와 나만의 투자 메모를 확인하세요.</p></div>'; render(); }
async function load() {
  $('refresh').disabled = true;
  try {
    const response = await fetch(`./data/market.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const data = await response.json();
    if (!Array.isArray(data.assets) || !data.assets.every(a => typeof a.symbol === 'string' && typeof a.name === 'string' && types.includes(a.type))) throw new Error('잘못된 시세 파일');
    snapshot = data;
    const stale = !data.collected_at || Number.isNaN(Date.parse(data.collected_at)) || Date.now() - Date.parse(data.collected_at) > 90 * 60 * 1000;
    $('notice').classList.toggle('warning', !!data.demo || stale);
    $('notice').textContent = data.demo ? 'DEMO · 현재는 화면 확인용 가상 데이터입니다. 실제 투자 가격이 아닙니다. 자동 수집·배포는 아직 활성화되지 않았습니다.' : stale ? '마지막 수집 후 90분 이상 지났거나 시각을 확인할 수 없습니다. 시세 기준을 확인하세요. 새로고침은 배포된 JSON만 다시 읽습니다.' : '주기 수집 데이터 · 실시간이 아닐 수 있습니다. 새로고침은 마지막으로 배포된 데이터를 다시 읽습니다.';
    render(); if (selected) openDetail(selected);
  } catch (error) { $('notice').classList.add('warning'); $('notice').textContent = `데이터를 읽지 못했습니다. 기존 화면을 유지합니다. (${error.message})`; }
  finally { $('refresh').disabled = false; }
}
$('tabs').innerHTML = types.map((t,i) => `<button class="${i === 0 ? 'active' : ''}" data-tab="${t}" aria-pressed="${i === 0}">${t}</button>`).join('');
$('tabs').onclick = event => { const b = event.target.closest('[data-tab]'); if (!b) return; tab = b.dataset.tab; for (const el of $('tabs').children) { el.classList.toggle('active', el === b); el.setAttribute('aria-pressed', String(el === b)); } render(); };
$('rows').onclick = event => { const star = event.target.closest('[data-star]'); if (star) { const s = star.dataset.star; settings.items[s] = { ...prefs(s), favorite: !prefs(s).favorite }; persist(); render(); return; } const row = event.target.closest('[data-symbol]'); if (row) openDetail(row.dataset.symbol); };
$('rows').onkeydown = event => { if (event.target.matches('tr') && ['Enter', ' '].includes(event.key)) { event.preventDefault(); openDetail(event.target.dataset.symbol); } };
for (const id of ['search', 'favorites', 'sort']) $(id).addEventListener('input', render);
$('refresh').onclick = load;
$('message-close').onclick = () => $('message').close();
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !$('message').open) closeDetail(); });
$('export').onclick = () => { const url = URL.createObjectURL(new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = 'market-desk-private-backup.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
$('import').onclick = () => $('file').click();
$('file').onchange = async event => {
  const file = event.target.files[0]; if (!file) return;
  try { if (file.size > 2_000_000) throw new Error('파일은 2MB 이하여야 합니다.'); const parsed = JSON.parse(await file.text()); if (!validSettings(parsed)) throw new Error('지원하지 않거나 손상된 백업입니다.'); if (confirm('현재 개인 설정을 백업 내용으로 교체할까요?')) { settings = parsed; persist(); render(); if (selected) openDetail(selected); } }
  catch (error) { message(error.message); }
  finally { event.target.value = ''; }
};
load();

/* 세무법인 한백택스 — 특수관계 거래·증여 「추가 세부담 없는 가액」 (공용 모듈, 2026-10-12)
 * 쓰는 곳: 비상장주식 평가계산기(정밀 조서 4 · 조서 Ⅵ), 세무계산 포털·모바일의 비상장주식 평가조서 탭.
 * 계산·문구는 이 파일 하나만 고친다.
 *
 * 근거 (2026-10-12 K-Law MCP 원문 확인)
 *   특수관계 범위가 세법마다 다르다
 *     상증법: 령 §2의2 ① — 국기령 §1의2 ① 친족(4촌 혈족·3촌 인척·배우자 등) + 직계비속 배우자의 2촌 이내 혈족과 그 배우자(사돈), 사용인, 30% 출자법인 등
 *     소득세법: 령 §98 ① → 국기령 §1의2 ①·②·③ 1호 (사돈은 들어가지 않는다)
 *   매매  상증법 §35 ① · 령 §26 ② — 특수관계: 차액 ≥ min(시가 30%, 3억) 이면 「차액 − 기준금액」이 이익 본 사람의 증여재산가액 → 차액이 기준금액 이하면 0
 *         상증법 §35 ② · 령 §26 ③④ — 특수관계 아님: 정당한 사유 없이 차액 ≥ 시가 30% 이면 「차액 − 3억」 → 30% 미만이거나 3억 이하면 0
 *         소득세법 §101 ① · 령 §167 ③④ — 특수관계: 저가 양도·고가 매입으로 차액이 3억 이상이거나 시가 5% 이상이면 시가로 다시 계산 → 둘 다 미만이어야 안전
 *         시가는 상증법 평가액 준용(령 §167 ⑤, 평가기간 양도일 전후 3개월). 법인과의 거래로 법인세법 §52 시가에 해당하면 위 셋 모두 적용 안 함(상증법 §35 ③ · 소득령 §167 ⑥)
 *   증여  상증법 §53 — 10년 공제 한도: 배우자 6억 · 직계존속→ 5천만(미성년 2천만) · 직계비속→ 5천만 · 그 밖의 4촌 혈족·3촌 인척 1천만
 *         §53의2 — 직계존속에게서 혼인 전후 2년·출산 후 2년 이내 1억(평생 합계 1억, §53 공제와 별개)
 *   금액은 원 단위 정수: 「미만」 기준은 올림 − 1, 1주당 가격은 안쪽으로 올림·내림
 */
(function (root) {
'use strict';
var fl = function (x) { return Math.floor(x); };
var N = function (v) { var x = parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return isFinite(x) ? x : 0; };
var fmt = function (v) { return Math.round(v).toLocaleString('ko-KR'); };
var won = function (v) { return fmt(v) + '원'; };
var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

var REL = {
  spouse:   { l: '배우자', g: 1, i: 1, cap: 6e8, law: '§53 1호' },
  child:    { l: '자녀·손자녀 (성년)', g: 1, i: 1, cap: 5e7, mb: 1, law: '§53 2호' },
  minor:    { l: '자녀·손자녀 (미성년)', g: 1, i: 1, cap: 2e7, mb: 1, law: '§53 2호 단서' },
  parent:   { l: '부모·조부모 (자녀가 넘길 때)', g: 1, i: 1, cap: 5e7, law: '§53 3호' },
  relative: { l: '그 밖의 4촌 이내 혈족·3촌 이내 인척', g: 1, i: 1, cap: 1e7, law: '§53 4호' },
  inlaw:    { l: '사돈 (직계비속 배우자의 2촌 이내 혈족·그 배우자)', g: 1, i: 0, cap: 0, law: '상증령 §2의2 ① 1호 — 소득세법상 특수관계 아님' },
  staff:    { l: '임원·사용인', g: 1, i: 1, cap: 0, law: '상증령 §2의2 ① 2호 · 국기령 §1의2 ②' },
  corp:     { l: '30% 이상 출자 등 경영지배관계 법인', g: 1, i: 1, cap: 0, corp: 1, law: '상증령 §2의2 ① 6호 · 국기령 §1의2 ③·④' },
  none:     { l: '특수관계 없음 (제3자)', g: 0, i: 0, cap: 0, law: '' },
  manual:   { l: '직접 고름', g: null, i: null, cap: 0, law: '' }
};

/* o = {value(1주당 시가), n(주식 수), rel, gRel('y'/'n'), iRel, prior(10년 내 공제 사용액), mbUse, mbUsed, price(1주당 정한 값)} */
function plan(o) {
  var R = REL[o.rel] || REL.manual;
  var g = R.g == null ? o.gRel === 'y' : R.g === 1, i = R.i == null ? o.iRel === 'y' : R.i === 1;
  var n = o.n, v = fl(o.value), T = fl(v * n); if (!(T > 0 && n > 0)) return null;
  var gStd = g ? Math.min(fl(T * 0.3), 3e8) : 0;
  var gSafe = g ? gStd : Math.max(Math.ceil(T * 0.3) - 1, 3e8);            /* 증여세 0 이 되는 최대 차액 */
  var iSafe = i ? Math.min(Math.ceil(T * 0.05) - 1, 3e8 - 1) : Infinity;   /* 부당행위 대상이 아닌 최대 차액 */
  var band = function (d) { return { d: d, lo: Math.max(0, Math.ceil((T - d) / n)), hi: d === Infinity ? Infinity : fl((T + d) / n) }; };
  var both = Math.min(gSafe, iSafe);
  var capLeft = Math.max(0, R.cap - Math.max(0, N(o.prior)));
  var mbLeft = o.mbUse && R.mb ? Math.max(0, 1e8 - Math.max(0, N(o.mbUsed))) : 0;
  var free = capLeft + mbLeft;                                             /* 세금 없이 받을 수 있는 증여재산가액 */
  var giftLowSafe = g && free > 0 ? gStd + free : gSafe;                    /* 싸게 살 때 공제까지 쓰면 */
  var d = { rel: o.rel, label: R.l, law: R.law, corp: !!R.corp, cap: R.cap, g: g, i: i, v: v, n: n, T: T, gStd: gStd,
    gift: band(gSafe), inc: i ? band(iSafe) : null, both: band(both),
    capLeft: capLeft, mbLeft: mbLeft, free: free, low2: band(Math.min(giftLowSafe, iSafe)), low2gift: band(giftLowSafe),
    freeShares: v > 0 ? fl(free / v) : 0 };
  d.freeVal = d.freeShares * v;
  var price = N(o.price);
  if (price > 0) {
    var P = fl(price * n), diff = Math.abs(P - T), low = P < T;
    var giftVal = g ? (diff >= gStd ? diff - gStd : 0) : (diff >= fl(T * 0.3) ? Math.max(0, diff - 3e8) : 0);
    d.price = { unit: price, P: P, diff: diff, low: low, giftVal: giftVal, giftTo: low ? 'buyer' : 'seller',
      incHit: i && diff > 0 && (diff >= 3e8 || diff >= fl(T * 0.05)),
      giftAfterDed: low && g ? Math.max(0, giftVal - free) : giftVal };
  }
  return d;
}

/* 증여세 산출세액 — 상증법 §26 (과세표준 1억 10% … 30억 초과 50%) */
function giftTax(b) {
  b = Math.max(0, fl(b));
  var T = [[1e8, 0.1, 0], [5e8, 0.2, 1e7], [10e8, 0.3, 6e7], [30e8, 0.4, 16e7], [Infinity, 0.5, 46e7]];
  for (var k = 0; k < T.length; k++) if (b <= T[k][0]) return fl(b * T[k][1] - T[k][2]);
  return 0;
}

/* 결과 HTML — 정밀 조서와 포털 탭이 같은 문구를 쓴다 */
function html(d) {
  if (!d) return '평가액과 주식 수가 나오면 가액을 보여 드립니다.';
  var per = function (v) { return v === Infinity ? '제한 없음' : won(v) + '/주'; }, rng = function (b) { return per(b.lo) + ' ~ ' + per(b.hi); };
  var yn = function (b) { return b ? '<b>예</b>' : '아니요'; };
  var h = '<div style="margin-bottom:6px">시가(평가액) ' + won(d.v) + ' × ' + fmt(d.n) + '주 = <b>' + won(d.T) + '</b> · 상대방: ' + esc(d.label) +
    '<br><small>특수관계 — 상증법 ' + yn(d.g) + ' · 소득세법 ' + yn(d.i) + (d.law ? ' (' + esc(d.law) + ')' : '') + '</small></div>';
  h += '<table class="mini hb-deal-t"><tr><th>구분</th><th>추가 세부담 없는 1주당 가격</th><th>근거</th></tr>';
  h += '<tr><td>증여세 (이익 본 사람)</td><td>' + rng(d.gift) + '<br><small>차액 ' + won(d.gift.d) + ' 이하</small></td><td><small>' + (d.g ? '상증법 §35 ① · 령 §26 ② — 시가 30%와 3억원 중 적은 금액' : '상증법 §35 ② · 령 §26 ③④ — 차액이 시가 30% 미만이거나 3억원 이하(정당한 사유가 있으면 미적용)') + '</small></td></tr>';
  h += '<tr><td>양도소득세 부당행위</td><td>' + (d.inc ? rng(d.inc) + '<br><small>차액 ' + won(d.inc.d) + ' 이하</small>' : '적용 없음') + '</td><td><small>' + (d.i ? '소득세법 §101 ① · 령 §167 ③ — 차액 3억원 이상 또는 시가 5% 이상이면 시가로 다시 계산' : '특수관계인이 아니면 적용하지 않음') + '</small></td></tr>';
  h += '<tr class="sum"><td><b>둘 다 피하는 매매가</b></td><td><b>' + rng(d.both) + '</b><br><small>총액 ' + won(d.both.lo * d.n) + ' ~ ' + (d.both.hi === Infinity ? '' : won(d.both.hi * d.n)) + '</small></td><td><small>낮게 팔면 파는 사람 양도세·사는 사람 증여세, 높게 팔면 파는 사람 증여세·사는 사람 취득가액 감액</small></td></tr>';
  if (d.g && d.free > 0) h += '<tr><td>증여재산공제까지 쓰면 (싸게 살 때)</td><td>' + per(d.low2gift.lo) + ' 이상이면 증여세 0' + (d.inc ? '<br><small>다만 양도세 부당행위 하한 ' + per(d.inc.lo) + '이 더 높아 실제 하한은 ' + per(d.low2.lo) + '</small>' : '') + '</td><td><small>이익(차액 − 기준금액)이 남은 공제 ' + won(d.free) + ' 안 — 상증법 §53' + (d.mbLeft ? '·§53의2' : '') + '. 공제를 쓰면 다음 증여 때 줄어듦</small></td></tr>';
  h += '</table>';
  h += '<div style="margin-top:8px"><b>증여로 넘길 때 — 세금 없이 줄 수 있는 몫</b>: ';
  if (d.free > 0) h += '남은 공제 ' + won(d.free) + (d.mbLeft ? ' (증여재산공제 ' + won(d.capLeft) + ' + 혼인·출산 ' + won(d.mbLeft) + ')' : '') + ' ÷ ' + per(d.v) + ' = <b>' + fmt(d.freeShares) + '주 · ' + won(d.freeVal) + '</b>';
  else h += d.g && d.cap > 0 ? '남은 증여재산공제가 없습니다(10년 합산 한도 소진).' : '이 관계에는 증여재산공제가 없어 1주라도 증여하면 증여세가 생깁니다.';
  if (d.free > 0 && d.n > d.freeShares) { var base = Math.max(0, d.T - d.free); h += '<br><small>' + fmt(d.n) + '주를 모두 증여하면 과세표준 ' + won(base) + ' → 산출세액 약 ' + won(giftTax(base)) + ' (신고세액공제·세대생략 할증·합산 증여 전 — 증여세 계산기로 확인)</small>'; }
  h += '</div>';
  if (d.price) {
    var p = d.price;
    h += '<div style="margin-top:8px;padding-top:8px;border-top:1px dashed #DCE5F0">정한 매매가 ' + per(p.unit) + ' × ' + fmt(d.n) + '주 = ' + won(p.P) + ' — 시가보다 ' + (p.low ? '낮음' : p.diff ? '높음' : '같음') + (p.diff ? ', 차액 ' + won(p.diff) : '') + '<br>';
    h += p.giftVal > 0 ? '→ <b style="color:#b42318">증여세 과세</b>: ' + (p.giftTo === 'buyer' ? '사는 사람' : '파는 사람') + '의 증여재산가액 <b>' + won(p.giftVal) + '</b>' + (p.low && d.g && d.free > 0 ? ' — 남은 공제 차감 후 ' + won(p.giftAfterDed) : '') : '→ 증여세 문제 없음';
    if (d.i) h += '<br>' + (p.incHit ? '→ <b style="color:#b42318">양도소득세 부당행위계산</b>: ' + (p.low ? '파는 사람의 양도가액을 시가 ' + won(d.T) + '으로 다시 계산' : '사는 사람의 취득가액을 시가로 계산(나중에 팔 때 양도차익 증가)') : '→ 양도소득세 부당행위계산 대상 아님');
    h += '</div>';
  }
  h += '<p class="note" style="margin-top:8px">' + (d.corp ? '<b>법인과의 거래</b>: 대가가 법인세법 §52 ② 시가에 해당해 법인세 부당행위계산이 적용되지 않으면 상증법 §35·소득세법 §101 도 적용하지 않습니다(상증법 §35 ③ · 소득령 §167 ⑥). 법인 쪽은 법인세법 시행령 §88 ③(시가 5%·3억원)도 함께 봅니다. ' : '') +
    '양도소득세의 시가는 상증법 평가액을 쓰되 평가기간이 양도일 전후 3개월입니다(소득령 §167 ⑤). 시가와 같은 값에 팔아도 양도차익에 대한 양도소득세(증권거래세 포함)는 따로 생깁니다.</p>';
  return h;
}

/* 포털·모바일 탭용 — 입력 칸과 결과를 한 상자에 그리고, 평가액이 바뀔 때마다 update 로 다시 계산한다.
 * 입력은 이 화면 안에서만 쓰고 기기에 저장하지 않는다(업체 자료). 계산 시작 게이트 밖(data-nogate)에서 바로 반영한다. */
var BOXES = {};
function mount(id) {
  var el = typeof id === 'string' ? document.getElementById(id) : id; if (!el) return null;
  if (BOXES[el.id]) return BOXES[el.id];
  el.setAttribute('data-nogate', '1');
  var opts = Object.keys(REL).map(function (k) { return '<option value="' + k + '"' + (k === 'child' ? ' selected' : '') + '>' + esc(REL[k].l) + '</option>'; }).join('');
  var f = function (lab, inner, cls) { return '<div class="hb-deal-r' + (cls ? ' ' + cls : '') + '"><label>' + lab + '</label>' + inner + '</div>'; };
  el.innerHTML = '<style>' +
    '.hb-deal{border:1px solid #DCE5F0;border-top:4px solid #C8963E;border-radius:12px;padding:14px 16px;background:#fff;margin:14px 0;font-size:14px;color:#0F2440}' +
    '.hb-deal h4{margin:0 0 4px;color:#1B3A5C;font-size:16px}.hb-deal .sub{color:#35507A;font-size:12.5px;margin-bottom:10px}' +
    '.hb-deal-g{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:8px 14px;margin-bottom:10px}' +
    '.hb-deal-r{display:flex;flex-direction:column;gap:4px}.hb-deal-r label{font-size:12.5px;font-weight:700;color:#35507A}' +
    '.hb-deal-r input,.hb-deal-r select{font:inherit;padding:7px 9px;border:1px solid #CBD5E0;border-radius:8px;min-width:0}' +
    '.hb-deal-r input[type=number]{text-align:right}.hb-deal-c{display:flex;gap:6px;align-items:center;font-size:13px}' +
    '.hb-deal-out{border:1px solid #DCE5F0;border-radius:10px;padding:10px 12px;background:#FAFBFD;overflow-x:auto}' +
    '.hb-deal-t{width:100%;border-collapse:collapse;font-size:13px;min-width:520px}.hb-deal-t th,.hb-deal-t td{border:1px solid #DCE5F0;padding:6px 8px;text-align:left;vertical-align:top}' +
    '.hb-deal-t th{background:#E9F0F8;text-align:center}.hb-deal-t tr.sum td{background:#FBF3E4}.hb-deal .note{font-size:12.5px;color:#35507A}' +
    '</style><div class="hb-deal"><h4>🤝 특수관계 거래·증여 — 추가 세부담 없는 가액</h4>' +
    '<div class="sub">상증법과 소득세법의 특수관계를 따로 판정해, 증여세·양도소득세 부당행위계산이 생기지 않는 매매가와 세금 없이 증여할 수 있는 주식 수를 보여 드립니다. 위 평가액이 바뀌면 함께 다시 계산합니다.</div>' +
    '<div class="hb-deal-g">' +
    f('상대방(사는·받는 사람)은 넘기는 사람의', '<select data-d="rel">' + opts + '</select>') +
    f('상증법상 특수관계인', '<select data-d="gRel"><option value="y">예</option><option value="n">아니요</option></select>', 'hb-deal-man') +
    f('소득세법상 특수관계인', '<select data-d="iRel"><option value="y">예</option><option value="n">아니요</option></select>', 'hb-deal-man') +
    f('넘길 주식 수 (비우면 평가대상 주식수)', '<input type="number" data-d="n" inputmode="numeric">') +
    f('정한 매매가 (1주당, 선택)', '<input type="number" data-d="price" inputmode="numeric">') +
    f('10년 안에 같은 관계에서 이미 공제받은 금액', '<input type="number" data-d="prior" inputmode="numeric">') +
    f('혼인·출산공제 이미 받은 금액 (평생 1억)', '<input type="number" data-d="mbUsed" inputmode="numeric">') +
    '<div class="hb-deal-c"><input type="checkbox" data-d="mbUse" id="' + el.id + '_mb"><label for="' + el.id + '_mb">혼인·출산 증여재산공제 1억원 적용 (상증법 §53의2)</label></div>' +
    '</div><div class="hb-deal-out"></div></div>';
  var box = { el: el, last: null };
  var q = function (k) { return el.querySelector('[data-d="' + k + '"]'); };
  box.read = function () { return { rel: q('rel').value, gRel: q('gRel').value, iRel: q('iRel').value, n: N(q('n').value), price: N(q('price').value), prior: N(q('prior').value), mbUsed: N(q('mbUsed').value), mbUse: q('mbUse').checked }; };
  box.draw = function () {
    var s = box.read();
    [].forEach.call(el.querySelectorAll('.hb-deal-man'), function (x) { x.style.display = s.rel === 'manual' ? '' : 'none'; });
    var base = box.last || { value: 0, n: 0 };
    var d = base.value > 0 ? plan({ value: base.value, n: s.n > 0 ? s.n : base.n, rel: s.rel, gRel: s.gRel, iRel: s.iRel, prior: s.prior, mbUse: s.mbUse, mbUsed: s.mbUsed, price: s.price }) : null;
    el.querySelector('.hb-deal-out').innerHTML = html(d);
    return d;
  };
  el.addEventListener('input', box.draw); el.addEventListener('change', box.draw);
  BOXES[el.id] = box;
  return box;
}
function update(id, base) { var b = mount(id); if (!b) return null; b.last = { value: N(base && base.value), n: N(base && base.n) }; return b.draw(); }
function clear(id) { var b = BOXES[id]; if (!b) return; [].forEach.call(b.el.querySelectorAll('[data-d]'), function (x) { if (x.type === 'checkbox') x.checked = false; else if (x.tagName === 'SELECT') x.value = x.getAttribute('data-d') === 'rel' ? 'child' : 'y'; else x.value = ''; }); b.draw(); }

var API = { REL: REL, plan: plan, html: html, giftTax: giftTax, mount: mount, update: update, clear: clear };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
root.HB_DEAL = API;
})(typeof window !== 'undefined' ? window : globalThis);

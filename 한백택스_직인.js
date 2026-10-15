/* 세무법인 한백택스 — 한백 직인 자리 공용 모듈 (청구서 작성기 · 세무대리 약정서 · CMS 자동이체 신청서)
 *
 * 직인 이미지는 이 파일에 없다. 중계(메일중계 Apps Script)에서 임직원이 날인할 때만 내려온다.
 * 직인 자리는 세 문서가 같다: 「세무법인 한백택스 / 대표세무사 ○○○ (인)」
 *   - 지름 20mm. 날인 전에는 같은 크기 칸에 회색 (인) — 날인 전후로 줄이 밀리지 않는다.
 *   - 날인 후에는 이름 끝에 5mm 겹쳐 찍고(관행), 곱하기 혼합으로 아래 글자가 비친다. 인쇄·PDF 에서도 빨간색 유지.
 *   - 아래에 날인번호 · 시각 · 담당 · 진위 확인 전화 한 줄.
 * 업체에게 가는 JSON·저장 JSON 에는 직인 이미지와 내용 지문을 넣지 않는다(HBSeal.strip) — 업체가 금액을 고치고 직인을 되살리지 못하게.
 * 불러온 JSON 에서도 같은 함수로 뺀다. 직인은 사무소가 다시 날인해야 찍힌다. */
(function () {
  var CSS =
    '.hbseal{display:inline-flex;flex-direction:column;align-items:flex-start;gap:1pt;break-inside:avoid;page-break-inside:avoid;text-align:left}' +
    '.hbseal-co{font-weight:800;color:#1B3A5C}' +
    '.hbseal-rep{display:inline-flex;align-items:center;white-space:nowrap;vertical-align:middle}' +
    '.hbseal-mark{position:relative;display:inline-flex;align-items:center;justify-content:center;width:20mm;height:20mm;flex:0 0 20mm;color:#888;font-size:11pt;margin-left:2mm}' +
    '.hbseal-mark.on{margin-left:-5mm}' +
    '.hbseal-mark img{position:absolute;left:0;top:0;width:20mm;height:20mm;object-fit:contain;mix-blend-mode:multiply;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
    '.hbseal-meta{font-size:9pt;color:#444;line-height:1.45}';
  function inject() {
    if (document.getElementById('hbseal-css')) return;
    var s = document.createElement('style'); s.id = 'hbseal-css'; s.textContent = CSS; document.head.appendChild(s);
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function okSrc(src) { return /^data:image\/(png|jpe?g|gif|webp);base64,/.test(src || ''); }
  /* 직인 칸 하나 — src 가 직인 이미지면 찍고, 아니면 (인) */
  function mark(src, cls) {
    inject();
    var on = okSrc(src);
    return '<span class="hbseal-mark' + (on ? ' on' : '') + (cls ? ' ' + cls : '') + '">' + (on ? '<img alt="직인" src="' + src + '">' : '(인)') + '</span>';
  }
  /* 날인 기록 한 줄 — conf {no, at, by} */
  function meta(conf, label) {
    if (!conf || !conf.no) return '';
    return '<div class="hbseal-meta">' + (label || '날인번호') + ' ' + esc(conf.no) + (conf.at ? ' · ' + esc(conf.at) : '') + (conf.by ? ' · 담당 ' + esc(conf.by) : '') +
      '<br>진위 확인: 세무법인 한백택스 02-2277-3101</div>';
  }
  /* 묶음 — 상호 / 직함·성명 (인) / 날인 기록.  o {office, rep, ok, seal, conf, label, cls} */
  function block(o) {
    o = o || {};
    inject();
    return '<div class="hbseal"><div class="hbseal-co">' + esc(o.office || '세무법인 한백택스') + '</div>' +
      '<div class="hbseal-rep"><span>' + esc(o.rep || '대표세무사') + '</span>' + mark(o.ok ? o.seal : '', o.cls) + '</div>' +
      (o.ok ? meta(o.conf, o.label) : '') + '</div>';
  }
  /* 표 칸 안 — 성명 (인).  o {rep, ok, seal, cls} */
  function inline(o) {
    o = o || {};
    return '<span class="hbseal-rep"><span>' + esc(o.rep || '') + '</span>' + mark(o.ok ? o.seal : '', o.cls) + '</span>';
  }
  /* JSON 으로 내보내거나 불러올 때 — 모든 confirm 에서 직인 이미지(seal)와 내용 지문(key)을 뺀다. 날인번호·시각·담당은 남긴다 */
  function strip(obj) {
    var c = JSON.parse(JSON.stringify(obj == null ? null : obj));
    (function walk(x) {
      if (!x || typeof x !== 'object') return;
      if (x.confirm && typeof x.confirm === 'object') { delete x.confirm.seal; delete x.confirm.key; }
      Object.keys(x).forEach(function (k) { walk(x[k]); });
    })(c);
    return c;
  }
  window.HBSeal = { block: block, inline: inline, mark: mark, meta: meta, strip: strip, css: CSS };
})();

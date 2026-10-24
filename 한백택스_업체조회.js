/* 세무법인 한백택스 · 업체 조회 공용 모듈 (첫 화면·포털·모바일의 form.hb-bizq)
 *
 * ① 사업자등록번호 10자리
 *    - 공공데이터포털 인증키가 있으면: 국세청 사업자등록 상태조회 API 로 계속·휴업·폐업, 과세유형, 폐업일을 화면에 바로 표시
 *      (공공데이터포털 15081808 「국세청_사업자등록정보 진위확인 및 상태조회 서비스」,
 *       POST https://api.odcloud.kr/api/nts-businessman/v1/status?serviceKey=… body {"b_no":["…"]}, CORS 허용 — 2026-10-24 확인)
 *      업태·종목은 이 API 에 없으므로 비즈노 상세 화면 연결을 함께 둔다.
 *    - 키가 없으면: 비즈노 상세(https://bizno.net/article/번호)를 새 창으로 연다.
 *    - 검증번호(끝자리)가 틀리면 경고한다(조회는 그대로).
 * ② 상호·법인등록번호 → 비즈노 검색(GET https://bizno.net/?area=&query=) 새 창. 비즈노 자료는 긁어 오지 않는다(비즈노 고지: DB 무단 수집 금지).
 *
 * 인증키 — 공개 사이트 파일에 넣지 않는다. 읽는 순서:
 *   ① hb-datakey.local.js 의 window.HB_DATA_KEY (*.local.js 는 .gitignore — 사무실 PC·서버 전용)
 *   ② 이 브라우저에 저장한 값(localStorage hb_data_key) — 칸 아래 「🔑 국세청 상태조회 키」로 넣는다
 *   일반 인증키는 Encoding(%2F·%3D 섞임)·Decoding 어느 쪽을 넣어도 된다.
 */
(function () {
  var LS = 'hb_data_key';
  var NTS = 'https://api.odcloud.kr/api/nts-businessman/v1/status';

  function getKey() {
    var k = (window.HB_DATA_KEY || '').trim();
    if (k) return { key: k, from: 'file' };
    try { k = (localStorage.getItem(LS) || '').trim(); } catch (e) { k = ''; }
    return k ? { key: k, from: 'browser' } : null;
  }
  function setKey(k) { try { if (k) localStorage.setItem(LS, k); else localStorage.removeItem(LS); } catch (e) {} }
  function encKey(k) { return /%[0-9A-Fa-f]{2}/.test(k) ? k : encodeURIComponent(k); }

  function bizOk(d) {
    var w = [1, 3, 7, 1, 3, 7, 1, 3, 5], s = 0, i;
    for (i = 0; i < 9; i++) s += (+d[i]) * w[i];
    s += Math.floor((+d[8]) * 5 / 10);
    return ((10 - s % 10) % 10) === +d[9];
  }
  function fmtNo(d) { return d.slice(0, 3) + '-' + d.slice(3, 5) + '-' + d.slice(5); }
  function fmtDt(s) { return /^\d{8}$/.test(s || '') ? s.slice(0, 4) + '.' + s.slice(4, 6) + '.' + s.slice(6) + '.' : ''; }
  function el(tag, css, text) { var e = document.createElement(tag); if (css) e.style.cssText = css; if (text != null) e.textContent = text; return e; }

  /* 폼마다 결과 상자·키 설정 줄을 붙인다 */
  function setup(f) {
    if (f._hbBizq) return; f._hbBizq = true;
    var box = el('div', 'flex:1 1 100%;display:none;font-size:13.5px;line-height:1.6;padding:8px 10px;border-radius:8px;background:var(--card-2,#F7FAFD);border:1px solid var(--border,#DCE3EC)');
    box.className = 'hb-bizq-out'; box.setAttribute('aria-live', 'polite');
    var bar = el('div', 'flex:1 1 100%;display:flex;flex-wrap:wrap;align-items:center;gap:6px;font-size:12px;color:var(--gray,#6B7A8C)');
    bar.className = 'hb-bizq-keybar';
    var st = el('span'); st.className = 'hb-bizq-keyst';
    var tg = el('button', 'border:1px solid var(--border,#DCE3EC);background:transparent;color:inherit;border-radius:6px;padding:2px 8px;font-size:12px;cursor:pointer', '🔑 국세청 상태조회 키');
    tg.type = 'button'; tg.className = 'hb-bizq-keybtn';
    var pane = el('span', 'display:none;flex:1 1 100%;gap:6px;flex-wrap:wrap;align-items:center');
    pane.className = 'hb-bizq-keypane';
    var inp = el('input', 'flex:1 1 220px;min-width:0;height:30px;padding:0 8px;border:1px solid var(--border,#DCE3EC);border-radius:6px;font-size:13px;background:var(--card,#fff);color:inherit');
    inp.type = 'password'; inp.autocomplete = 'off'; inp.placeholder = '공공데이터포털 일반 인증키'; inp.setAttribute('aria-label', '공공데이터포털 일반 인증키');
    var sv = el('button', 'height:30px;padding:0 10px;border:0;border-radius:6px;background:var(--navy,#1B3A5C);color:#fff;font-size:12px;cursor:pointer', '이 브라우저에 저장'); sv.type = 'button';
    var rm = el('button', 'height:30px;padding:0 10px;border:1px solid var(--border,#DCE3EC);border-radius:6px;background:transparent;color:inherit;font-size:12px;cursor:pointer', '지우기'); rm.type = 'button';
    var help = el('span', 'flex:1 1 100%', '공공데이터포털(data.go.kr)에서 「국세청_사업자등록정보 진위확인 및 상태조회 서비스」를 활용신청하면 받는 일반 인증키입니다. 이 브라우저에만 저장되고 사이트 파일에는 들어가지 않습니다.');
    pane.appendChild(inp); pane.appendChild(sv); pane.appendChild(rm); pane.appendChild(help);
    bar.appendChild(st); bar.appendChild(tg); bar.appendChild(pane);
    var msg = f.querySelector('.hb-bizq-msg');
    f.insertBefore(box, msg); f.appendChild(bar);
    function paint() {
      var k = getKey();
      st.textContent = k ? (k.from === 'file' ? '국세청 상태조회 켜짐(사무실 키 파일)' : '국세청 상태조회 켜짐(이 브라우저)') : '국세청 상태조회 꺼짐 — 키를 넣으면 휴·폐업·과세유형이 바로 나옵니다';
      rm.style.display = k && k.from === 'browser' ? '' : 'none';
    }
    tg.onclick = function () { pane.style.display = pane.style.display === 'none' ? 'flex' : 'none'; if (pane.style.display !== 'none') inp.focus(); };
    sv.onclick = function () { var v = inp.value.trim(); if (!v) return; setKey(v); inp.value = ''; pane.style.display = 'none'; repaint(); };
    rm.onclick = function () { setKey(''); repaint(); };
    f._hbPaint = paint;
    paint();
  }
  function repaint() { var fs = document.querySelectorAll('form.hb-bizq'); for (var i = 0; i < fs.length; i++) if (fs[i]._hbPaint) fs[i]._hbPaint(); }

  function show(f, nodes, tone) {
    var box = f.querySelector('.hb-bizq-out');
    box.textContent = '';
    nodes.forEach(function (n) { box.appendChild(typeof n === 'string' ? document.createTextNode(n) : n); });
    box.style.display = nodes.length ? 'block' : 'none';
    box.style.borderColor = tone === 'bad' ? '#B42318' : tone === 'warn' ? '#C8963E' : '';
  }
  function biznoLink(d, label) {
    var a = el('a', 'color:var(--blue,#2F5D8A);font-weight:700', label || '업태·종목·주소는 비즈노에서 보기 ↗');
    a.href = 'https://bizno.net/article/' + d; a.target = '_blank'; a.rel = 'noopener';
    return a;
  }

  function lookup(f, d, key) {
    show(f, ['국세청에 조회 중…']);
    var url = NTS + '?serviceKey=' + encKey(key) + '&returnType=JSON';
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify({ b_no: [d] }) })
      .then(function (r) { return r.json().then(function (j) { return { http: r.status, j: j }; }, function () { return { http: r.status, j: null }; }); })
      .then(function (res) {
        var j = res.j || {};
        if (res.http === 401 || j.code === -4 || j.code === -401) {
          show(f, ['국세청 조회 실패: 인증키가 등록되지 않았거나 잘못되었습니다(' + (j.msg || 'HTTP ' + res.http) + '). 공공데이터포털에서 이 서비스를 활용신청했는지, 키를 정확히 넣었는지 확인하십시오. ', biznoLink(d, '비즈노에서 보기 ↗')], 'bad');
          return;
        }
        var row = j.data && j.data[0];
        if (!row) { show(f, ['국세청 조회 실패(' + (j.msg || 'HTTP ' + res.http) + '). ', biznoLink(d, '비즈노에서 보기 ↗')], 'bad'); return; }
        var code = row.b_stt_cd || '';
        var head = el('b', 'color:' + (code === '01' ? '#067647' : code === '02' ? '#B54708' : '#B42318'),
          fmtNo(d) + ' — ' + (row.b_stt || (code ? '' : '국세청 미등록')));
        var lines = [head, el('br')];
        lines.push('과세유형: ' + (row.tax_type || '-'));
        if (row.end_dt) lines.push(' · 폐업일 ' + fmtDt(row.end_dt));
        if (row.tax_type_change_dt) lines.push(' · 최근 과세유형 전환 ' + fmtDt(row.tax_type_change_dt));
        if (row.rbf_tax_type && row.rbf_tax_type_cd !== '99') lines.push(' (직전 ' + row.rbf_tax_type + ')');
        lines.push(el('br'));
        lines.push(el('small', 'color:var(--gray,#6B7A8C)', '출처: 국세청 사업자등록 상태조회(공공데이터포털) · '));
        lines.push(biznoLink(d));
        show(f, lines, code === '01' ? '' : code ? 'warn' : 'bad');
      })
      .catch(function (e) {
        show(f, ['국세청에 연결하지 못했습니다(' + (e && e.message || '네트워크') + '). ', biznoLink(d, '비즈노에서 보기 ↗')], 'bad');
      });
  }

  window.hbBizq = function (f) {
    setup(f);
    var q = (f.query.value || '').trim(), d = q.replace(/[\s-]/g, ''), msg = f.querySelector('.hb-bizq-msg');
    if (!q) return false;
    if (msg) { if (!msg.dataset.base) msg.dataset.base = msg.textContent; msg.textContent = msg.dataset.base; msg.style.color = ''; }
    show(f, []);
    if (/^\d{10}$/.test(d)) {
      var ok = bizOk(d);
      if (msg && !ok) { msg.textContent = '⚠ ' + fmtNo(d) + ' 은 사업자등록번호 검증번호(끝자리)가 맞지 않습니다. 번호를 다시 확인하십시오.'; msg.style.color = '#B42318'; }
      var k = getKey();
      if (k) { f._hbLast = lookup(f, d, k.key); return false; }
      if (msg && ok) msg.textContent = '사업자등록번호 ' + fmtNo(d) + ' 상세 화면을 새 창으로 열었습니다.';
      window.open('https://bizno.net/article/' + d, '_blank', 'noopener');
      return false;
    }
    return true;
  };
  window.hbBizqKey = { get: getKey, set: function (k) { setKey(k); repaint(); } };

  function init() { var fs = document.querySelectorAll('form.hb-bizq'); for (var i = 0; i < fs.length; i++) setup(fs[i]); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

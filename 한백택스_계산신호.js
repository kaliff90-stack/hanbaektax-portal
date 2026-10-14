/* 한백택스 계산 신호 — 계산이 돌아가고 있다는 것을 시계 모양으로 보여 준다 (포털 전체 공용, 2026-10-12)
 *
 * 언제 보이나
 *   ① 「계산 시작」(공통 게이트)·「계산하기」·「평가」·「조회」 등 계산 단추를 누를 때 → 「계산 중…」 잠깐 → 「✓ 계산 완료」
 *   ② 값을 넣는 즉시 다시 계산하는 계산기에서 입력칸을 바꿀 때 → 「계산 중…」 → 「✓ 계산됨」
 *      (계산 시작 게이트가 있는 계산기는 입력만으로 계산하지 않으므로 ① 만)
 *   ③ 오래 걸리는 작업(서류 OCR 등)은 앱이 hbBusy(true,'서류 읽는 중…') … hbBusy(false) 로 감싸면 그동안 시계가 계속 돈다
 *   ④ 파일을 고르거나 끌어 놓으면(엑셀·PDF·JSON·사진 등 자료 올리기) → 「자료 읽는 중…」, 화면 갱신이 멈추면 「✓ 자료 읽기 완료」
 *      앱이 곧이어 hbBusy(true) 를 부르면 그쪽이 끝날 때까지 계속 돈다(OCR 처럼 쪽마다 시간이 걸리는 작업)
 *   계산이 없는 화면(업무판 등)은 data-hb-signal="files" 로 붙여 ④ 만 쓴다
 *
 * 붙이는 법: <script src="한백택스_계산신호.js" defer></script> (생성기: 02-도구 & 스크립트/Python 스크립트/계산신호_주입.py)
 * Shadow DOM 안에 그려 계산기 화면의 CSS 와 섞이지 않는다. 인쇄에는 나오지 않는다.
 */
(function () {
  'use strict';
  if (window.hbBusy) return;
  var host, box, txt, hideT, runT, busyN = 0, autoT = 0;
  var FILES_ONLY = !!(document.currentScript && document.currentScript.getAttribute('data-hb-signal') === 'files');
  var CALC_BTN = /계산|평가|산출|시산|판정|진단|조회|추정|분석/;
  var NOT_CALC = /복사|저장|인쇄|출력|초기화|지우기|다운로드|내려받기|닫기|취소|삭제|불러오기|붙여넣기/;

  function build() {
    if (host) return;
    host = document.createElement('div');
    host.id = 'hbSignal';
    host.setAttribute('data-nogate', '1');
    var inFrame = window.self !== window.top;
    host.style.cssText = 'position:fixed;left:50%;top:' + (inFrame ? 10 : 52) + 'px;transform:translateX(-50%);z-index:2147483600;pointer-events:none;margin:0;padding:0';
    var sh = host.attachShadow({ mode: 'open' });
    sh.innerHTML =
      '<style>' +
      ':host{all:initial}' +
      '.b{display:flex;align-items:center;gap:9px;padding:8px 16px 8px 10px;border-radius:999px;background:rgba(27,58,92,.96);color:#fff;' +
        'font:800 14px "Nanum Gothic","맑은 고딕","Malgun Gothic",sans-serif;box-shadow:0 6px 20px rgba(15,36,64,.28);' +
        'opacity:0;transform:translateY(-8px);transition:opacity .18s,transform .18s,background .2s;white-space:nowrap}' +
      '.b.on{opacity:1;transform:none}' +
      '.b.ok{background:rgba(30,125,78,.96)}' +
      '.clk{position:relative;width:22px;height:22px;border:2.5px solid #C8963E;border-radius:50%;box-sizing:border-box;flex:none;background:#fff1}' +
      '.clk i{position:absolute;left:50%;top:50%;width:2.5px;margin-left:-1.25px;border-radius:2px;background:#fff;transform-origin:50% 0}' +
      '.clk .m{height:8px;animation:r .9s linear infinite}' +
      '.clk .h{height:5px;animation:r 7s linear infinite}' +
      '.clk .c{display:none}' +
      '.b.ok .clk{border-color:#fff}' +
      '.b.ok .clk i{display:none}' +
      '.b.ok .clk .c{display:block;position:absolute;left:5px;top:2px;width:6px;height:10px;border:solid #fff;border-width:0 2.5px 2.5px 0;transform:rotate(45deg);background:none;animation:none;margin:0}' +
      '@keyframes r{from{transform:rotate(180deg)}to{transform:rotate(540deg)}}' +
      '@media print{.b{display:none}}' +
      '</style>' +
      '<div class="b" role="status" aria-live="polite"><span class="clk"><i class="h"></i><i class="m"></i><b class="c"></b></span><span class="t"></span></div>';
    (document.body || document.documentElement).appendChild(host);
    box = sh.querySelector('.b');
    txt = sh.querySelector('.t');
  }
  function show(label) {
    build();
    clearTimeout(hideT);
    box.className = 'b on';
    txt.textContent = label || '계산 중…';
  }
  function done(label) {
    if (!host || busyN > 0) return;
    box.className = 'b on ok';
    txt.textContent = label || '계산 완료';
    clearTimeout(hideT);
    hideT = setTimeout(function () { box.className = 'b'; }, 1100);
  }
  /* 계산 단추: 최소 0.6초는 돌고 끝낸다(너무 빨리 끝나면 계산했는지 알 수 없다) */
  function pulse(label, ms, doneLabel) {
    show(label);
    clearTimeout(runT);
    runT = setTimeout(function () { done(doneLabel); }, ms || 650);
  }
  /* 앱이 긴 작업을 감쌀 때 */
  window.hbBusy = function (on, label) {
    if (on) { busyN++; clearTimeout(runT); stopAuto(); show(label || '처리 중…'); }
    else { busyN = Math.max(0, busyN - 1); if (!busyN) done(label || '완료'); }
  };
  window.hbCalcPulse = pulse;

  /* ④ 자료 올리기 — 파일 선택·끌어 놓기. 읽는 동안 화면이 계속 바뀌므로, 바뀜이 1초 멈추면 끝난 것으로 본다(최대 3분) */
  var mo, lastMut = 0, autoStart = 0;
  function stopAuto() { if (autoT) { clearInterval(autoT); autoT = 0; } if (mo) mo.disconnect(); }
  function autoRead() {
    if (busyN > 0) return;
    stopAuto(); clearTimeout(runT);
    show('자료 읽는 중…');
    autoStart = lastMut = Date.now();
    if (window.MutationObserver) {
      mo = mo || new MutationObserver(function (l) { for (var k = 0; k < l.length; k++) if (!host || (l[k].target !== host && !host.contains(l[k].target))) { lastMut = Date.now(); return; } });
      mo.observe(document.body || document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true });
    }
    autoT = setInterval(function () {
      if (busyN > 0) { stopAuto(); return; }            /* 앱이 직접 감쌌다 — 그쪽이 끝낼 때까지 */
      var now = Date.now();
      if ((now - autoStart >= 700 && now - lastMut >= 1000) || now - autoStart > 180000) { stopAuto(); done('자료 읽기 완료'); }
    }, 200);
  }
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el && el.tagName === 'INPUT' && (el.type || '').toLowerCase() === 'file' && el.files && el.files.length) autoRead();
  }, true);
  document.addEventListener('drop', function (e) {
    var dt = e.dataTransfer;
    if (dt && dt.files && dt.files.length) autoRead();
  }, true);

  if (FILES_ONLY) return;

  /* ① 계산 단추 */
  document.addEventListener('click', function (e) {
    var t = e.target;
    var b = t && t.closest && t.closest('button,input[type=button],input[type=submit],a[role=button],.btn');
    if (!b || (b.closest && b.closest('[data-nosignal],#hbHome'))) return;
    var s = (b.textContent || b.value || '').replace(/\s/g, '');
    if (b.id === 'hbCalcGo' || (CALC_BTN.test(s) && !NOT_CALC.test(s))) pulse('계산 중…');
  }, true);

  /* ② 입력 즉시 계산하는 계산기 */
  var deb;
  function onEdit(e) {
    if (window.__hbCalcGate) return;                 /* 게이트가 있으면 「계산 시작」 때만 신호 */
    var el = e.target;
    if (!el || !/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) return;
    var ty = (el.type || '').toLowerCase();
    if (ty === 'file' || ty === 'search' || ty === 'password') return;
    if (el.closest && el.closest('[data-nosignal],.hb-consult,.hbc-wrap,.consult-widget,#hbHome,form[data-nosignal]')) return;
    if (busyN > 0) return;
    show('계산 중…');
    clearTimeout(deb);
    deb = setTimeout(function () { done('계산됨'); }, 450);
  }
  document.addEventListener('input', onEdit, true);
  document.addEventListener('change', onEdit, true);
})();

/* 새 버전 알림 — 화면을 연 뒤 이 페이지가 다시 배포되면 하단 팝업으로 알린다 (2026-10-14)
 *   페이지 파일의 ETag(없으면 Last-Modified)를 처음 열 때 기억해 두고, 5분마다·창으로 돌아올 때 다시 확인한다.
 *   바뀌었으면 하단에 「새 버전이 나왔습니다」 팝업 + 탭 제목 앞에 「(새 버전)」. 「새 버전으로 열기」를 누르면 새로고침.
 *   HEAD 요청이라 서비스 워커를 거치지 않고, 본문을 받지 않는다. 파일로 연 화면(file:)·포털 안 iframe 에서는 돌지 않는다
 *   (포털 첫 화면은 자체 새로고침 단추가 있다). 인쇄에는 나오지 않는다.
 */
(function () {
  'use strict';
  if (window.hbUpdateCheck || !/^https?:$/.test(location.protocol) || window.self !== window.top) return;
  window.hbUpdateCheck = { now: function () { last = 0; laterUntil = 0; return check(); } };   /* 시험용: 바로 확인 */
  var base = null, last = 0, shown = false, laterUntil = 0, title0 = document.title;
  var EVERY = 5 * 60 * 1000;

  function stampOf() {
    return fetch(location.pathname, { method: 'HEAD', cache: 'no-store', credentials: 'same-origin' })
      .then(function (r) { return r.ok ? (r.headers.get('etag') || r.headers.get('last-modified') || '') : ''; })
      .catch(function () { return ''; });
  }
  function check() {
    if (shown || document.hidden || Date.now() - last < 60 * 1000) return Promise.resolve();
    last = Date.now();
    return stampOf().then(function (s) {
      if (!s) return;
      if (base === null) { base = s; return; }
      if (s !== base && Date.now() >= laterUntil) popup();
    });
  }
  function popup() {
    shown = true;
    if (document.title.indexOf('(새 버전)') !== 0) document.title = '(새 버전) ' + title0;
    var host = document.createElement('div');
    host.id = 'hbUpdate';
    host.setAttribute('data-nogate', '1'); host.setAttribute('data-nosignal', '1');
    host.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:2147483601;width:min(560px,calc(100vw - 32px));margin:0;padding:0';
    var ps = document.createElement('style');
    ps.textContent = '@media print{#hbUpdate{display:none!important}}';
    document.head.appendChild(ps);
    var sh = host.attachShadow({ mode: 'open' });
    sh.innerHTML =
      '<style>' +
      '.b{display:flex;align-items:center;gap:12px;flex-wrap:wrap;background:#1B3A5C;color:#fff;border-radius:12px;padding:14px 16px;' +
      'box-shadow:0 8px 28px rgba(0,0,0,.28);font:15px/1.45 "Noto Sans KR","Malgun Gothic",sans-serif;border-top:3px solid #C8963E}' +
      '.t{flex:1 1 220px}.t b{color:#F2D49B}.s{display:block;font-size:12.5px;opacity:.8;margin-top:2px}' +
      'button{font:inherit;border:0;border-radius:8px;padding:9px 14px;cursor:pointer;font-weight:700}' +
      '.go{background:#C8963E;color:#fff}.go:hover{background:#b5832f}.no{background:transparent;color:#cfd8e3;font-weight:400;padding:9px 8px}' +
      '</style>' +
      '<div class="b" role="alert"><span class="t"><b>새 버전이 나왔습니다.</b> 새 버전으로 사용하십시오.' +
      '<span class="s">작성 중인 내용이 있으면 저장·복사한 뒤 누르십시오.</span></span>' +
      '<button class="go" type="button">새 버전으로 열기</button><button class="no" type="button">나중에</button></div>';
    sh.querySelector('.go').addEventListener('click', function () { location.reload(); });
    sh.querySelector('.no').addEventListener('click', function () {
      host.remove(); shown = false; laterUntil = Date.now() + 30 * 60 * 1000;   /* 30분 뒤 다시 알림 */
    });
    (document.body || document.documentElement).appendChild(host);
  }
  check();
  setInterval(check, EVERY);
  document.addEventListener('visibilitychange', check);
  window.addEventListener('focus', check);
})();

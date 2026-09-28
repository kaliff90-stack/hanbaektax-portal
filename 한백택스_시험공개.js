/* 세무법인 한백택스 · 시험 공개 스위치
 * 공개 전 도구를 키를 받은 사람에게만 보여 준다. 포털(메인·세무계산·모바일)의 data-trial 항목이 대상이다.
 *   켜기   주소 끝에 ?k=키 를 붙여 한 번 연다 → 이 브라우저에 기억되어 포털 어디서나 보인다
 *   개인 끄기  ?k=off
 *   전체 끄기  아래 HASHES 를 [] 로 비우고 배포 → 키를 받은 사람까지 즉시 숨겨진다
 * 키 원문은 두지 않는다. SHA-256 해시만 둔다.
 * 포털은 이 파일을 ?v=시각 으로 불러 서비스 워커 캐시를 거치지 않는다(끄면 다음 접속부터 바로 반영).
 */
(function(){
  'use strict';
  var HASHES = [
    /* 비어 있음 — 시험 중인 도구 없음. 신용평가 시뮬레이터는 2026-09-28 정식 공개로 키 해제 */
  ];
  var LS = 'hb_trial_key';
  var k = null;
  try{
    var q = new URLSearchParams(window.HB_TRIAL_Q || location.search).get('k');  /* 메인은 syncUrl 이 주소를 먼저 고친다 — 머리에서 잡아 둔 값을 쓴다 */
    if(q === 'off') localStorage.removeItem(LS);
    else if(q) localStorage.setItem(LS, q);
    k = localStorage.getItem(LS);
  }catch(e){}
  if(!k || !HASHES.length || !(window.crypto && crypto.subtle && window.TextEncoder)) return;
  crypto.subtle.digest('SHA-256', new TextEncoder().encode(k)).then(function(buf){
    var hex = Array.prototype.map.call(new Uint8Array(buf), function(b){ return ('0' + b.toString(16)).slice(-2); }).join('');
    if(HASHES.indexOf(hex) < 0) return;
    document.documentElement.classList.add('hb-trial');
    window.HB_TRIAL = true;
    window.dispatchEvent(new Event('hbtrial'));
  }).catch(function(){});
})();

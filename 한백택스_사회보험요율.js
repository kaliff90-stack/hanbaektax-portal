/* 세무법인 한백택스 — 사회보험(4대보험) 근로자 부담 요율 (공용 모듈)
 * 쓰는 곳: 급여 실수령액·세후세전 역산·양도·종합소득·증여·증여세대납·환차손익 계산기의 급여 탭, 세무계산 포털·모바일,
 *          원천징수·연말정산, 법인전환 시뮬레이터, 세무회계 계산기 모음, 4대보험 계산기, 카톡채널 포털.
 * 해마다 요율·상한이 바뀌면 이 파일만 고친다. 각 계산기는 이 파일을 못 읽으면(오프라인 단일 파일 등) 자기 안의 2026 값으로 계산한다.
 *
 * 요율은 근로자 부담분(사용자 부담도 같은 율). ltc 는 건강보험료에 곱하는 장기요양 비율.
 *   2024·2025  국민연금 4.5% · 건강보험 3.545%(7.09%) · 장기요양 12.95% · 고용보험 0.9%
 *   2026       국민연금 4.75%(9.5%, 모수개혁 1년차) · 건강보험 3.595%(7.19%) · 장기요양 13.14%(0.9448%) · 고용보험 0.9%
 *   2027       국민연금 5%(10%) — 국민연금법 2025.4.2 개정 부칙의 단계 인상분. 본문 §88 ③은 최종 1천분의 65만 둔다. 부칙 원문 별도 확인 필요.
 *              건강보험 3.595%(7.19% 동결) — 2026.9.8 제15차 건강보험정책심의위원회 결정(보건복지부 보도, 1차 확인 2026-10-01).
 *              장기요양·고용보험 — 미결정(장기요양위원회 10월 이후 결정 예정). 결정 전까지 2026 값을 쓰고 화면에 「확인 필요」를 띄운다.
 * 국민연금 기준소득월액 상·하한(매년 7.1~다음 해 6.30, 보건복지부 고시)
 *   2024.7~2025.6 617만/39만 · 2025.7~2026.6 637만/40만 · 2026.7~2027.6 659만/41만(고시 제2026-31호)
 */
(function(root){
'use strict';
var META={ver:'2026.10.01',asOf:'2026-10-01'};

/* null 은 「미결정」— 직전 연도 값을 이어 쓰고 pending 에 표시한다 */
var YEARS={
  2024:{np:0.045, hi:0.03545,ltc:0.1295,ei:0.009},
  2025:{np:0.045, hi:0.03545,ltc:0.1295,ei:0.009},
  2026:{np:0.0475,hi:0.03595,ltc:0.1314,ei:0.009},
  2027:{np:0.05,  hi:0.03595,ltc:null,  ei:null}
};
var NP_LIMITS=[            /* [적용 시작 연도(7월부터), 상한, 하한] — 최신이 앞 */
  [2026,6590000,410000],
  [2025,6370000,400000],
  [2024,6170000,390000],
  [2023,5900000,370000]
];
var KEYS=['np','hi','ltc','ei'];
var FIRST=2024, LAST=2027;

function rates(y){
  y=+y||new Date().getFullYear();
  var yy=Math.max(FIRST,Math.min(LAST,y));
  var out={year:y,basis:yy,pending:[]};
  KEYS.forEach(function(k){
    var v=null, z=yy;
    while(z>=FIRST && (v=YEARS[z][k])==null) z--;
    out[k]=v;
    if(z!==yy || y>LAST) out.pending.push(k);
  });
  return out;
}
function npLimits(d){
  var t=d||new Date();
  var y=t.getFullYear(), m=t.getMonth()+1;
  var p=(m>=7)?y:y-1;
  for(var i=0;i<NP_LIMITS.length;i++) if(p>=NP_LIMITS[i][0]) return {max:NP_LIMITS[i][1],min:NP_LIMITS[i][2]};
  var L=NP_LIMITS[NP_LIMITS.length-1]; return {max:L[1],min:L[2]};
}
/* 날짜 하나로 요율 + 국민연금 상·하한을 한 번에 — 고정 상수 객체(R·INS·RATE)를 쓰는 계산기용 */
function flat(d){
  var t=d||new Date(), r=rates(t.getFullYear()), L=npLimits(t);
  return {np:r.np,hi:r.hi,ltc:r.ltc,ei:r.ei,npMax:L.max,npMin:L.min,pending:r.pending,year:r.year};
}
var NAMES={np:'국민연금',hi:'건강보험',ltc:'장기요양',ei:'고용보험'};
function note(y){
  var r=rates(y);
  if(!r.pending.length) return '';
  return r.year+'년 '+r.pending.map(function(k){return NAMES[k];}).join('·')+' 요율은 아직 결정되지 않아 직전 확정 요율로 계산했습니다(확인 필요).';
}
var API={META:META,YEARS:YEARS,rates:rates,npLimits:npLimits,flat:flat,note:note};
if(typeof module!=='undefined'&&module.exports)module.exports=API;root.HB_SI=API;
})(typeof window!=='undefined'?window:globalThis);

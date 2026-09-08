/* 세무법인 한백택스 · 세무 도구 모음 — 서비스 워커
 * 캐시 이름을 올리면 구캐시가 정리되고 새 자산을 다시 받는다.
 * 랜딩(index.html)의 "오프라인 저장" 버튼이 같은 캐시에 계산기 전체를 담는다.
 */
const CACHE = 'hanbaektax-v3';

/* 앱 셸 — 설치 즉시 확보 */
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

/* ── 설치 ── 개별 실패가 전체 설치를 막지 않도록 하나씩 담는다 ── */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.all(SHELL.map(u => cache.add(u).catch(() => null)))
    )
  );
});

/* ── 활성화 ── 구버전 캐시 정리 ── */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* ── 페이지에서 보낸 갱신 신호 ── */
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

/* ── 요청 처리 ──
 * 같은 출처: 캐시 우선 + 배경 갱신(stale-while-revalidate)
 * 구글 폰트: 캐시 우선
 * 그 밖의 외부 요청: 네트워크 그대로
 * 오프라인에서 문서 요청이 실패하면 캐시된 index.html 로 돌린다.
 */
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (err) { return; }

  const sameOrigin = url.origin === self.location.origin;
  const isFont = FONT_HOSTS.indexOf(url.hostname) >= 0;
  if (!sameOrigin && !isFont) return;

  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(req).then(cached => {
        const fetching = fetch(req)
          .then(res => {
            if (res && res.status === 200 && (res.type === 'basic' || res.type === 'cors')) {
              cache.put(req, res.clone());
            }
            return res;
          })
          .catch(() => null);

        if (cached) {
          fetching; // 배경 갱신
          return cached;
        }
        return fetching.then(res => {
          if (res) return res;
          if (req.mode === 'navigate') return cache.match('./index.html');
          return new Response('오프라인 상태입니다.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          });
        });
      })
    )
  );
});

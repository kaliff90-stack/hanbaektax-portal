/* 세무법인 한백택스 · 세무 도구 모음 — 서비스 워커
 * 캐시 이름은 이 파일만 알고 있다. 랜딩(index.html)은 메시지로 저장을 요청한다.
 *   { type:'PRECACHE',     urls:[...] } → 진행률을 되돌려 주고 끝나면 done
 *   { type:'CACHE_STATUS', urls:[...] } → 이미 저장된 건수를 돌려준다
 *   { type:'SKIP_WAITING' }             → 대기 중인 새 워커를 즉시 활성화
 * 캐시 이름을 올리면 구캐시가 정리되고 새 자산을 다시 받는다.
 */
const CACHE = 'hanbaektax-v12';

/* 앱 셸 — 설치 즉시 확보 */
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './logo.png',
  './logo-white.png',
  './logo-mark.png'
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

/* ── 페이지에서 온 요청 ── */
self.addEventListener('message', e => {
  const data = e.data || {};
  const port = e.ports && e.ports[0];

  if (data.type === 'SKIP_WAITING') { self.skipWaiting(); return; }
  if (!port) return;

  if (data.type === 'PRECACHE')     { e.waitUntil(precache(data.urls || [], port)); return; }
  if (data.type === 'CACHE_STATUS') { e.waitUntil(status(data.urls || [], port));   return; }

  port.postMessage({ type: 'error', message: '알 수 없는 요청입니다.' });
});

/* 하나씩 담아 진행률을 흘려 보낸다 — 한 건이 실패해도 나머지는 이어 간다 */
async function precache(urls, port) {
  try {
    const cache = await caches.open(CACHE);
    let ok = 0, fail = 0;
    for (let i = 0; i < urls.length; i++) {
      try { await cache.add(urls[i]); ok++; } catch (err) { fail++; }
      port.postMessage({ type: 'progress', done: i + 1, total: urls.length, ok: ok, fail: fail });
    }
    port.postMessage({ type: 'done', ok: ok, fail: fail, total: urls.length });
  } catch (err) {
    port.postMessage({ type: 'error', message: '저장소를 열지 못했습니다.' });
  }
}

async function status(urls, port) {
  try {
    const cache = await caches.open(CACHE);
    const hits = await Promise.all(urls.map(u => cache.match(u).then(r => !!r).catch(() => false)));
    port.postMessage({ type: 'done', ok: hits.filter(Boolean).length, total: urls.length });
  } catch (err) {
    port.postMessage({ type: 'error', message: '저장소를 열지 못했습니다.' });
  }
}

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
          e.waitUntil(fetching); /* 배경 갱신 */
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

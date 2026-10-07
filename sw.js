/* 欧盟到岸成本计算器 — Service Worker
 * cache-first 策略：先读缓存，没有再走网络；网络成功后回填缓存，离线时可打开。
 * 改版本号即可让旧缓存失效（activate 时会清理）。
 */
var CACHE_NAME = 'eu-landed-cost-v1';
var CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'assets/icon-192.png',
  'assets/icon-512.png',
  'assets/apple-touch-icon.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(CORE_ASSETS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) {
          // 只清理本应用的旧版本缓存，不动同源下其他应用的缓存
          return key.indexOf('eu-landed-cost-') === 0 && key !== CACHE_NAME;
        }).map(function (key) { return caches.delete(key); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;
  // 只处理同源请求，跨域（如字体、统计、Web3Forms）直接走网络
  var url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(function (cached) {
      if (cached) {
        // 后台静默更新缓存，保证下次打开是最新版
        fetch(request).then(function (response) {
          if (response && response.ok) {
            var copy = response.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(request, copy);
            });
          }
        }).catch(function () { /* 离线时忽略 */ });
        return cached;
      }
      return fetch(request).then(function (response) {
        if (response && response.ok) {
          var copy2 = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(request, copy2);
          });
        }
        return response;
      }).catch(function () {
        // 网络也失败（如离线打开未缓存页面）：回退到缓存的首页
        if (request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return Response.error();
      });
    })
  );
});

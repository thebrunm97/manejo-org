// public/sw.js (Versão Final Sugerida)

const CACHE_NAME = 'pmo-digital-cache-v4'; // Nova versão
const APP_SHELL_URL = '/index.html';
const URLS_TO_CACHE = [
  '/',
  APP_SHELL_URL,
  // Adicione aqui os seus assets principais (manifest.json, logo, etc.)
];

// ... (Seus eventos 'install' e 'activate' permanecem os mesmos) ...

self.addEventListener('fetch', event => {
  const { request } = event;

  // Estratégia 1: Ignorar requisições que não são GET
  // Isso evita problemas com POST, PUT, DELETE, etc.
  if (request.method !== 'GET') {
    return;
  }

  // Estratégia 2: Para rotas de API, usar "Network Only"
  // Se a URL do request incluir '/api/' (ajuste conforme sua necessidade),
  // nunca tente servir do cache. Deixe falhar se estiver offline.
  if (request.url.includes('/api/')) {
    event.respondWith(fetch(request));
    return;
  }

  // Estratégia 3: Para navegação (HTML), usar "Network Falling Back to Cache"
  // Isso garante que o usuário sempre veja a versão mais recente se estiver online,
  // mas ainda consiga abrir o app se estiver offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => {
        // Se a busca na rede falhar, sirva o App Shell principal do cache.
        return caches.match(APP_SHELL_URL);
      })
    );
    return;
  }

  // Estratégia 4: Para assets (CSS, JS, Imagens), usar "Cache First"
  // Servir do cache é mais rápido e funciona offline.
  event.respondWith(
    caches.match(request).then(cachedResponse => {
      // Se tiver no cache, retorna.
      if (cachedResponse) {
        return cachedResponse;
      }
      // Senão, busca na rede. Opcionalmente, pode adicionar ao cache aqui.
      return fetch(request);
    })
  );
});
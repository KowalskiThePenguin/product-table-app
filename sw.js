// sw.js

// Укажите имя кэша для текущей версии ваших ассетов
const CACHE_NAME = 'product-table-cache-v2';

// Список основных файлов, которые составляют "оболочку" приложения
const urlsToCache = [
  './', // Корень области действия
  'index.html',
  'style.css',
  'app.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  './manifest.json', // Добавьте или убедитесь, что без ведущего слеша
  './icons/icon-192x192.png', // Добавьте или убедитесь, что без ведущего слеша
  './icons/icon-512x512.png' // Добавьте или убедитесь, что без ведущего слеша
  // Добавьте другие файлы, которые хотите кэшировать
];

// Название кэша для данных API (список товаров)
const DATA_CACHE_NAME = 'product-data-cache-v1';
const GOOGLE_SHEETS_API_BASE_URL = 'https://sheets.googleapis.com/';

// === Обработчик события установки (install) ===
// Происходит при первой регистрации сервис-воркера или при обновлении его версии
self.addEventListener('install', (event) => {
  console.log('Service Worker: Установка и кэширование оболочки приложения.');
  event.waitUntil( // Ждем выполнения промиса
    caches.open(CACHE_NAME) // Открываем или создаем основной кэш
      .then((cache) => {
        console.log('Service Worker: Кэширование файлов оболочки.');
        return cache.addAll(urlsToCache); // Добавляем все файлы из списка в кэш
      })
      .then(() => {
        // Активируем нового сервис-воркера сразу после установки
        // Полезно при разработке, чтобы изменения применялись сразу
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Ошибка при кэшировании оболочки', error);
      })
  );
});

// === Обработчик события активации (activate) ===
// Происходит после установки, когда старый сервис-воркер больше не контролирует страницы
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Активация и очистка старых кэшей.');
  event.waitUntil( // Ждем выполнения промиса
    caches.keys().then((cacheNames) => {
      return Promise.all( // Ждем выполнения всех промисов внутри массива
        cacheNames.map((cacheName) => {
          // Удаляем кэши, которые не соответствуют текущим именам кэшей оболочки или данных
          if (cacheName !== CACHE_NAME && cacheName !== DATA_CACHE_NAME) {
            console.log('Service Worker: Удаление старого кэша:', cacheName);
            return caches.delete(cacheName); // Удаляем старый кэш
          }
        })
      );
    }).then(() => {
      // Сервис-воркер берет под контроль страницы сразу после активации
      return clients.claim();
    })
  );
});

// === Обработчик события fetch (перехват сетевых запросов) ===
// Происходит при каждом сетевом запросе со страницы, контролируемой сервис-воркером
self.addEventListener('fetch', (event) => {
  // console.log('Service Worker: Перехват запроса', event.request.url);

  // Определяем стратегию кэширования в зависимости от типа запроса

  // 1. Стратегия для запросов к API Google Sheets (сеть сначала, затем кэш)
  if (event.request.url.startsWith(GOOGLE_SHEETS_API_BASE_URL)) {
     console.log('Service Worker: Обработка запроса к API Google Sheets.');
    event.respondWith( // Перехватываем ответ на запрос
      caches.open(DATA_CACHE_NAME).then((cache) => {
        return fetch(event.request) // Пытаемся получить данные из сети
          .then((response) => {
            // Если запрос к сети успешен, кэшируем ответ и возвращаем его
            console.log('Service Worker: Данные API получены из сети, обновляем кэш.');
            cache.put(event.request, response.clone()); // Кэшируем ответ (делаем клон, т.к. ответ можно прочитать только один раз)
            return response;
          })
          .catch(() => {
            // Если запрос к сети не удался (оффлайн или ошибка), пытаемся взять из кэша
            console.log('Service Worker: Запрос к сети не удался, пытаемся взять данные API из кэша.');
            return cache.match(event.request); // Возвращаем ответ из кэша
          });
      })
    );
  }
  // 2. Стратегия для остальных запросов (сначала кэш, затем сеть) - для оболочки приложения
  else {
     console.log('Service Worker: Обработка запроса кэш сначала для:', event.request.url); // Убрал комментарий для лога
    event.respondWith( // Перехватываем ответ на запрос
      caches.match(event.request) // Пытаемся найти запрос в кэше
        .then((response) => {
          // Если ресурс найден в кэше, возвращаем его
          if (response) {
            console.log('Service Worker: Ресурс найден в кэше:', event.request.url); // Убрал комментарий для лога
            return response;
          }
          // Если ресурс не найден в кэше, идем в сеть
          console.log('Service Worker: Ресурс не найден в кэше, запрашиваем из сети:', event.request.url);
          return fetch(event.request); // Этот Промис разрешится или отклонится
        })
        .catch((error) => {
      console.error('Service Worker: Ошибка при обработке запроса:', event.request.url, error);

      // --- ФОЛЛБЭК (ЗАПАСНОЙ ОТВЕТ) ---
      // Возвращаем запасной HTML-ответ ТОЛЬКО для навигационных запросов (главная страница)
      if (event.request.mode === 'navigate') {
          console.log('Service Worker: Навигационный запрос в оффлайне, отдаем запасную страницу.');
          return new Response('<h1>Оффлайн</h1><p>Не удалось загрузить приложение. Пожалуйста, проверьте ваше интернет-соединение.</p>', {
              status: 503, // Код статуса "Сервис недоступен"
              headers: { 'Content-Type': 'text/html' } // Указываем тип контента
          });
      }
      // Для остальных запросов (CSS, JS, картинки и т.д.) просто позволяем запросу завершиться неудачей.
      // Браузер покажет стандартные ошибки 404/Failed to fetch для этих ресурсов.
      // Это предотвратит ошибку TypeError при попытке отдать HTML вместо CSS/JS.
      // return Promise.reject(error); // Можно явно отклонить промис
      throw error; // Или просто перебросить оригинальную ошибку
      // --- КОНЕЦ ФОЛЛБЭКА ---
    })
    );
  }
});
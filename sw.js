// sw.js

// Укажите имя кэша для текущей версии ваших ассетов
const CACHE_NAME = 'product-table-cache-v1';

// Список основных файлов, которые составляют "оболочку" приложения
const urlsToCache = [
  './', // Кэшируем index.html (корневой путь)
  'index.html',
  'style.css',
  'app.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js' // Кэшируем библиотеку html2canvas
  // Добавьте сюда ссылки на файлы Font Awesome, если вы их используете локально или с CDN
  // Например:
  // 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
  // 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/webfonts/fa-solid-900.woff2',
  // и т.д. для всех необходимых файлов шрифтов
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
     // console.log('Service Worker: Обработка запроса кэш сначала для:', event.request.url);
    event.respondWith( // Перехватываем ответ на запрос
      caches.match(event.request) // Пытаемся найти запрос в кэше
        .then((response) => {
          // Если ресурс найден в кэше, возвращаем его
          if (response) {
            // console.log('Service Worker: Ресурс найден в кэше:', event.request.url);
            return response;
          }
          // Если ресурс не найден в кэше, идем в сеть
          console.log('Service Worker: Ресурс не найден в кэше, запрашиваем из сети:', event.request.url);
          return fetch(event.request);
        })
        .catch((error) => {
          // Если что-то пошло не так (например, нет сети и нет в кэше)
          console.error('Service Worker: Ошибка при обработке запроса:', event.request.url, error);
          // Можно вернуть запасную оффлайн-страницу, если она закэширована
          // return caches.match('/offline.html');
        })
    );
  }
});
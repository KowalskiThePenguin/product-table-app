// --- Константы и глобальные переменные ---
const API_KEY     = 'AIzaSyCTZ1P-b1yqq3A75r91DOnmHJYMMb7fKGY'; // !!! Замените на ваш ключ API !!!
const SHEET_ID    = '1JUk0iVBhpOZf1kfOoe-WKwHXMoYxdTrpje7iUqDnMPs'; // !!! ID вашей таблицы !!!
const RANGE       = 'A:E'; // Диапазон данных (A:E)

let products = []; // Массив всех товаров

// --- Хранилище состояний и метаданных видов ---
// viewStates: { 'view-1': 'innerHTML_content_1', 'view-2': 'innerHTML_content_2', ... }
let viewStates = {};
// viewMetadata: { 'view-1': 'Название 1', 'view-2': 'Название 2', ... }
let viewMetadata = {};
let activeViewId = 'view-1'; // ID текущего активного вида
let nextViewIdCounter = 1; // Счетчик для генерации ID новых видов (начнем с 1, т.к. "Список 1" может существовать по умолчанию)

// --- DOM Элементы ---
const menuToggleBtn = document.getElementById('menu-toggle');
const sideMenu = document.getElementById('side-menu');
const closeMenuBtn = document.getElementById('close-menu');
const viewList = document.getElementById('view-list'); // ul элемент
const addViewBtn = document.getElementById('add-view-btn');
const productTable = document.getElementById('product-table');
const tableBody = productTable.querySelector('tbody');
const totalSumCell = document.getElementById('total-sum');
const mainContent = document.getElementById('main-content');
const fabButton = document.getElementById('add-row');
const currentViewNameElement = document.getElementById('current-view-name');
let lastFocusedInput = null;

// Отслеживаем последний input с фокусом
tableBody.addEventListener('focusin', (e) => {
    if (e.target.tagName === 'INPUT' && e.target.type === 'text') {
        lastFocusedInput = e.target;
    }
});

// Обработка paste на стадии захвата (capture=true)
document.addEventListener('paste', (event) => {
    if (!lastFocusedInput || !tableBody.contains(lastFocusedInput)) return;

    const clipboardData = event.clipboardData || window.clipboardData;
    const pastedText = clipboardData.getData('text');
    const lines = pastedText.split(/\r?\n/).filter(line => line.trim() !== '');

    if (lines.length === 0) return;

    event.stopImmediatePropagation(); // 💥 Блокирует ВСЕ другие paste
    event.preventDefault();           // 💥 Запрещает дефолтную вставку

    const currentRow = lastFocusedInput.closest('tr');
    const currentRowIndex = Array.from(tableBody.rows).indexOf(currentRow);
    const currentInputIndex = Array.from(currentRow.querySelectorAll('input[type="text"]')).indexOf(lastFocusedInput);

    // Добавляем строки, если их не хватает
    const neededRows = currentRowIndex + lines.length;
    while (tableBody.rows.length < neededRows) {
        addRow(false); // не фокусируем
    }

    lines.forEach((lineText, i) => {
        const row = tableBody.rows[currentRowIndex + i];
        const inputs = row.querySelectorAll('input[type="text"]');
        const cells = lineText.split('\t');

        cells.forEach((cellText, j) => {
            const input = inputs[currentInputIndex + j];
            if (input) {
                input.value = cellText.trim();
                // Instead of dispatching 'input' event which triggers suggestions,
                // directly call onNameChange if it's the name input.
                // For other inputs (qty, etc.), just setting the value is enough.
                if (input.classList.contains('name-input')) {
                    // Assuming onNameChange can handle direct calls
                    // and will find product data if the name matches.
                    // Pass the row and the old value (empty string, as it's a new paste)
                    onNameChange(input.closest('tr'), '');
                    // Manually hide suggestions if they appear for pasted name
                    const suggestionsDropdown = input.nextElementSibling;
                    if (suggestionsDropdown && suggestionsDropdown.classList.contains('suggestions-dropdown')) {
                        suggestionsDropdown.style.display = 'none';
                        input.removeAttribute('aria-expanded');
                    }
                } else {
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }
        });
    });

    calculateTotal();
    saveCurrentViewState();
}, true); // <-- ОБЯЗАТЕЛЬНО capture=true


// --- Функции для работы с localStorage ---

function saveAppStateToLocalStorage() {
    console.log('Saving app state to localStorage...');
    try {
        // Обновляем атрибуты 'value' у инпутов в текущей таблице перед сохранением innerHTML
        tableBody.querySelectorAll('tr').forEach(tr => {
            const nameInput = tr.querySelector('.name-input');
            const qtyInput = tr.querySelector('.qty-input');
            if (nameInput) {
                nameInput.setAttribute('value', nameInput.value);
            }
            if (qtyInput) {
                qtyInput.setAttribute('value', qtyInput.value);
            }
        });

        // Сохраняем актуальное HTML-содержимое tableBody для текущего активного вида
        viewStates[activeViewId] = tableBody.innerHTML;

        // Собираем все данные, которые нужно сохранить
        const appState = {
            viewStates: viewStates,
            viewMetadata: viewMetadata,
            activeViewId: activeViewId,
            nextViewIdCounter: nextViewIdCounter
        };
        const jsonState = JSON.stringify(appState);
        localStorage.setItem('productTableState', jsonState);
        console.log('App state saved successfully.');
    } catch (error) {
        console.error('Error saving app state to localStorage:', error);
        // Можно добавить уведомление пользователю
    }
}

function loadAppStateFromLocalStorage() {
    console.log('Loading app state from localStorage...');
    try {
        const jsonState = localStorage.getItem('productTableState');
        if (jsonState) {
            const appState = JSON.parse(jsonState);
            viewStates = appState.viewStates || {};
            viewMetadata = appState.viewMetadata || {};
            activeViewId = appState.activeViewId || 'view-1';
            nextViewIdCounter = appState.nextViewIdCounter || 1;

            console.log('App state loaded successfully.');
            return true; // Данные были загружены
        } else {
            console.log('No saved state found in localStorage.');
            return false; // Нет сохраненных данных
        }
    } catch (error) {
        console.error('Error loading app state from localStorage:', error);
        // В случае ошибки парсинга, возможно, стоит очистить localStorage
        // localStorage.removeItem('productTableState'); // Опционально
        // alert('Произошла ошибка при загрузке сохраненных данных.');
        return false;
    }
}


// --- Функции форматирования и парсинга чисел ---
function formatNumberDisplay(num) {
    const number = parseFloat(num);
    if (isNaN(number)) return '';
    // Используем toLocaleString для форматирования чисел
    return number.toLocaleString('ru-RU', {
        minimumFractionDigits: 0, // Минимальное количество десятичных знаков
        maximumFractionDigits: 2  // Максимальное количество десятичных знаков
    });
}

function parseFormattedNumber(str) {
    if (!str) return 0;
    // Удаляем все пробелы и заменяем запятую на точку
    const cleanedString = String(str).replace(/\s/g, '').replace(',', '.');
    return parseFloat(cleanedString) || 0;
}


// === Регистрация Service Worker ===
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // ИСПРАВЛЕН ПУТЬ К СКРИПТУ Service Worker для GitHub Pages
    navigator.serviceWorker.register('/product-table-app/sw.js', { scope: '/product-table-app/' })
      .then((registration) => {
        console.log('Service Worker: Регистрация успешна с областью видимости:', registration.scope);
      })
      .catch((error) => {
        console.error('Service Worker: Ошибка при регистрации:', error);
      });
  });
}

// === Отслеживание статуса сети ===
const networkStatusIndicator = document.createElement('div');
networkStatusIndicator.id = 'network-status';
document.body.appendChild(networkStatusIndicator);

function updateNetworkStatus() {
  if (navigator.onLine) {
    networkStatusIndicator.textContent = 'Онлайн';
    networkStatusIndicator.style.backgroundColor = '#d4edda'; // Зеленый фон
    networkStatusIndicator.style.color = '#155724'; // Темно-зеленый текст
     console.log('Приложение снова онлайн. Пытаемся обновить данные товаров.');
     fetchProducts(); // Повторно вызываем загрузку данных товаров
  } else {
    networkStatusIndicator.textContent = 'Оффлайн';
    networkStatusIndicator.style.backgroundColor = '#f8d7da'; // Красный фон
    networkStatusIndicator.style.color = '#721c24'; // Темно-красный текст
  }
  networkStatusIndicator.style.display = 'block';
   if (navigator.onLine) {
       // Скрываем индикатор онлайн статуса через несколько секунд
       setTimeout(() => {
           networkStatusIndicator.style.display = 'none';
       }, 3000);
   }
}

window.addEventListener('online', updateNetworkStatus);
window.addEventListener('offline', updateNetworkStatus);


// --- Функции для ПОЛЬЗОВАТЕЛЬСКОГО АВТОДОПОЛНЕНИЯ ---
function getFilteredProducts(inputValue) {
     inputValue = inputValue.trim().toLowerCase();

    if (!inputValue) {
        return [];
    }

    let exactMatch = null;
     // Сначала ищем точное совпадение по ID или названию
     if (/^\d+$/.test(inputValue)) {
        exactMatch = products.find(p => p.id && p.id.toLowerCase() === inputValue);
     }
     if (!exactMatch) {
         exactMatch = products.find(p => p.name.toLowerCase() === inputValue);
     }


    const startsWithId = [];
    const startsWithName = [];
    const containsId = [];
    const containsName = [];

    // Фильтруем остальные результаты
    for (const p of products) {
        // Пропускаем, если это точное совпадение, которое мы уже нашли
        if (exactMatch && (p.id === exactMatch.id || (!p.id && p.name === exactMatch.name))) {
             continue;
        }

        const nameLower = p.name.toLowerCase();
        const idLower = p.id ? p.id.toLowerCase() : '';

        if (idLower.startsWith(inputValue)) {
           startsWithId.push(p);
        } else if (nameLower.startsWith(inputValue)) {
           startsWithName.push(p);
        } else if (idLower.includes(inputValue)) {
           containsId.push(p);
        } else if (nameLower.includes(inputValue)) {
           containsName.push(p);
        }
    }

    // Формируем отсортированный список: точное совпадение, начинается с ID, начинается с имени, содержит ID, содержит имя
    const ordered = [];
    if (exactMatch) {
        ordered.push(exactMatch);
    }
    ordered.push(...startsWithId, ...startsWithName, ...containsId, ...containsName);

    // Убираем дубликаты
    const uniqueOrdered = [];
    const seen = new Set();

    for (const product of ordered) {
        const key = product.id || product.name; // Используем ID или имя как ключ для уникальности
        if (!seen.has(key)) {
             uniqueOrdered.push(product);
             seen.add(key);
        }
    }

    return uniqueOrdered;
}

function updateSuggestionsUI(nameInput, suggestionsDropdown) {
     const inputValue = nameInput.value.trim();
    const filteredProducts = getFilteredProducts(inputValue);

    suggestionsDropdown.innerHTML = ''; // Очищаем предыдущие предложения
    nameInput.removeAttribute('aria-activedescendant'); // Сбрасываем aria-атрибут

    const limitedResults = filteredProducts.slice(0, 100); // Ограничиваем количество результатов

    if (limitedResults.length > 0) {
        limitedResults.forEach((product, index) => {
            const itemElement = document.createElement('div');
            itemElement.classList.add('suggestion-item');
            itemElement.setAttribute('role', 'option');
            itemElement.setAttribute('tabindex', '-1'); // Делаем элемент фокусируемым, но не в обычном потоке Tab

            // Генерируем ID для aria-активности
            if (!suggestionsDropdown.id) {
                 suggestionsDropdown.id = 'suggestions-dropdown-' + nameInput.closest('tr').rowIndex;
             }
            itemElement.id = `${suggestionsDropdown.id}-item-${index}`;

            // Сохраняем данные о товаре в data-атрибутах
            itemElement.dataset.productId = product.id;
            itemElement.dataset.productName = product.name;
            itemElement.dataset.productUnit = product.unit;
            itemElement.dataset.productCountry = product.country;
            itemElement.dataset.productPrice = product.price;

            const mainLine = document.createElement('div');
            mainLine.classList.add('main-line');
            mainLine.textContent = `${product.id ? product.id + ' - ' : ''}${product.name}`; // Формат: ID - Название

            const detailsLine = document.createElement('div');
            detailsLine.classList.add('details-line');
            const formattedPrice = formatNumberDisplay(product.price);
            detailsLine.textContent = `${product.country} · ${formattedPrice} · ${product.unit}`; // Формат: Страна · Цена · Ед.изм.

            itemElement.appendChild(mainLine);
            itemElement.appendChild(detailsLine);

             // Обработчик mousedown, чтобы предотвратить blur на input перед кликом
             itemElement.addEventListener('mousedown', () => {
                nameInput._isSelectingSuggestion = true;
            });

             // Обработчик клика по предложению
            itemElement.addEventListener('mousedown', () => {
                console.log('Suggestion item clicked.');
                try {
                     const selectedProduct = {
                         id: itemElement.dataset.productId,
                         name: itemElement.dataset.productName,
                         unit: itemElement.dataset.productUnit,
                         country: itemElement.dataset.productCountry,
                         price: parseFormattedNumber(itemElement.dataset.productPrice)
                     };

                    // Устанавливаем выбранное название в поле ввода
                    nameInput.value = selectedProduct.name;
                    console.log('Input value set by suggestion click:', nameInput.value);

                    // Вызываем onNameChange для обновления остальных ячеек строки
                    // Передаем старое значение, но так как мы выбрали из списка, valueChanged будет true
                    onNameChange(nameInput.closest('tr'), nameInput.dataset.prevValue || '');


                    // Скрываем выпадающий список и сбрасываем флаг
                    suggestionsDropdown.style.display = 'none';
                    nameInput._isSelectingSuggestion = false;
                    const tr = nameInput.closest('tr');
                    const qtyInput = tr.querySelector('.qty-input');

                    if (qtyInput) {
                        // Переводим фокус на поле количества с небольшой задержкой
                         setTimeout(() => {
                             qtyInput.focus();
                         }, 0);
                    }

                } catch (error) {
                    console.error('Error during suggestion item click handling:', error);
                    nameInput._isSelectingSuggestion = false; // Важно сбросить флаг даже при ошибке
                }
            });

            suggestionsDropdown.appendChild(itemElement);
        });

        // Показываем выпадающий список и устанавливаем aria-атрибуты
        suggestionsDropdown.style.display = 'block';
        suggestionsDropdown.setAttribute('role', 'listbox');
        nameInput.setAttribute('aria-expanded', 'true');
         if (!suggestionsDropdown.id) {
             suggestionsDropdown.id = 'suggestions-dropdown-' + nameInput.closest('tr').rowIndex;
         }
         nameInput.setAttribute('aria-controls', suggestionsDropdown.id);
         nameInput.setAttribute('aria-haspopup', 'listbox');
         nameInput.setAttribute('aria-autocomplete', 'list');

    } else {
        // Если предложений нет, скрываем список и сбрасываем aria-атрибуты
        suggestionsDropdown.style.display = 'none';
        nameInput.setAttribute('aria-expanded', 'false');
        nameInput.removeAttribute('aria-controls');
        nameInput.removeAttribute('aria-activedescendant');
        nameInput._isSelectingSuggestion = false; // Убеждаемся, что флаг сброшен
    }
}


// --- Функции экспорта CSV, печати, снимка ---

function escapeCsvString(str) {
      if (str === null || str === undefined) {
        return '';
    }
    str = String(str);
    // Экранируем двойные кавытки внутри строки двойными кавычками
    const escaped = str.replace(/"/g, '""');
    // Оборачиваем строку в двойные кавычки, если она содержит разделитель (точка с запятой),
    // двойные кавычки, символы новой строки или табуляции.
    if (escaped.includes(';') || escaped.includes('"') || escaped.includes('\n') || escaped.includes('\r') || escaped.includes('\t')) {
        return `"${escaped}"`;
    }
    return escaped;
}

function exportTableToCsv() {
  let csv = [];
  const headerRow = productTable.querySelector('thead tr');
  if (headerRow) {
      // Получаем текст заголовков, кроме последней колонки "Удалить"
      const existingHeaderCells = headerRow.querySelectorAll('th:not(:last-child)');
      // Формируем массив заголовков, добавляя "ID" в начало
      const headerData = [escapeCsvString("ID"), ...Array.from(existingHeaderCells).map(th => escapeCsvString(th.textContent.trim()))];
      csv.push(headerData.join(';'));
  }

  // Проходим по всем строкам тела таблицы
  tableBody.querySelectorAll('tr').forEach(tr => {
      const cells = tr.querySelectorAll('td');
      const nameInput = tr.querySelector('.name-input');
      const qtyInput = tr.querySelector('.qty-input');

      // Проверяем, что строка содержит достаточно ячеек и нужные поля ввода
      if (cells.length >= 7 && nameInput && qtyInput) {
          // Получаем данные из data-атрибута или поля ввода
          const productId = tr.dataset.productId || '';
          const name = nameInput.value || '';
          const unit = cells[2] ? cells[2].textContent.trim() : '';
          const country = cells[3] ? cells[3].textContent.trim() : '';
          // Получаем значение количества и цены, заменяем точку на запятую для CSV
          const qtyStr = (qtyInput.value || '').replace('.', ',');
          const priceStr = (cells[5] ? cells[5].dataset.price || '0' : '0').replace('.', ',');
          const sumStr = (cells[6] ? cells[6].dataset.sum || '0' : '0').replace('.', ',');

          // Формируем строку CSV для текущей строки таблицы
          const rowCsv = [
              escapeCsvString(productId),
			  escapeCsvString(cells[0] ? cells[0].textContent.trim() : ''), // Номер строки
              escapeCsvString(name),
              escapeCsvString(unit),
              escapeCsvString(country),
              escapeCsvString(qtyStr),
              escapeCsvString(priceStr),
              escapeCsvString(sumStr)
          ];
          csv.push(rowCsv.join(';'));
      }
  });

  // Добавляем строку итоговой суммы в CSV
  const footerRow = productTable.querySelector('tfoot tr');
  if (footerRow) {
      const footerCells = footerRow.querySelectorAll('td');
      const totalFooterData = [];
      const exportColumnCount = 7; // Ожидаемое количество колонок в экспорте (ID, №, Название, Ед.изм, Страна, Кол-во, Цена, Сумма)

      // Добавляем текст "Итого" или из первой ячейки подвала
      if (footerCells[1]) { // Предполагаем, что "Итого" во второй ячейке подвала
           totalFooterData.push(escapeCsvString(footerCells[1].textContent.trim()));
      } else {
           totalFooterData.push('');
      }

      // Добавляем пустые ячейки до колонки с суммой
      const emptyCellsCount = exportColumnCount - 2; // От общего числа колонок вычитаем "Итого" и "Сумма"
      for(let i = 0; i < emptyCellsCount; i++) {
           totalFooterData.push('');
      }

       // Добавляем итоговую сумму
       if (totalSumCell) {
            const totalSumValue = String(parseFloat(totalSumCell.dataset.total || 0)).replace('.', ',');
            totalFooterData.push(escapeCsvString(totalSumValue));
       } else {
           totalFooterData.push('');
       }

       csv.push(totalFooterData.join(';'));
  }


  const csvString = csv.join('\r\n'); // Объединяем строки с символами новой строки
  const BOM = '\uFEFF'; // Добавляем BOM для корректного отображения кириллицы в Excel
  const blob = new Blob([BOM + csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);

  // Имя файла берем из viewMetadata и очищаем от недопустимых символов
  const viewName = viewMetadata[activeViewId] ? viewMetadata[activeViewId].trim() : 'таблица';
  const filename = `${viewName.replace(/[^a-zа-я0-9]/gi, '_')}.csv`;

  link.setAttribute('download', filename);
  document.body.appendChild(link); // Добавляем ссылку в DOM временно
  link.click(); // Имитируем клик по ссылке для скачивания
  document.body.removeChild(link); // Удаляем ссылку из DOM
  URL.revokeObjectURL(url); // Освобождаем память
  console.log(`Table for view '${viewName}' exported to CSV.`);
}

function printTable() {
    // Получаем элемент для даты в шапке для печати
    const dateElement = document.querySelector('.print-header-text .print-date');
    let originalDateText = ''; // Сохраняем исходное содержимое

    if (dateElement) {
        originalDateText = dateElement.textContent; // Сохраняем текущий текст
        const today = new Date();
        // Форматируем текущую дату
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        const formattedDate = today.toLocaleDateString('ru-RU', options);
        dateElement.textContent = formattedDate; // Вставляем текущую дату
        console.log('Вставлена дата для печати:', formattedDate);
    }

    // Вызываем стандартное окно печати браузера
    window.print();

    // Очищаем или восстанавливаем элемент даты после завершения печати
    if (dateElement) {
        // Небольшая задержка нужна, потому что window.print асинхронна
        setTimeout(() => {
             dateElement.textContent = originalDateText; // Восстанавливаем исходный текст (или очищаем)
             console.log('Очищена дата после печати.');
        }, 100); // Небольшая задержка
    }
}

function captureTableSnapshot() {
    const elementToCapture = document.getElementById('main-content'); // Это .container
    const productTableElement = document.getElementById('product-table'); // Сама таблица

    if (!elementToCapture) {
        console.error('Ошибка: Элемент контейнера с ID "main-content" не найден.');
        alert('Не удалось найти контейнер для создания снимка.');
        return;
    }

    console.log('Попытка создать снимок контейнера с отключением медиазапросов...');

    // Элементы для скрытия во время создания снимка
    const appHeader = document.getElementById('app-header');
    const appFooter = document.getElementById('app-footer');
    const sideMenu = document.getElementById('side-menu');
    const networkStatus = document.getElementById('network-status');

    // Находим элементы, связанные с названием компании и логотипом
    const printHeaderTextElement = elementToCapture.querySelector('.print-header-text');
    const printHeaderImageDiv = elementToCapture.querySelector('.print-header-image');
    // Нам не обязательно напрямую скрывать .company-name, если его родитель (printHeaderTextElement) скрыт.
    // Если .company-name может быть вне .print-header-text, тогда его нужно искать и скрывать отдельно.

    // Сохраняем исходные встроенные стили для элементов, чьи свойства transform/width/overflow мы меняем
    const originalContainerTransform = elementToCapture.style.transform;
    const originalContainerWidth = elementToCapture.style.width;
    const originalContainerOverflowX = elementToCapture.style.overflowX;
    const originalContainerPadding = elementToCapture.style.padding;
    const originalProductTableTransform = productTableElement ? productTableElement.style.transform : '';
    const originalProductTableWidth = productTableElement ? productTableElement.style.width : '';
    const originalProductTableMaxWidth = productTableElement ? productTableElement.style.maxWidth : '';
    const originalProductTableTableLayout = productTableElement ? productTableElement.style.tableLayout : '';

    // Сохраняем display для элементов, которые скрываем
    const originalAppHeaderDisplay = appHeader ? appHeader.style.display : '';
    const originalAppFooterDisplay = appFooter ? appFooter.style.display : '';
    const originalSideMenuDisplay = sideMenu ? sideMenu.style.display : '';
    const originalNetworkStatusDisplay = networkStatus ? networkStatus.style.display : '';

    // *** НОВОЕ: Сохраняем исходные display стили для элементов названия компании и логотипа ***
    const originalPrintHeaderTextDisplay = printHeaderTextElement ? printHeaderTextElement.style.display : '';
    const originalPrintHeaderImageDisplay = printHeaderImageDiv ? printHeaderImageDiv.style.display : '';


    // Временно переопределяем стили для отключения эффектов медиазапросов (масштабирование и т.д.)
    elementToCapture.style.cssText += 'transform: none !important; width: auto !important; max-width: none !important; overflow-x: visible !important; padding: 20px !important;';
    if (productTableElement) {
        productTableElement.style.cssText += 'transform: none !important; width: auto !important; max-width: none !important; table-layout: auto !important;';
    }

    // Временно скрываем глобальные элементы UI
    if (appHeader) appHeader.style.display = 'none';
    if (appFooter) appFooter.style.display = 'none';
    if (sideMenu) sideMenu.style.display = 'none';
    if (networkStatus) networkStatus.style.display = 'none';

    // *** НОВОЕ: Временно скрываем элементы названия компании и логотипа ***
    if (printHeaderTextElement) printHeaderTextElement.style.display = 'none';
    if (printHeaderImageDiv) printHeaderImageDiv.style.display = 'none';


    // Временно скрываем столбец "Удалить" в заголовке, теле и подвале таблицы внутри elementToCapture
    const actionHeaders = elementToCapture.querySelectorAll('thead th:last-child');
    const actionCells = elementToCapture.querySelectorAll('tbody td:last-child');
    const footerActionCell = elementToCapture.querySelector('tfoot td:last-child');

    actionHeaders.forEach(th => th.style.display = 'none');
    actionCells.forEach(td => td.style.display = 'none');
    if (footerActionCell) footerActionCell.style.display = 'none';

    // Определяем ширину для html2canvas на основе scrollWidth
    const captureWidth = Math.max(elementToCapture.scrollWidth, productTableElement ? productTableElement.scrollWidth : 0);
    const captureHeight = elementToCapture.scrollHeight;

    html2canvas(elementToCapture, {
        scale: 2, // Увеличиваем масштаб для лучшего качества
        logging: true,
        useCORS: true,
        width: captureWidth,   // Явно указываем ширину
        height: captureHeight, // Явно указываем высоту
        scrollY: -window.scrollY // Учитываем прокрутку, если элемент не в верхней части страницы
    }).then(canvas => {
        console.log('Снимок успешно создан на Canvas.');
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = dataUrl;

        const viewName = viewMetadata[activeViewId] ? viewMetadata[activeViewId].trim() : 'таблица';
        const filename = `${viewName.replace(/[^a-zа-я0-9]/gi, '_')}_снимок.png`;

        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        console.log('Снимок захвачен, инициировано скачивание.');

    }).catch(error => {
        console.error('Ошибка при создании снимка:', error);
        alert('Произошла ошибка при создании снимка.');
    }).finally(() => {
        // Восстанавливаем исходные встроенные стили
        elementToCapture.style.transform = originalContainerTransform;
        elementToCapture.style.width = originalContainerWidth;
        elementToCapture.style.overflowX = originalContainerOverflowX;
        elementToCapture.style.padding = originalContainerPadding;

        if (productTableElement) {
            productTableElement.style.transform = originalProductTableTransform;
            productTableElement.style.width = originalProductTableWidth;
            productTableElement.style.maxWidth = originalProductTableMaxWidth;
            productTableElement.style.tableLayout = originalProductTableTableLayout;
        }

        // Восстанавливаем display для скрытых элементов UI
        if (appHeader) appHeader.style.display = originalAppHeaderDisplay;
        if (appFooter) appFooter.style.display = originalAppFooterDisplay;
        if (sideMenu) sideMenu.style.display = originalSideMenuDisplay;
        if (networkStatus) networkStatus.style.display = originalNetworkStatusDisplay;

        // *** НОВОЕ: Восстанавливаем display стили для элементов названия компании и логотипа ***
        if (printHeaderTextElement) printHeaderTextElement.style.display = originalPrintHeaderTextDisplay;
        if (printHeaderImageDiv) printHeaderImageDiv.style.display = originalPrintHeaderImageDisplay;


        // Восстанавливаем display для столбцов "Удалить"
        actionHeaders.forEach(th => th.style.display = '');
        actionCells.forEach(td => td.style.display = '');
        if (footerActionCell) footerActionCell.style.display = '';
    });
}
// --- Функции для работы с данными Google Sheets ---
async function fetchProducts() {
   try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}?key=${API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP error! status: ${res.status}, Body: ${errorText}`);
    }
    const json = await res.json();
    if (json.values && Array.isArray(json.values)) {
        const dataRows = json.values.slice(1); // Пропускаем заголовок строки
        products = dataRows.map(r => ({
          id:      r[0] ? String(r[0]).trim() : '', // ID товара
          name:    r[1] ? String(r[1]).trim() : 'Без названия', // Название
          unit:    r[2] ? String(r[2]).trim() : '', // Единица измерения
          country: r[3] ? String(r[3]).trim() : '', // Страна
          price:   parseFormattedNumber(r[4]) // Цена (парсим сразу)
        })).filter(p => p.name !== 'Без названия' && p.name !== ''); // Фильтруем пустые или некорректные названия

        console.log('Products fetched:', products);
    } else {
        console.error('Fetched data has unexpected format:', json);
        alert('Полученные данные имеют неожиданный формат.');
    }
  } catch (error) {
    console.error('Error fetching products:', error);
    alert('Ошибка при загрузке данных товаров. Проверьте ключ API, ID таблицы и диапазон.');
  }
}

// --- Функции для работы со строками таблицы ---
function addRow(focusLastNameInput = true) {
   console.log('Adding a new row...'); // Лог вызова addRow
   const tr = document.createElement('tr');
    const rowCount = tableBody.rows.length;

    tr.innerHTML = `
        <td class="row-num">${rowCount + 1}</td>
        <td>
            <input type="text" class="name-input" autocomplete="off" placeholder="Начните вводить" />
            <div class="suggestions-dropdown"></div>
        </td>
        <td class="unit-cell"></td>
        <td class="country-cell"></td>
        <td>
            <input type="text" class="qty-input" inputmode="decimal" pattern="\\d*([.,]\\d*)?" />
        </td>
        <td class="price-cell" data-price="0">0</td>
        <td class="sum-cell" data-sum="0">0</td>
        <td><span class="delete-btn">✕</span></td>
    `;

    const nameInput = tr.querySelector('.name-input');
    const qtyInput = tr.querySelector('.qty-input');
    const delBtn = tr.querySelector('.delete-btn');
    const suggestionsDropdown = tr.querySelector('.suggestions-dropdown');

    nameInput._isSelectingSuggestion = false;

    // --- ОБРАБОТЧИКИ ДЛЯ ПОЛЯ НАИМЕНОВАНИЯ (БЕЗ PASTE - PASTE ДЕЛЕГИРОВАН) ---
    nameInput.addEventListener('input', () => updateSuggestionsUI(nameInput, suggestionsDropdown));
    // Store the value on focus
    nameInput.addEventListener('focus', () => {
        nameInput.dataset.prevValue = nameInput.value;
        updateSuggestionsUI(nameInput, suggestionsDropdown);
    });
    // Check for changes on blur and call onNameChange accordingly
    nameInput.addEventListener('blur', (e) => {
        setTimeout(() => {
            if (!nameInput._isSelectingSuggestion) {
                suggestionsDropdown.style.display = 'none';
                nameInput.setAttribute('aria-expanded', 'false');
                const previousValue = nameInput.dataset.prevValue || ''; // Get stored value
                onNameChange(tr, previousValue); // Pass previous value to onNameChange
            } else {
                 nameInput._isSelectingSuggestion = false;
            }
        }, 150); // Небольшая задержка, чтобы клик по предложению успел сработать до blur
    });
    // Removed saveAppStateToLocalStorage from change listener as onNameChange handles saving
    nameInput.addEventListener('change', () => {
        // Focus on quantity input if name is not empty
        if (nameInput.value.trim() !== '') {
            const qtyInput = tr.querySelector('.qty-input');
            if (qtyInput) {
                qtyInput.focus();
            }
        }
    });
    // Обработчики для клавиатуры (стрелки, Enter, Escape, Tab) для автодополнения
    nameInput.addEventListener('keydown', (e) => handleNameInputKeydown(e, nameInput, suggestionsDropdown));


    // --- ОБРАБОТЧИКИ ДЛЯ ПОЛЯ КОЛИЧЕСТВА (БЕЗ PASTE - PASTE ДЕЛЕГИРОВАН) ---
    qtyInput.addEventListener('input', () => onQtyChange(tr));
    qtyInput.addEventListener('blur', () => {
        const sanitizedString = sanitizeQtyInput(qtyInput);
        const finalQty = parseFormattedNumber(sanitizedString);
        // Форматируем значение при потере фокуса
        qtyInput.value = finalQty > 0 ? formatNumberDisplay(finalQty) : (sanitizedString === '0.' ? '0.' : '');
        onQtyChange(tr); // Пересчитываем после форматирования
        saveAppStateToLocalStorage(); // Сохраняем после изменения количества
    });
    // Запрет ввода нечисловых символов (кроме точки/запятой и управляющих клавиш)
    qtyInput.addEventListener('keydown', e => handleQtyInputKeydownNum(e));
    // Переход или добавление строки по Enter/Tab
    qtyInput.addEventListener('keydown', async (e) => handleQtyInputKeydownNav(e, tr, qtyInput));


    // --- ОБРАБОТЧИК УДАЛЕНИЯ СТРОКИ ---
    delBtn.addEventListener('click', () => {
        deleteRow(tr);
        saveAppStateToLocalStorage();
    });

    tableBody.appendChild(tr);

    // Устанавливаем фокус на nameInput первой новой строки по умолчанию
    if (focusLastNameInput) {
        setTimeout(() => {
            nameInput.focus();
        }, 0);
    }
     console.log('Row added. Row count:', tableBody.rows.length);
     return tr; // Возвращаем добавленную строку
}

// Modified onNameChange function to accept previousValue and check for changes
function onNameChange(tr, previousValue = '') {
   let input = tr.querySelector('.name-input');
    let inputValue = input ? input.value.trim() : '';
    let product = null;

    const unitCell = tr.querySelector('.unit-cell');
    const countryCell = tr.querySelector('.country-cell');
    const priceCell = tr.querySelector('.price-cell');
    const qtyInput = tr.querySelector('.qty-input');
    const sumCell = tr.querySelector('.sum-cell');

    // Determine if the value has changed from the previous value on focus
    const valueChanged = inputValue !== previousValue.trim();
    console.log(`onNameChange called for row ${tr.rowIndex}. Current: "${inputValue}", Previous: "${previousValue}". Value Changed: ${valueChanged}`);


    if (inputValue) {
         // Search for product by name (case-insensitive)
         product = products.find(p => p.name.toLowerCase() === inputValue.toLowerCase());

         // If not found by name, and input looks like an ID, search by ID
         if (!product && /^\d+$/.test(inputValue)) {
             product = products.find(p => p.id && p.id.trim() === inputValue.trim());
         }
    }

    if (product) {
        // Product found
        tr.dataset.productId = product.id; // Save ID
        input.value = product.name; // Set the found product name

        // Always update linked cells with product data
        unitCell.textContent = product.unit;
        countryCell.textContent = product.country;
        priceCell.dataset.price = product.price;
        priceCell.textContent = formatNumberDisplay(product.price);

        // Clear quantity and sum ONLY if the value changed before blur
        if (valueChanged) {
            console.log('Product found and value changed. Clearing qty/sum.');
            qtyInput.value = '';
            sumCell.dataset.sum = 0;
            sumCell.textContent = formatNumberDisplay(0);
        } else {
             console.log('Product found, but value did not change. Keeping current qty/sum.');
             // If value didn't change and product is the same (or was already found),
             // keep the existing quantity and sum. Recalculate sum based on current qty and price.
             const currentQty = parseFormattedNumber(qtyInput.value);
             const currentPrice = parseFloat(priceCell.dataset.price) || 0;
             const newSum = currentQty * currentPrice;
             sumCell.dataset.sum = newSum;
             sumCell.textContent = formatNumberDisplay(newSum);
        }

        input.classList.remove('input-error'); // Remove error class
    } else {
        // Product not found
         delete tr.dataset.productId; // Remove ID

         // Clear linked cells (unit, country, price, sum) and quantity
         // ONLY if the value changed OR if the input is currently empty.
         // If value did NOT change AND is NOT empty, we keep existing data (including error state if any).
         if (valueChanged || inputValue === '') {
              console.log('Product not found, and value changed or is empty. Clearing all linked cells.');
              // Clear unit, country, price, sum
              unitCell.textContent = '';
              countryCell.textContent = '';
              priceCell.dataset.price = 0;
              priceCell.textContent = formatNumberDisplay(0);

              // Clear quantity
              qtyInput.value = '';
              sumCell.dataset.sum = 0;
              sumCell.textContent = formatNumberDisplay(0);
         } else {
              console.log('Product not found, but value did not change and is not empty. Keeping existing data.');
              // If value didn't change and no product is found (meaning the previously entered text
              // also didn't match a product), keep the existing text, quantity, unit, country, price, and sum.
              // The error class should already be present if the text is not empty and doesn't match.
         }


         // Add or remove error class based on the *current* input value
         // If the current value is not empty and doesn't match any product, add error class.
         // If it's empty, remove error class.
         if (inputValue !== '' && !products.some(p => p.name.toLowerCase() === inputValue.toLowerCase() || (p.id && p.id.trim() === inputValue.trim()))) {
            input.classList.add('input-error');
         } else {
            input.classList.remove('input-error');
         }
    }

    recalcTotal(); // Recalculate total sum
    saveAppStateToLocalStorage(); // Save application state
}

function onQtyChange(tr) {
    const qtyInput = tr.querySelector('.qty-input');
    const priceCell = tr.querySelector('.price-cell');
    const sumCell = tr.querySelector('.sum-cell');

    const price = parseFloat(priceCell.dataset.price) || 0; // Получаем цену из data-атрибута
    const quantity = parseFormattedNumber(qtyInput.value); // Парсим количество из поля ввода

    const sum = price * quantity; // Рассчитываем сумму

    sumCell.dataset.sum = sum; // Сохраняем сумму в data-атрибуте
    sumCell.textContent = formatNumberDisplay(sum); // Отображаем отформатированную сумму

    recalcTotal(); // Пересчитываем общую сумму
    saveAppStateToLocalStorage(); // Сохраняем состояние
}

function deleteRow(tr) {
    // Если строк больше одной, удаляем текущую
    if (tableBody.rows.length > 1) {
        tr.remove(); // Удаляем элемент строки из DOM
        renumberRows(); // Перенумеровываем оставшиеся строки
    } else {
        // Если это единственная строка, просто очищаем ее поля
        const nameInput = tr.querySelector('.name-input');
        const qtyInput = tr.querySelector('.qty-input');
        const unitCell = tr.querySelector('.unit-cell');
        const countryCell = tr.querySelector('.country-cell');
        const priceCell = tr.querySelector('.price-cell');
        const sumCell = tr.querySelector('.sum-cell');

        if (nameInput) nameInput.value = '';
        if (qtyInput) qtyInput.value = '';
        if(unitCell) unitCell.textContent = '';
        if(countryCell) countryCell.textContent = '';
        if(priceCell) { priceCell.dataset.price = 0; priceCell.textContent = formatNumberDisplay(0); }
        if(sumCell) { sumCell.dataset.sum = 0; sumCell.textContent = formatNumberDisplay(0); }
        delete tr.dataset.productId; // Удаляем ID товара

        // Убираем класс ошибки, если он был
        if (nameInput) nameInput.classList.remove('input-error');
    }
    recalcTotal(); // Пересчитываем общую сумму
    saveAppStateToLocalStorage(); // Сохраняем состояние
}

function renumberRows() {
   // Обновляем номера строк в первой колонке
   tableBody.querySelectorAll('tr').forEach((tr, i) => {
    const rowNumCell = tr.querySelector('.row-num');
    if (rowNumCell) {
      rowNumCell.textContent = i + 1;
    }
  });
}

function recalcTotal() {
   // Рассчитываем общую сумму по всем строкам
   const sumCells = tableBody.querySelectorAll('.sum-cell');
  let total = 0;

  sumCells.forEach(td => {
    total += parseFloat(td.dataset.sum) || 0; // Суммируем значения из data-атрибутов
  });

  totalSumCell.dataset.total = total; // Сохраняем общую сумму в data-атрибуте
  totalSumCell.textContent = formatNumberDisplay(total); // Отображаем отформатированную общую сумму
}

function sanitizeQtyInput(qtyInput) {
     let v = qtyInput.value.trim();
    if (v === '') return '';

    v = v.replace(',', '.'); // Заменяем запятую на точку
    v = v.replace(/[^0-9.]/g, ''); // Удаляем все, кроме цифр и точки
    v = v.replace(/^0+(?=\d)/, ''); // Удаляем начальные нули, если за ними следует цифра (например, 007 -> 7)

    // Обработка множественных точек
    const parts = v.split('.');
    if (parts.length > 2) {
        v = parts[0] + '.' + parts.slice(1).join(''); // Оставляем только первую точку
    }

    // Если осталась только точка или нули с точкой (например, "."), преобразуем в "0."
    if (v === '.' || /^0*\.$/.test(v)) v = '0.';

    // Если строка заканчивается на точку и перед ней нет цифр (например, "abc."), удаляем точку
     if (v.endsWith('.') && v.length > 1 && !/\d/.test(v.slice(0, -1))) {
         v = v.slice(0, -1);
     } else if (v.endsWith('.') && v.length === 1 && v[0] !== '0') { // Если осталась только одна точка не после нуля
         v = ''; // Очищаем
     }


    // Дополнительная проверка для случая "0" или "0."
     if (v !== '' && parseFloat(v) === 0) {
         const originalValue = qtyInput.value.trim().replace(',', '.');
         // Если исходное значение было просто "0" или "0.", и результат не "0.", очищаем
         if (/^0+\.?0*$/.test(originalValue) && v !== '0.') {
             v = '';
         }
     }


  return v;
}


// --- Функции для повторной привязки обработчиков (НЕ ВКЛЮЧАЯ PASTE) ---
function reAttachEventListenersToRows() {
    console.log('Re-attaching non-paste event listeners to rows...');
    tableBody.querySelectorAll('tr').forEach(tr => {
        const nameInput = tr.querySelector('.name-input');
        const qtyInput = tr.querySelector('.qty-input');
        const delBtn = tr.querySelector('.delete-btn');
        const suggestionsDropdown = tr.querySelector('.suggestions-dropdown');

        // Удаляем старые и добавляем новые НЕ-PASTE обработчики для nameInput
        if (nameInput && suggestionsDropdown) {
            console.log('Attaching non-paste listeners to nameInput in row:', tr.rowIndex);
            if (nameInput._inputHandler) nameInput.removeEventListener('input', nameInput._inputHandler);
            if (nameInput._focusHandler) nameInput.removeEventListener('focus', nameInput._focusHandler);
            if (nameInput._blurHandler) nameInput.removeEventListener('blur', nameInput._blurHandler);
            if (nameInput._changeHandler) nameInput.removeEventListener('change', nameInput._changeHandler);
            if (nameInput._keydownHandler) nameInput.removeEventListener('keydown', nameInput._keydownHandler);
             // Убедимся, что _pasteHandler не сохраняется в этом scope
            delete nameInput._pasteHandler;


            // Сохраняем ссылки на новые обработчики
            nameInput._inputHandler = () => updateSuggestionsUI(nameInput, suggestionsDropdown);
            nameInput._focusHandler = () => {
                 nameInput.dataset.prevValue = nameInput.value; // Store value on focus
                 updateSuggestionsUI(nameInput, suggestionsDropdown);
            };
            nameInput._blurHandler = (e) => {
                setTimeout(() => {
                    if (!nameInput._isSelectingSuggestion) {
                        suggestionsDropdown.style.display = 'none';
                        nameInput.setAttribute('aria-expanded', 'false');
                        const previousValue = nameInput.dataset.prevValue || ''; // Get stored value
                        onNameChange(tr, previousValue); // Pass previous value
                    } else {
                         nameInput._isSelectingSuggestion = false;
                    }
                }, 150);
            };
            // Removed saveAppStateToLocalStorage from change listener as onNameChange handles saving
             nameInput._changeHandler = () => {
                 if (nameInput.value.trim() !== '') {
                     const qtyInput = tr.querySelector('.qty-input');
                     if (qtyInput) {
                         qtyInput.focus();
                     }
                 }
            };
             nameInput._keydownHandler = (e) => handleNameInputKeydown(e, nameInput, suggestionsDropdown);


            // Привязываем НЕ-PASTE обработчики
            nameInput.addEventListener('input', nameInput._inputHandler);
            nameInput.addEventListener('focus', nameInput._focusHandler);
            nameInput.addEventListener('blur', nameInput._blurHandler);
            nameInput.addEventListener('change', nameInput._changeHandler);
            nameInput.addEventListener('keydown', nameInput._keydownHandler);

            // Привязываем обработчики к элементам предложений (если они есть)
             suggestionsDropdown.querySelectorAll('.suggestion-item').forEach(item => {
                 // Remove existing handlers first if they were attached directly to items
                 // (Though the addSuggestionItemListeners function handles this when creating)
                 // For safety, if needed, detach here before re-attaching.
                 // Assuming addSuggestionItemListeners is the only place mousedown/click are attached
                 // and it's called within updateSuggestionsUI, these persistent listeners
                 // are handled by re-creating the dropdown content.

                 // We need to re-attach the specific handler logic that calls onNameChange with previousValue
                 if (item._mousedownHandler) item.removeEventListener('mousedown', item._mousedownHandler);
                 if (item._clickHandler) item.removeEventListener('mousedown', item._clickHandler); // Click was mousedown


                 item._mousedownHandler = () => { nameInput._isSelectingSuggestion = true; };
                  // Use mousedown for suggestion click handling as before, and pass prevValue
                 item._clickHandler = () => {
                     console.log('Re-attached suggestion item clicked (mousedown).');
                      try {
                          const selectedProduct = {
                              id: item.dataset.productId,
                              name: item.dataset.productName,
                              unit: item.dataset.productUnit,
                              country: item.dataset.productCountry,
                              price: parseFormattedNumber(item.dataset.productPrice)
                          };
                          nameInput.value = selectedProduct.name;
                           // Pass previousValue here too, as selecting a suggestion IS a change
                           onNameChange(tr, nameInput.dataset.prevValue || '');
                          nameInput._isSelectingSuggestion = false;
                          const qtyInput = tr.querySelector('.qty-input');
                          if (qtyInput) {
                              // Переводим фокус на поле количества с небольшой задержкой
                              setTimeout(() => {
                                  qtyInput.focus();
                              }, 0);
                          }

                      } catch (error) {
                          console.error('Error during re-attached suggestion mousedown handler:', error);
                          nameInput._isSelectingSuggestion = false;
                      }
                 };


                 item.addEventListener('mousedown', item._mousedownHandler);
                 item.addEventListener('mousedown', item._clickHandler); // Still use mousedown for click-like behavior
             });
        }

        // Удаляем старые и добавляем новые НЕ-PASTE обработчики для qtyInput
        if (qtyInput) {
             console.log('Attaching non-paste listeners to qtyInput in row:', tr.rowIndex);
             if (qtyInput._inputHandler) qtyInput.removeEventListener('input', qtyInput._inputHandler);
             if (qtyInput._blurHandler) qtyInput.removeEventListener('blur', qtyInput._blurHandler);
             if (qtyInput._keydownNumHandler) qtyInput.removeEventListener('keydown', qtyInput._keydownNumHandler);
             if (qtyInput._keydownNavHandler) qtyInput.removeEventListener('keydown', qtyInput._keydownNavHandler);
            // Убедимся, что _pasteHandler не сохраняется в этом scope
            delete qtyInput._pasteHandler;


             qtyInput._inputHandler = () => onQtyChange(tr);
             qtyInput._blurHandler = () => {
                const sanitizedString = sanitizeQtyInput(qtyInput);
                const finalQty = parseFormattedNumber(sanitizedString);
                qtyInput.value = finalQty > 0 ? formatNumberDisplay(finalQty) : (sanitizedString === '0.' ? '0.' : '');
                onQtyChange(tr);
                saveAppStateToLocalStorage();
            };
             qtyInput._keydownNumHandler = (e) => handleQtyInputKeydownNum(e);
             qtyInput._keydownNavHandler = (e) => handleQtyInputKeydownNav(e, tr, qtyInput);

             // Привязываем НЕ-PASTE обработчики
             qtyInput.addEventListener('input', qtyInput._inputHandler);
             qtyInput.addEventListener('blur', qtyInput._blurHandler);
             qtyInput.addEventListener('keydown', qtyInput._keydownNumHandler);
             qtyInput.addEventListener('keydown', qtyInput._keydownNavHandler);

             console.log('Non-paste listeners ADDED to qtyInput in row:', tr.rowIndex, qtyInput);
        }

        // Удаляем старые и добавляем новые обработчики для кнопки удаления
        if (delBtn) {
            if (delBtn._clickHandler) delBtn.removeEventListener('click', delBtn._clickHandler);
            delBtn._clickHandler = () => {
                 deleteRow(tr);
                 saveAppStateToLocalStorage();
             };
            delBtn.addEventListener('click', delBtn._clickHandler);
        }
    });
     console.log('Non-paste event listeners re-attached completed.');
}


// НУЖНЫ ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ-ОБЕРТКИ ДЛЯ ОБРАБОТЧИКОВ КЛАВИАТУРЫ И АВТОДОПОЛНЕНИЯ
function handleNameInputKeydown(e, nameInput, suggestionsDropdown) {
    const items = suggestionsDropdown.querySelectorAll('.suggestion-item');
    let currentActiveIndex = -1;
    const currentActive = suggestionsDropdown.querySelector('.active-suggestion');
    if (currentActive) {
        currentActiveIndex = Array.from(items).indexOf(currentActive);
    }

    switch (e.key) {
        case 'ArrowDown':
            e.preventDefault();
            if (items.length > 0) {
                if (currentActive) currentActive.classList.remove('active-suggestion');
                const nextIndex = (currentActiveIndex + 1) % items.length;
                items[nextIndex].classList.add('active-suggestion');
                items[nextIndex].scrollIntoView({ block: 'nearest' });
                nameInput.setAttribute('aria-activedescendant', items[nextIndex].id);
            }
            break;
        case 'ArrowUp':
            e.preventDefault();
            if (items.length > 0) {
                if (currentActive) currentActive.classList.remove('active-suggestion');
                const prevIndex = (currentActiveIndex - 1 + items.length) % items.length;
                items[prevIndex].classList.add('active-suggestion');
                items[prevIndex].scrollIntoView({ block: 'nearest' });
                nameInput.setAttribute('aria-activedescendant', items[prevIndex].id);
            }
            break;
        case 'Enter':
            if (currentActive) {
                e.preventDefault();
                // Use mousedown to trigger the suggestion selection logic
                const mousedownEvent = new MouseEvent('mousedown', {
                    bubbles: true,
                    cancelable: true,
                    view: window
                });
                currentActive.dispatchEvent(mousedownEvent);

            } else if (nameInput.value.trim() !== '') {
                 e.preventDefault();
                 // Если нет активного предложения, но есть введенный текст, переходим к полю количества
                 const tr = nameInput.closest('tr');
                 const qtyInput = tr.querySelector('.qty-input');
                 if(qtyInput) qtyInput.focus();
            }
            break;
        case 'Escape':
            suggestionsDropdown.style.display = 'none';
            nameInput.setAttribute('aria-expanded', 'false');
             nameInput.removeAttribute('aria-activedescendant');
            break;
        case 'Tab':
             // Таб также должен закрывать предложения перед переходом
            suggestionsDropdown.style.display = 'none';
            nameInput.setAttribute('aria-expanded', 'false');
             nameInput.removeAttribute('aria-activedescendant');
            break;
    }
}

// Обработчик клика по предложению для повторно привязанных слушателей (using mousedown)
// This function is actually integrated into the mousedown handler in reAttachEventListenersToRows now.
// Leaving it here for reference but it's not called directly anymore.
/*
function handleSuggestionClick(itemElement, nameInput, tr) {
    console.log('Re-attached suggestion item clicked.');
     try {
         const selectedProduct = {
             id: itemElement.dataset.productId,
             name: itemElement.dataset.productName,
             unit: itemElement.dataset.productUnit,
             country: itemElement.dataset.productCountry,
             price: parseFormattedNumber(itemElement.dataset.productPrice)
         };
         nameInput.value = selectedProduct.name;
         // Pass previousValue here too, as selecting a suggestion IS a change
         onNameChange(tr, nameInput.dataset.prevValue || '');
         nameInput._isSelectingSuggestion = false; // Сбрасываем флаг
         const qtyInput = tr.querySelector('.qty-input');
         if (qtyInput) {
             qtyInput.focus(); // Переводим фокус на поле количества

         }

     } catch (error) {
         console.error('Error during re-attached suggestion click:', error);
         nameInput._isSelectingSuggestion = false;
     }
}
*/

// Обработчик ввода символов для поля количества (разрешает только числа, точку, запятую)
function handleQtyInputKeydownNum(e) {
     // Разрешенные клавиши: цифры, точка, запятая, Backspace, стрелки, Delete, Ctrl+C/V/X/A/Z
     const allowedKeys = ['0','1','2','3','4','5','6','7','8','9','. ',',','Backspace','ArrowLeft','ArrowRight','Delete','Tab','Enter'];
     // Разрешаем стандартные сочетания с Ctrl/Cmd
     if (e.ctrlKey || e.metaKey) {
         if (['a', 'c', 'v', 'x', 'z'].includes(e.key.toLowerCase())) return;
     }
     // Если клавиша не разрешена и это не управляющая клавиша, предотвращаем действие
     if (!allowedKeys.includes(e.key) && e.key.length === 1) {
         e.preventDefault();
     }
}

// Обработчик нажатия Enter/Tab для поля количества (переход на следующую строку)
async function handleQtyInputKeydownNav(e, tr, qtyInput) {
     if (e.key === 'Enter' || e.key === 'Tab') {
         e.preventDefault();
         const nextRow = tr.nextElementSibling;
         if (!nextRow) {
             // Если текущая строка последняя, добавляем новую и фокусируем ее поле имени
             const newRow = addRow(true); // addRow(true) фокусирует nameInput новой строки
         } else {
             // Если следующая строка существует, фокусируем ее поле имени
             const nextNameInput = nextRow.querySelector('.name-input');
             if (nextNameInput) nextNameInput.focus();
         }
     }
}


// --- Функции для управления видами и меню ---

function openMenu() {
    sideMenu.classList.add('open');
    document.body.classList.add('menu-open');
}

function closeMenu() {
    sideMenu.classList.remove('open');
    document.body.classList.remove('menu-open');
    closeAllActionDropdowns(); // Закрываем все выпадающие меню действий при закрытии основного меню
}

// Переключение на другой вид
function switchView(newViewId) {
    if (newViewId === activeViewId) {
        closeMenu();
        return;
    }

    console.log(`Switching from view ${activeViewId} to ${newViewId}`);

    // 1. Сохраняем текущее состояние tbody перед переключением
    // Обновляем атрибуты 'value' у инпутов ПЕРЕД сохранением innerHTML
    tableBody.querySelectorAll('tr').forEach(tr => {
        const nameInput = tr.querySelector('.name-input');
        const qtyInput = tr.querySelector('.qty-input');
        if (nameInput) {
            nameInput.setAttribute('value', nameInput.value);
        }
        if (qtyInput) {
            qtyInput.setAttribute('value', qtyInput.value);
        }
    });
    viewStates[activeViewId] = tableBody.innerHTML;
    console.log(`Saved state for ${activeViewId}:`, viewStates[activeViewId] ? viewStates[activeViewId].substring(0, 100) + '...' : 'EMPTY');

    // 2. Обновляем активный ID
    activeViewId = newViewId;

    // 3. Загружаем состояние нового вида
    const newHtml = viewStates[activeViewId];
    console.log(`Loading state for ${activeViewId}:`, newHtml ? newHtml.substring(0, 100) + '...' : 'EMPTY');

    tableBody.innerHTML = newHtml || ''; // Вставляем сохраненный HTML или пустую строку

    // 4. Если для нового вида нет сохраненного состояния (он новый или пустой)
    if (!newHtml) {
        addRow(true); // Добавляем одну пустую строку и фокусируем ее
    } else {
        // 5. ПОВТОРНО ПРИВЯЗЫВАЕМ ОБРАБОТЧИКИ к загруженным строкам (теперь без paste)
        reAttachEventListenersToRows();
    }

    // 6. Обновляем нумерацию строк и итоговую сумму для нового вида
    renumberRows();
    recalcTotal();

    // 7. Обновляем выделение активного элемента в меню
    const currentActiveElement = viewList.querySelector('.active-view');
    if (currentActiveElement) {
        currentActiveElement.classList.remove('active-view');
    }
    const newActiveElement = viewList.querySelector(`.view-item[data-view-id="${activeViewId}"]`);
    if (newActiveElement) {
        newActiveElement.classList.add('active-view');
    } else {
        console.warn(`Active view element for ID ${activeViewId} not found in menu.`);
    }

    // Обновляем заголовок над таблицей
    updateCurrentViewNameDisplay();

    // 8. Закрываем меню после выбора
    closeMenu();

    // Сохраняем состояние приложения после переключения вида
    saveAppStateToLocalStorage();
}

// Обновление текста заголовка над таблицей
function updateCurrentViewNameDisplay() {
     const viewName = viewMetadata[activeViewId] || 'Текущий список'; // Берем имя из метаданных или дефолт
    if (currentViewNameElement) {
        currentViewNameElement.textContent = viewName;
    }
}

// Добавление нового вида в меню и инициализация
function addNewView() {
    // Генерируем уникальный ID и имя для нового вида
    const newViewId = `view-${nextViewIdCounter++}`;
    const newViewName = `Список ${nextViewIdCounter - 1}`;

    // Создаем новый элемент списка в DOM
    const listItem = document.createElement('li');
    listItem.classList.add('view-item');
    listItem.dataset.viewId = newViewId; // Сохраняем ID как data-атрибут
    listItem.innerHTML = `
        <span>${newViewName}</span>
        <div class="view-actions">
            <button class="ellipsis-btn" aria-label="Действия"><i class="fas fa-ellipsis-v"></i></button>
            <div class="actions-dropdown">
                <a href="#" class="rename-action">Переименовать</a>
                <a href="#" class="copy-action">Копировать</a>
                <a href="#" class="delete-action">Удалить</a>
            </div>
        </div>
    `;

    // Добавляем обработчики для нового элемента списка
    addEventListenersToViewItem(listItem);

    // Добавляем элемент в конец списка
    viewList.appendChild(listItem);

    // Инициализируем пустое состояние и сохраняем метаданные для нового вида
    viewStates[newViewId] = ''; // Пустой tbody
    viewMetadata[newViewId] = newViewName;

    // Переключаемся на новый вид (он будет создан с помощью addRow внутри switchView)
    switchView(newViewId);
    closeAllActionDropdowns(); // Закрываем любые открытые меню действий
    // Сохраняем состояние приложения после добавления нового вида
    saveAppStateToLocalStorage();
}

// Переименование вида
function renameView(viewItem) {
    const viewId = viewItem.dataset.viewId;
    const span = viewItem.querySelector('span');
    const currentName = viewMetadata[viewId] || span.textContent; // Берем имя из метаданных или из DOM
    const newName = prompt('Введите новое имя для списка:', currentName); // Запрашиваем новое имя у пользователя

    if (newName && newName.trim() !== '' && newName !== currentName) {
        const trimmedName = newName.trim();
        span.textContent = trimmedName; // Обновляем текст в DOM
        viewMetadata[viewId] = trimmedName; // Обновляем имя в метаданных
        console.log(`View ${viewId} renamed to ${trimmedName}`);
        // Обновляем заголовок над таблицей, если переименован текущий активный список
        if (viewId === activeViewId) {
             updateCurrentViewNameDisplay();
        }
        // Сохраняем состояние приложения после переименования
        saveAppStateToLocalStorage();
    }
    closeAllActionDropdowns(viewItem.querySelector('.actions-dropdown')); // Закрываем dropdown
}

// Копирование вида
function copyView(viewItem) {
    const sourceViewId = viewItem.dataset.viewId;
    const sourceName = viewMetadata[sourceViewId] || viewItem.querySelector('span').textContent; // Берем имя из метаданных

    // Получаем HTML текущего или сохраненного состояния исходного вида
    // Сначала обновляем атрибуты 'value' в исходном представлении, если оно активно,
    // чтобы скопировать актуальные данные из полей ввода
    if (sourceViewId === activeViewId) {
         tableBody.querySelectorAll('tr input').forEach(input => {
             input.setAttribute('value', input.value);
         });
         viewStates[sourceViewId] = tableBody.innerHTML;
    }
    let sourceHtml = viewStates[sourceViewId] || ''; // Берем HTML из viewStates

    // Создаем новый ID и имя для копии
    const newViewId = `view-${nextViewIdCounter++}`;
    const newViewName = `${sourceName} (Копия)`;

    // Создаем новый элемент списка в DOM для копии
    const listItem = document.createElement('li');
    listItem.classList.add('view-item');
    listItem.dataset.viewId = newViewId;
    listItem.innerHTML = `
        <span>${newViewName}</span>
        <div class="view-actions">
            <button class="ellipsis-btn" aria-label="Действия"><i class="fas fa-ellipsis-v"></i></button>
            <div class="actions-dropdown">
                <a href="#" class="rename-action">Переименовать</a>
                <a href="#" class="copy-action">Копировать</a>
                <a href="#" class="delete-action">Удалить</a>
            </div>
        </div>
    `;
    addEventListenersToViewItem(listItem); // Привязываем обработчики
    viewList.appendChild(listItem); // Добавляем в DOM

    // Копируем HTML состояние и сохраняем метаданные
    viewStates[newViewId] = sourceHtml;
    viewMetadata[newViewId] = newViewName;
    console.log(`View ${sourceViewId} HTML copied to ${newViewId}`);

    switchView(newViewId); // Переключаемся на новую копию
    closeAllActionDropdowns(); // Закрываем dropdown
    // Сохраняем состояние приложения после копирования
    saveAppStateToLocalStorage();
}

// Удаление вида
function deleteView(viewItem) {
    const viewIdToDelete = viewItem.dataset.viewId;

    // Не удаляем, если остался только один список
    if (Object.keys(viewStates).length <= 1) {
        alert('Нельзя удалить последний список.');
        closeAllActionDropdowns(viewItem.querySelector('.actions-dropdown')); // Закрываем dropdown
        return;
    }

    const viewName = viewMetadata[viewIdToDelete] || viewItem.querySelector('span').textContent; // Берем имя из метаданных

    // Запрашиваем подтверждение у пользователя
    if (confirm(`Вы уверены, что хотите удалить список "${viewName}"?`)) {
        // Удаляем состояние и метаданные из хранилищ
        delete viewStates[viewIdToDelete];
        delete viewMetadata[viewIdToDelete];

        // Удаляем элемент из списка в DOM
        viewItem.remove();
        console.log(`View ${viewIdToDelete} deleted`);

        // Если удалили активный вид, переключаемся на первый оставшийся в списке
        if (activeViewId === viewIdToDelete) {
            const firstViewItem = viewList.querySelector('.view-item');
            if (firstViewItem) {
                // switchView сам обновит activeViewId, загрузит состояние и сохранит
                switchView(firstViewItem.dataset.viewId);
            } else {
                // Этот случай маловероятен из-за проверки на количество списков,
                // но если вдруг остался 0 списков, сбрасываем состояние
                activeViewId = null;
                tableBody.innerHTML = '';
                recalcTotal();
                if (currentViewNameElement) {
                     currentViewNameElement.textContent = '';
                 }
                 saveAppStateToLocalStorage(); // Сохраняем пустое состояние
            }
        }
        // Если удалили неактивный вид, просто обновляем отображение имени текущего и сохраняем
        else {
            updateCurrentViewNameDisplay();
            saveAppStateToLocalStorage();
        }
    }
     closeAllActionDropdowns(); // Закрываем dropdown
}


// Добавление обработчиков событий к элементу вида (в меню)
function addEventListenersToViewItem(viewItem) {
    // Клик по самому элементу (переключение вида)
    viewItem.addEventListener('click', (e) => {
        // Проверяем, что клик не был сделан внутри блока .view-actions
        if (!e.target.closest('.view-actions')) {
            switchView(viewItem.dataset.viewId); // Переключаем вид по ID из data-атрибута
        }
    });

    // Клик по кнопке троеточия (открытие/закрытие выпадающего меню действий)
    const ellipsisBtn = viewItem.querySelector('.ellipsis-btn');
    const dropdown = viewItem.querySelector('.actions-dropdown');
    ellipsisBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Останавливаем распространение события, чтобы не сработал клик по viewItem
        closeAllActionDropdowns(dropdown); // Закрываем все другие dropdown'ы
        dropdown.classList.toggle('show'); // Переключаем класс 'show' для отображения/скрытия текущего dropdown
    });

    // Клики по действиям в выпадающем меню
    viewItem.querySelector('.rename-action').addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation(); renameView(viewItem); // Предотвращаем переход по ссылке
    });
    viewItem.querySelector('.copy-action').addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation(); copyView(viewItem);
    });
    viewItem.querySelector('.delete-action').addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation(); deleteView(viewItem);
    });
}

// Закрытие всех выпадающих меню действий (кроме одного, если указано)
function closeAllActionDropdowns(excludeDropdown = null) {
    viewList.querySelectorAll('.actions-dropdown.show').forEach(dropdown => {
        if (dropdown !== excludeDropdown) {
            dropdown.classList.remove('show');
        }
    });
}

// Закрытие меню и dropdown'ов при клике вне них
document.addEventListener('click', (e) => {
     // Если клик был вне блока .view-actions, закрываем все dropdown'ы действий
     if (!e.target.closest('.view-actions')) {
        closeAllActionDropdowns();
     }
     // Если меню открыто и клик был вне меню и кнопки его переключения, закрываем меню
     if (sideMenu.classList.contains('open') && !e.target.closest('.side-menu') && !e.target.closest('.menu-toggle-btn')) {
        closeMenu();
     }
});


// --- Инициализация приложения ---

async function initializeApp() {
    console.log('Initializing application...');
    // 1. Привязываем обработчики меню
menuToggleBtn.addEventListener('click', () => {
    sideMenu.classList.add('open'); // Opens the sidebar
    document.body.classList.add('menu-open'); // Add class to body
});
    closeMenuBtn.addEventListener('click', closeMenu);
    addViewBtn.addEventListener('click', addNewView); // Привязываем добавление нового вида

    // 2. Привязываем обработчики кнопок таблицы (Экспорт, Печать, Снимок)
    const exportButton = document.getElementById('export-csv');
    const printButton = document.getElementById('print-table');
    const snapshotButton = document.getElementById('snapshot-table');
    if (exportButton) exportButton.addEventListener('click', exportTableToCsv);
    if (printButton) printButton.addEventListener('click', printTable);
    if (snapshotButton) snapshotButton.addEventListener('click', captureTableSnapshot);

    // 3. Привязываем обработчик FAB (кнопки "Добавить строку")
    fabButton.addEventListener('click', () => {
        addRow(false); // Добавляем строку без фокуса на новом поле
        saveAppStateToLocalStorage(); // Сохраняем после добавления строки
    });

    // 4. Инициализация итоговой суммы в подвале таблицы
    totalSumCell.dataset.total = 0;
    totalSumCell.textContent = formatNumberDisplay(0);

    // 5. Загружаем общие данные товаров (асинхронно)
    await fetchProducts();

    // 6. Обновляем статус сети
    updateNetworkStatus();

    // 7. Устанавливаем текущую дату в шапке для печати (если элемент существует)
    const dateElement = document.querySelector('.print-header-text .print-date');
    if (dateElement) {
        const today = new Date();
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        const formattedDate = today.toLocaleDateString('ru-RU', options);
        dateElement.textContent = formattedDate;
        console.log('Дата вставлена при инициализации:', formattedDate);
    }

    // --- НОВОЕ: Делегированный обработчик события PASTE для всей таблицы ---
    // Привязываем один обработчик paste к tableBody
tableBody.addEventListener('paste', async (event) => {
    const targetInput = event.target;

    // Check if the paste target is a 'name-input' or 'qty-input'
    if (targetInput.tagName === 'INPUT' && (targetInput.classList.contains('name-input') || targetInput.classList.contains('qty-input'))) {
        event.preventDefault(); // Prevent default paste behavior

        const pasteData = event.clipboardData.getData('text');

        // For debugging mobile clipboard content (RECOMMENDED during testing)
        console.log("Mobile Paste - Raw Data:", pasteData);
        console.log("Mobile Paste - JSON.stringified Data:", JSON.stringify(pasteData));

        // Use a more robust method to split lines, handling various newline chars
        // and filtering out lines that are empty after trimming.
        const lines = pasteData.split(/[\r\n]+/).filter(line => line.trim() !== '');

        if (lines.length === 0) {
            console.log('No valid lines to paste.');
            return;
        }

        let currentRow = targetInput.closest('tr');
        console.log(`Paste detected on input in row ${currentRow ? currentRow.rowIndex : 'unknown'}. Processing ${lines.length} lines.`);

        const isNameTargetInitial = targetInput.classList.contains('name-input');
        const isQtyTargetInitial = targetInput.classList.contains('qty-input');

        for (let i = 0; i < lines.length; i++) {
            const lineContent = lines[i]; // Use the untrimmed line for quantity, trim for name.
            let currentCellInput;

            if (i === 0) {
                // First line goes into the initially targeted input field
                currentCellInput = targetInput;
            } else {
                // For subsequent lines, add a new row
                addRow(false); // Adds a new row to the table
                currentRow = tableBody.lastElementChild; // Get the newly added row
                if (!currentRow) {
                    console.warn('Failed to add or find new row for pasting.');
                    continue; // Skip if row creation failed
                }

                // Find the corresponding input field in the new row based on the *initial* target type
                if (isNameTargetInitial) {
                    currentCellInput = currentRow.querySelector('.name-input');
                } else if (isQtyTargetInitial) {
                    currentCellInput = currentRow.querySelector('.qty-input');
                }
            }

            if (currentCellInput) {
                if (currentCellInput.classList.contains('name-input')) {
                    currentCellInput.value = lineContent.trim(); // Trim for name input
                    console.log(`Pasted Name "${lineContent.trim()}" into row ${currentRow.rowIndex} name input.`);
                    onNameChange(currentRow, ''); // Force update, assuming value changed
                } else if (currentCellInput.classList.contains('qty-input')) {
                    // For quantity, set the raw value first, then sanitize and format
                    currentCellInput.value = lineContent; // Use untrimmed lineContent
                    const sanitizedValue = sanitizeQtyInput(currentCellInput); // sanitizeQtyInput expects the input element
                    const numericValue = parseFormattedNumber(sanitizedValue);
                    currentCellInput.value = numericValue > 0 ? formatNumberDisplay(numericValue) : (sanitizedValue === '0.' ? '0.' : '');
                    console.log(`Pasted Qty "${currentCellInput.value}" (parsed as ${numericValue}) into row ${currentRow.rowIndex} qty input.`);
                    onQtyChange(currentRow);
                }
                // Dispatch an input event to trigger other potential listeners (e.g., for suggestions)
                currentCellInput.dispatchEvent(new Event('input', { bubbles: true }));
            } else {
                console.warn(`Target input not found for line "${lineContent}" in row ${currentRow ? currentRow.rowIndex : 'N/A'}.`);
            }
        }

        // After processing all lines, recalculate total and save state
        recalcTotal();
        console.log('Recalculated total after paste.');
        saveAppStateToLocalStorage();
        console.log('App state saved after paste.');
    }
});
console.log('Delegated paste listener added to tableBody.');
// --- END OF CORRECTED PASTE EVENT LISTENER ---



    // --- Загрузка данных из localStorage ---
    const dataLoaded = loadAppStateFromLocalStorage();

    if (dataLoaded) {
       // ... (существующий код загрузки из localStorage, восстановления списка видов и innerHTML) ...
        console.log('Data loaded from localStorage. Restoring views.');
        viewList.innerHTML = '';
        for (const viewId in viewMetadata) {
            if (viewMetadata.hasOwnProperty(viewId)) {
                 const viewName = viewMetadata[viewId];
                 const listItem = document.createElement('li');
                 listItem.classList.add('view-item');
                 if (viewId === activeViewId) {
                     listItem.classList.add('active-view');
                 }
                 listItem.dataset.viewId = viewId;
                 listItem.innerHTML = `
                    <span>${viewName}</span>
                    <div class="view-actions">
                        <button class="ellipsis-btn" aria-label="Действия"><i class="fas fa-ellipsis-v"></i></button>
                        <div class="actions-dropdown">
                            <a href="#" class="rename-action">Переименовать</a>
                            <a href="#" class="copy-action">Копировать</a>
                            <a href="#" class="delete-action">Удалить</a>
                        </div>
                    </div>
                 `;
                 addEventListenersToViewItem(listItem);
                 viewList.appendChild(listItem);
            }
        }

         // Загружаем HTML контент для активного вида
         tableBody.innerHTML = viewStates[activeViewId] || '';

         // Перепривязываем только НЕ-PASTE обработчики
         reAttachEventListenersToRows();

         // Перенумеровываем строки и пересчитываем общую сумму
         renumberRows();
         recalcTotal();

         // Устанавливаем правильный nextViewIdCounter
         let maxViewNumber = 0;
         for (const viewId in viewStates) {
             const match = viewId.match(/^view-(\d+)$/);
             if (match && match[1]) {
                 const viewNumber = parseInt(match[1], 10);
                 if (!isNaN(viewNumber) && viewNumber > maxViewNumber) {
                     maxViewNumber = viewNumber;
                 }
             }
         }
         nextViewIdCounter = maxViewNumber + 1;


    } else {
        // ... (существующий код инициализации дефолтного состояния, addRow, сохранения) ...
        console.log('No saved data found. Starting with default state.');
        viewStates['view-1'] = '';
        viewMetadata['view-1'] = 'Список 1';
        activeViewId = 'view-1';
        nextViewIdCounter = 2;

        addRow(); // Добавляем первую строку

        // Сохраняем начальное состояние для view-1 после addRow()
        tableBody.querySelectorAll('tr input').forEach(input => {
            input.setAttribute('value', input.value);
        });
        viewStates['view-1'] = tableBody.innerHTML;

        console.log('Initial state for view-1 saved:', viewStates['view-1'] ? viewStates['view-1'].substring(0, 100) + '...' : 'EMPTY');

        // Привязываем обработчики к изначальному элементу списка (view-1)
        const initialViewItem = viewList.querySelector('.view-item');
        if (initialViewItem) {
            initialViewItem.classList.add('active-view');
            addEventListenersToViewItem(initialViewItem);
        }

        // Сохраняем начальное состояние в localStorage
        saveAppStateToLocalStorage();
    }

    // Устанавливаем начальное имя списка над таблицей
    updateCurrentViewNameDisplay();

    console.log('Application initialized.');
}

// Запускаем инициализацию после загрузки DOM
document.addEventListener('DOMContentLoaded', initializeApp);

// --- Автосохранение при уходе со страницы ---
window.addEventListener('beforeunload', () => {
    console.log('Saving app state before unload...');
    tableBody.querySelectorAll('tr input').forEach(input => {
        input.setAttribute('value', input.value);
    });
    viewStates[activeViewId] = tableBody.innerHTML;
    saveAppStateToLocalStorage();
});
// --- Конец блока автосохранения ---

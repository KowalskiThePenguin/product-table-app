// --- Константы и глобальные переменные ---
const API_KEY     = 'AIzaSyCTZ1P-b1yqq3A75r91DOnmHJYMMb7fKGY'; // !!! Замените на ваш ключ API !!!
const SHEET_ID    = '1JUk0iVBhpOZf1kfOoe-WKwHXMoYxdTrpje7iUqDnMPs'; // !!! ID вашей таблицы !!!
const RANGE       = 'A:E'; // Диапазон данных (A:E)

let products = []; // Массив всех товаров

// --- НОВОЕ: Хранилище состояний и метаданных видов ---
// viewStates: { 'view-1': 'innerHTML_content_1', 'view-2': 'innerHTML_content_2', ... }
let viewStates = {};
// viewMetadata: { 'view-1': 'Название 1', 'view-2': 'Название 2', ... }
let viewMetadata = {};
let activeViewId = 'view-1'; // ID текущего активного вида
let nextViewIdCounter = 1; // Счетчик для генерации ID новых видов (начнем с 1, т.к. "Список 1" уже есть)

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


// --- Функции для работы с localStorage ---

function saveAppStateToLocalStorage() {
    console.log('Saving app state to localStorage...');
    try {
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
        // Можно добавить уведомление пользователю, если превышен лимит
        // alert('Не удалось сохранить данные локально. Возможно, превышен лимит хранилища браузера.');
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
        // В случае ошибки парсинга, возможно, стоит очистить localStorage или предложить пользователю
        // localStorage.removeItem('productTableState'); // Опционально
        // alert('Произошла ошибка при загрузке сохраненных данных.');
        return false;
    }
}


// --- Функции форматирования и парсинга (БЕЗ ИЗМЕНЕНИЙ) ---
function formatNumberDisplay(num) { /* ... ваш код ... */
    const number = parseFloat(num);
    if (isNaN(number)) return '';
    return number.toLocaleString('ru-RU');
}
function parseFormattedNumber(str) { /* ... ваш код ... */
    if (!str) return 0;
    const cleanedString = String(str).replace(/\s/g, '').replace(',', '.');
    return parseFloat(cleanedString) || 0;
}

// === Регистрация Service Worker === (БЕЗ ИЗМЕНЕНИЙ)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/product-table-app/' }) // ИЗМЕНЕНО: добавлена область действия
      .then((registration) => {
        console.log('Service Worker: Регистрация успешна с областью видимости:', registration.scope);
      })
      .catch((error) => {
        console.error('Service Worker: Ошибка при регистрации:', error);
      });
  });
}

// === Отслеживание статуса сети === (БЕЗ ИЗМЕНЕНИЙ)
const networkStatusIndicator = document.createElement('div');
networkStatusIndicator.id = 'network-status';
document.body.appendChild(networkStatusIndicator);

function updateNetworkStatus() {
  if (navigator.onLine) {
    networkStatusIndicator.textContent = 'Онлайн';
    networkStatusIndicator.style.backgroundColor = '#d4edda'; // Зеленый фон
    networkStatusIndicator.style.color = '#155724'; // Темно-зеленый текст
     console.log('Приложение снова онлайн. Пытаемся обновить данные товаров.');
     // Можно добавить проверку, прошло ли достаточно времени с последней загрузки,
     // чтобы не перезагружать слишком часто
     fetchProducts(); // Повторно вызываем загрузку данных товаров
  } else {
    networkStatusIndicator.textContent = 'Оффлайн';
    networkStatusIndicator.style.backgroundColor = '#f8d7da'; // Красный фон
    networkStatusIndicator.style.color = '#721c24'; // Темно-красный текст
  }
  networkStatusIndicator.style.display = 'block';
   if (navigator.onLine) {
       setTimeout(() => {
           networkStatusIndicator.style.display = 'none';
       }, 3000);
   }
}

window.addEventListener('online', updateNetworkStatus);
window.addEventListener('offline', updateNetworkStatus);
// updateNetworkStatus(); // Вызывается в initializeApp


// --- Функции для ПОЛЬЗОВАТЕЛЬСКОГО АВТОДОПОЛНЕНИЯ (БЕЗ ИЗМЕНЕНИЙ) ---
function getFilteredProducts(inputValue) { /* ... ваш код ... */
     inputValue = inputValue.trim().toLowerCase();

    if (!inputValue) {
        return [];
    }

    let exactMatch = null;
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

    for (const p of products) {
        if (exactMatch && (p.id === exactMatch.id || (!p.id && p.name === exactMatch.name))) {
             continue;
        }

        const fullValueLower = `${p.id ? p.id + ' - ' : ''}${p.name}`.toLowerCase();
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

    const ordered = [];
    if (exactMatch) {
        ordered.push(exactMatch);
    }
    ordered.push(...startsWithId, ...startsWithName, ...containsId, ...containsName);

    const uniqueOrdered = [];
    const seen = new Set();

    for (const product of ordered) {
        const key = product.id || product.name;
        if (!seen.has(key)) {
             uniqueOrdered.push(product);
             seen.add(key);
        }
    }

    return uniqueOrdered;
}
function updateSuggestionsUI(nameInput, suggestionsDropdown) { /* ... ваш код ... */
     const inputValue = nameInput.value.trim();
    const filteredProducts = getFilteredProducts(inputValue);

    suggestionsDropdown.innerHTML = '';
    nameInput.removeAttribute('aria-activedescendant');


    const limitedResults = filteredProducts.slice(0, 100);

    if (limitedResults.length > 0) {

        limitedResults.forEach((product, index) => {
            const itemElement = document.createElement('div');
            itemElement.classList.add('suggestion-item');
            itemElement.setAttribute('role', 'option');
            itemElement.setAttribute('tabindex', '-1');

            if (!suggestionsDropdown.id) {
                 suggestionsDropdown.id = 'suggestions-dropdown-' + nameInput.closest('tr').rowIndex;
             }
            itemElement.id = `${suggestionsDropdown.id}-item-${index}`;

            itemElement.dataset.productId = product.id;
            itemElement.dataset.productName = product.name;
            itemElement.dataset.productUnit = product.unit;
            itemElement.dataset.productCountry = product.country;
            itemElement.dataset.productPrice = product.price;


            const mainLine = document.createElement('div');
            mainLine.classList.add('main-line');
            mainLine.textContent = `${product.id ? product.id + ' - ' : ''}${product.name}`;

            const detailsLine = document.createElement('div');
            detailsLine.classList.add('details-line');
            const formattedPrice = formatNumberDisplay(product.price);
            detailsLine.textContent = `${product.country} · ${formattedPrice} · ${product.unit}`;

            itemElement.appendChild(mainLine);
            itemElement.appendChild(detailsLine);

             itemElement.addEventListener('mousedown', () => {
                nameInput._isSelectingSuggestion = true;
            });

            itemElement.addEventListener('click', () => {
                console.log('Suggestion item clicked.');
                try {
                     const selectedProduct = {
                         id: itemElement.dataset.productId,
                         name: itemElement.dataset.productName,
                         unit: itemElement.dataset.productUnit,
                         country: itemElement.dataset.productCountry,
                         price: parseFormattedNumber(itemElement.dataset.productPrice)
                     };

                    nameInput.value = selectedProduct.name;
                    console.log('Input value set by click handler:', nameInput.value);

                    onNameChange(nameInput.closest('tr'));

                    nameInput._isSelectingSuggestion = false;

                } catch (error) {
                    console.error('Error during suggestion item click handling:', error);
                    nameInput._isSelectingSuggestion = false;
                }
            });


            suggestionsDropdown.appendChild(itemElement);
        });

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
        suggestionsDropdown.style.display = 'none';
        nameInput.setAttribute('aria-expanded', 'false');
        nameInput.removeAttribute('aria-controls');
        nameInput.removeAttribute('aria-activedescendant');
        nameInput._isSelectingSuggestion = false;
    }
}

// --- Функции экспорта CSV, печати, снимка (БЕЗ ИЗМЕНЕНИЙ, КРОМЕ ИМЕНИ ФАЙЛА) ---
function escapeCsvString(str) { /* ... ваш код ... */
      if (str === null || str === undefined) {
        return '';
    }
    str = String(str);
    const escaped = str.replace(/"/g, '""');
    if (escaped.includes(';') || escaped.includes('"') || escaped.includes('\n') || escaped.includes('\r') || escaped.includes('\t')) {
        return `"${escaped}"`;
    }
    return escaped;
}

function exportTableToCsv() {
  let csv = [];
  const headerRow = productTable.querySelector('thead tr');
  if (headerRow) {
      const existingHeaderCells = headerRow.querySelectorAll('th:not(:last-child)');
      const existingHeaderData = Array.from(existingHeaderCells).map(th => escapeCsvString(th.textContent.trim()));
      const headerData = [escapeCsvString("ID"), ...existingHeaderData];
      csv.push(headerData.join(';'));
  }

  tableBody.querySelectorAll('tr').forEach(tr => {
      const cells = tr.querySelectorAll('td');
      const nameInput = tr.querySelector('.name-input');
      const qtyInput = tr.querySelector('.qty-input');

      if (cells.length >= 7 && nameInput && qtyInput) {
          const productId = tr.dataset.productId || '';
          const name = nameInput.value || '';
          const unit = cells[2] ? cells[2].textContent.trim() : '';
          const country = cells[3] ? cells[3].textContent.trim() : '';
          const qtyStr = (qtyInput.value || '0').replace(',', '.');
          const priceStr = (cells[5] ? cells[5].dataset.price || '0' : '0').replace(',', '.');
          const sumStr = (cells[6] ? cells[6].dataset.sum || '0' : '0').replace(',', '.');
          const cleanedProductId = String(productId).replace(/\u00A0/g, '').trim(); // <--- ДОБАВЛЕНА ОЧИСТКА

          const rowCsv = [
              escapeCsvString('\t' + cleanedProductId), // <--- Используем ОЧИЩЕННЫЙ ID
              escapeCsvString(nameInput.value || ''),
              escapeCsvString(unitCell ? unitCell.textContent.trim() : ''),
              escapeCsvString(countryCell ? countryCell.textContent.trim() : ''),
              // Убедитесь, что числовые значения экспортируются с точкой как десятичным разделителем, если нужно
              escapeCsvString((qtyInput.value || '0').replace(',', '.')),
              escapeCsvString((cells[5] ? cells[5].dataset.price || '0' : '0').replace(',', '.')),
              escapeCsvString((cells[6] ? cells[6].dataset.sum || '0' : '0').replace(',', '.')),
          ];
          csv.push(rowCsv.join(';'));
      }
  });

  const footerRow = productTable.querySelector('tfoot tr');
  if (footerRow) {
      const footerCells = footerRow.querySelectorAll('td');
      const totalFooterData = [];
      const exportColumnCount = 7;

      if (footerCells[1]) {
           totalFooterData.push(escapeCsvString(footerCells[1].textContent.trim()));
      } else {
           totalFooterData.push('');
      }

      const emptyCellsCount = exportColumnCount - 2;
      for(let i = 0; i < emptyCellsCount; i++) {
           totalFooterData.push('');
      }

       if (totalSumCell) {
            const totalSumValue = String(parseFloat(totalSumCell.dataset.total || 0)).replace('.', ',');
            totalFooterData.push(escapeCsvString(totalSumValue));
       } else {
           totalFooterData.push('');
       }

       csv.push(totalFooterData.join(';'));
  }

  const csvString = csv.join('\r\n');
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);

  // --- Имя файла берем из viewMetadata ---
  const viewName = viewMetadata[activeViewId] ? viewMetadata[activeViewId].trim() : 'таблица';
  const filename = `${viewName.replace(/[^a-zа-я0-9]/gi, '_')}.csv`;
  // --- Конец изменения ---

  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  console.log(`Table for view '${viewName}' exported to CSV.`);
}
function printTable() { /* ... ваш код ... */
    window.print();
}

function captureTableSnapshot() {
    const elementToCapture = document.getElementById('main-content');
    const actionButtonsElement = elementToCapture.querySelector('.action-buttons');

    if (!elementToCapture) {
        console.error('Ошибка: Элемент контейнера с ID "main-content" не найден.');
        alert('Не удалось найти контейнер для создания снимка.');
        return;
    }

    console.log('Попытка создать снимок контейнера...');

    if (actionButtonsElement) {
        actionButtonsElement.style.display = 'none';
    }

    const actionHeaders = elementToCapture.querySelectorAll('thead th:last-child');
    const actionCells = elementToCapture.querySelectorAll('tbody td:last-child');
    const footerActionCell = elementToCapture.querySelector('tfoot td:last-child');

    actionHeaders.forEach(th => th.style.display = 'none');
    actionCells.forEach(td => td.style.display = 'none');
    if (footerActionCell) footerActionCell.style.display = 'none';

    html2canvas(elementToCapture, {
        scale: 2,
        logging: true,
        useCORS: true
    }).then(canvas => {
        console.log('Снимок успешно создан на Canvas.');
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = dataUrl;

        // --- Имя файла берем из viewMetadata ---
        const viewName = viewMetadata[activeViewId] ? viewMetadata[activeViewId].trim() : 'таблица';
        const filename = `${viewName.replace(/[^a-zа-я0-9]/gi, '_')}_снимок.png`;
        // --- Конец изменения ---

        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        console.log('Снимок захвачен, инициировано скачивание.');

    }).catch(error => {
        console.error('Ошибка при создании снимка:', error);
        alert('Произошла ошибка при создании снимка.');
    }).finally(() => {
        if (actionButtonsElement) {
             actionButtonsElement.style.display = '';
        }
        actionHeaders.forEach(th => th.style.display = '');
        actionCells.forEach(td => td.style.display = '');
        if (footerActionCell) footerActionCell.style.display = '';
    });
}

// --- Функции для работы с данными Google Sheets (БЕЗ ИЗМЕНЕНИЙ) ---
async function fetchProducts() { /* ... ваш код ... */
   try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}?key=${API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP error! status: ${res.status}, Body: ${errorText}`);
    }
    const json = await res.json();
    if (json.values && Array.isArray(json.values)) {
        const dataRows = json.values.slice(1); // Пропускаем заголовок
        products = dataRows.map(r => ({
          id:      r[0] ? String(r[0]).trim() : '', // ID товара
          name:    r[1] ? String(r[1]).trim() : 'Без названия', // Название
          unit:    r[2] ? String(r[2]).trim() : '', // Единица измерения
          country: r[3] ? String(r[3]).trim() : '', // Страна
          price:   parseFormattedNumber(r[4]) // Цена (парсим сразу)
        })).filter(p => p.name !== 'Без названия' && p.name !== ''); // Фильтруем пустые или некорректные

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
    // const priceCell = tr.querySelector('.price-cell'); // Не используется напрямую здесь
    // const sumCell = tr.querySelector('.sum-cell'); // Не используется напрямую здесь
    const suggestionsDropdown = tr.querySelector('.suggestions-dropdown');

    nameInput._isSelectingSuggestion = false;

    // --- ОБРАБОТЧИКИ ДЛЯ ПОЛЬЗОВАТЕЛЬСКОГО АВТОДОПОЛНЕНИЯ ---
    nameInput.addEventListener('input', () => updateSuggestionsUI(nameInput, suggestionsDropdown));
    nameInput.addEventListener('focus', () => { updateSuggestionsUI(nameInput, suggestionsDropdown); });
    nameInput.addEventListener('blur', (e) => {
        setTimeout(() => {
            if (!nameInput._isSelectingSuggestion) {
                suggestionsDropdown.style.display = 'none';
                nameInput.setAttribute('aria-expanded', 'false');
                onNameChange(tr);
            } else {
                 nameInput._isSelectingSuggestion = false;
            }
        }, 150);
    });
    nameInput.addEventListener('change', () => {
         if (nameInput.value.trim() !== '') {
             qtyInput.focus();
         }
         // Вызываем saveDataToLocalStorage после изменения имени
         saveDataToLocalStorage();
    });


    nameInput.addEventListener('keydown', (e) => handleNameInputKeydown(e, nameInput, suggestionsDropdown));

    // --- ОБРАБОТЧИКИ ДЛЯ ПОЛЯ КОЛИЧЕСТВА ---
    qtyInput.addEventListener('input', () => onQtyChange(tr));
    qtyInput.addEventListener('blur', () => {
        const sanitizedString = sanitizeQtyInput(qtyInput);
        const finalQty = parseFormattedNumber(sanitizedString);
        qtyInput.value = finalQty > 0 ? formatNumberDisplay(finalQty) : '';
        onQtyChange(tr);
        // Вызываем saveDataToLocalStorage после изменения количества
        saveDataToLocalStorage();
    });
    // Запрет ввода нечисловых символов (кроме точки/запятой и управляющих клавиш)
    qtyInput.addEventListener('keydown', e => handleQtyInputKeydownNum(e));
    // Переход или добавление строки по Enter/Tab
    qtyInput.addEventListener('keydown', async (e) => handleQtyInputKeydownNav(e, tr, qtyInput));


    // --- ОБРАБОТЧИК УДАЛЕНИЯ СТРОКИ ---
    delBtn.addEventListener('click', () => {
        deleteRow(tr);
        // Вызываем saveDataToLocalStorage после удаления строки
        saveAppStateToLocalStorage();
    });

    tableBody.appendChild(tr);

    if (focusLastNameInput) {
        setTimeout(() => {
            nameInput.focus();
        }, 0);
    }
}
function onNameChange(tr) {
   let input = tr.querySelector('.name-input');
    let inputValue = input ? input.value.trim() : '';
    let product = null;

    if (inputValue) {
         product = products.find(p => p.name.toLowerCase() === inputValue.toLowerCase());

         if (!product && /^\d+$/.test(inputValue)) {
             product = products.find(p => p.id && p.id.trim() === inputValue.trim());
         }
    }

    const unitCell = tr.querySelector('.unit-cell');
    const countryCell = tr.querySelector('.country-cell');
    const priceCell = tr.querySelector('.price-cell');
    const qtyInput = tr.querySelector('.qty-input');
    const sumCell = tr.querySelector('.sum-cell');

    if (product) {
        tr.dataset.productId = product.id;
        input.value = product.name;
        unitCell.textContent = product.unit;
        countryCell.textContent = product.country;
        priceCell.dataset.price = product.price;
        priceCell.textContent = formatNumberDisplay(product.price);

        qtyInput.value = '';
        sumCell.dataset.sum = 0;
        sumCell.textContent = formatNumberDisplay(0);

        onQtyChange(tr);

        input.classList.remove('input-error');

    } else {
        delete tr.dataset.productId;
        if (inputValue !== '') {
             unitCell.textContent = '';
             countryCell.textContent = '';
             priceCell.dataset.price = 0;
             priceCell.textContent = formatNumberDisplay(0);
         } else {
             unitCell.textContent = '';
             countryCell.textContent = '';
             priceCell.dataset.price = 0;
             priceCell.textContent = formatNumberDisplay(0);
         }
         qtyInput.value = '';
         sumCell.dataset.sum = 0;
         sumCell.textContent = formatNumberDisplay(0);
         onQtyChange(tr);
    }
    recalcTotal();
    // Вызываем saveAppStateToLocalStorage после каждого изменения в строке
    saveAppStateToLocalStorage();
}
function onQtyChange(tr) {
    const qtyInput = tr.querySelector('.qty-input');
    const priceCell = tr.querySelector('.price-cell');
    const sumCell = tr.querySelector('.sum-cell');

    const price = parseFloat(priceCell.dataset.price) || 0;
    const quantity = parseFormattedNumber(qtyInput.value);

    const sum = price * quantity;

    sumCell.dataset.sum = sum;
    sumCell.textContent = formatNumberDisplay(sum);

    recalcTotal();
    // Вызываем saveAppStateToLocalStorage после каждого изменения в строке
    saveAppStateToLocalStorage();
}
function deleteRow(tr) {
    if (tableBody.rows.length > 1) {
        tr.remove();
        renumberRows();
    } else {
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
        delete tr.dataset.productId;
    }
    recalcTotal();
    // Вызываем saveAppStateToLocalStorage после удаления строки
    saveAppStateToLocalStorage();
}
function renumberRows() { /* ... ваш код ... */
   tableBody.querySelectorAll('tr').forEach((tr, i) => {
    const rowNumCell = tr.querySelector('.row-num');
    if (rowNumCell) {
      rowNumCell.textContent = i + 1;
    }
  });
}
function recalcTotal() { /* ... ваш код ... */
   const sumCells = tableBody.querySelectorAll('.sum-cell');
  let total = 0;

  sumCells.forEach(td => {
    total += parseFloat(td.dataset.sum) || 0;
  });

  totalSumCell.dataset.total = total;
  totalSumCell.textContent = formatNumberDisplay(total);
}
function sanitizeQtyInput(qtyInput) { /* ... ваш код ... */
     let v = qtyInput.value.trim();
    if (v === '') return '';

    v = v.replace(',', '.');
    v = v.replace(/[^0-9.]/g, '');
    v = v.replace(/^0+(?=\d)/, '');

    const parts = v.split('.');
    if (parts.length > 2) {
        v = parts[0] + '.' + parts.slice(1).join('');
    }

    if (v === '.' || /^0*\.$/.test(v)) v = '0.';

    if (v.endsWith('.') && v.length > 1 && /\d/.test(v.slice(0, -1))) {
    } else if (v.endsWith('.')) {
        if (v.length > 1) v = v.slice(0, -1);
        else v = '';
    }

    if (v !== '' && parseFloat(v) === 0) {
        const originalValue = qtyInput.value.trim().replace(',', '.');
        if (/^0+\.?0*$/.test(originalValue) && v !== '0.') {
            v = '';
        }
    }

  return v;
}

// --- Функции для повторной привязки обработчиков (БЕЗ ИЗМЕНЕНИЙ) ---
function reAttachEventListenersToRows() {
    console.log('Re-attaching event listeners to rows...');
    tableBody.querySelectorAll('tr').forEach(tr => {
        const nameInput = tr.querySelector('.name-input');
        const qtyInput = tr.querySelector('.qty-input');
        const delBtn = tr.querySelector('.delete-btn');
        const suggestionsDropdown = tr.querySelector('.suggestions-dropdown');

        // Удаляем старые и добавляем новые
        if (nameInput && suggestionsDropdown) {
            // Важно: Удаляем с помощью сохраненных ссылок, если они есть
            if (nameInput._inputHandler) nameInput.removeEventListener('input', nameInput._inputHandler);
            if (nameInput._focusHandler) nameInput.removeEventListener('focus', nameInput._focusHandler);
            if (nameInput._blurHandler) nameInput.removeEventListener('blur', nameInput._blurHandler);
            if (nameInput._changeHandler) nameInput.removeEventListener('change', nameInput._changeHandler);
            if (nameInput._keydownHandler) nameInput.removeEventListener('keydown', nameInput._keydownHandler);

            // Сохраняем ссылки на новые обработчики
            nameInput._inputHandler = () => updateSuggestionsUI(nameInput, suggestionsDropdown);
            nameInput._focusHandler = () => { updateSuggestionsUI(nameInput, suggestionsDropdown); };
            nameInput._blurHandler = (e) => {
                setTimeout(() => {
                    if (!nameInput._isSelectingSuggestion) {
                        suggestionsDropdown.style.display = 'none';
                        nameInput.setAttribute('aria-expanded', 'false');
                        onNameChange(tr);
                    } else {
                        nameInput._isSelectingSuggestion = false;
                    }
                }, 150);
            };
             nameInput._changeHandler = () => {
                 if (nameInput.value.trim() !== '') { qtyInput.focus(); }
                 saveAppStateToLocalStorage(); // Сохраняем после изменения имени
            };
             nameInput._keydownHandler = (e) => handleNameInputKeydown(e, nameInput, suggestionsDropdown);

            nameInput.addEventListener('input', nameInput._inputHandler);
            nameInput.addEventListener('focus', nameInput._focusHandler);
            nameInput.addEventListener('blur', nameInput._blurHandler);
            nameInput.addEventListener('change', nameInput._changeHandler);
            nameInput.addEventListener('keydown', nameInput._keydownHandler);

             suggestionsDropdown.querySelectorAll('.suggestion-item').forEach(item => {
                 if (item._clickHandler) item.removeEventListener('click', item._clickHandler);
                 if (item._mousedownHandler) item.removeEventListener('mousedown', item._mousedownHandler);

                 item._clickHandler = () => handleSuggestionClick(item, nameInput, tr);
                 item._mousedownHandler = () => { nameInput._isSelectingSuggestion = true; };

                 item.addEventListener('click', item._clickHandler);
                 item.addEventListener('mousedown', item._mousedownHandler);
             });

        }

        if (qtyInput) {
             if (qtyInput._inputHandler) qtyInput.removeEventListener('input', qtyInput._inputHandler);
             if (qtyInput._blurHandler) qtyInput.removeEventListener('blur', qtyInput._blurHandler);
             if (qtyInput._keydownNumHandler) qtyInput.removeEventListener('keydown', qtyInput._keydownNumHandler);
             if (qtyInput._keydownNavHandler) qtyInput.removeEventListener('keydown', qtyInput._keydownNavHandler);


             qtyInput._inputHandler = () => onQtyChange(tr);
             qtyInput._blurHandler = () => {
                const sanitizedString = sanitizeQtyInput(qtyInput);
                const finalQty = parseFormattedNumber(sanitizedString);
                qtyInput.value = finalQty > 0 ? formatNumberDisplay(finalQty) : '';
                onQtyChange(tr);
                saveAppStateToLocalStorage(); // Сохраняем после изменения количества
            };
             qtyInput._keydownNumHandler = (e) => handleQtyInputKeydownNum(e);
             qtyInput._keydownNavHandler = (e) => handleQtyInputKeydownNav(e, tr, qtyInput);

             qtyInput.addEventListener('input', qtyInput._inputHandler);
             qtyInput.addEventListener('blur', qtyInput._blurHandler);
             qtyInput.addEventListener('keydown', qtyInput._keydownNumHandler);
             qtyInput.addEventListener('keydown', qtyInput._keydownNavHandler);
        }

        if (delBtn) {
            if (delBtn._clickHandler) delBtn.removeEventListener('click', delBtn._clickHandler);
            delBtn._clickHandler = () => {
                 deleteRow(tr);
                 saveAppStateToLocalStorage(); // Сохраняем после удаления
             };
            delBtn.addEventListener('click', delBtn._clickHandler);
        }
    });
     console.log('Event listeners re-attached.');
}

// НУЖНЫ ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ-ОБЕРТКИ ДЛЯ ОБРАБОТЧИКОВ (БЕЗ ИЗМЕНЕНИЙ, КРОМЕ ВЫЗОВОВ saveAppStateToLocalStorage В onNameChange, onQtyChange, deleteRow)
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
                currentActive.click();
            }
            break;
        case 'Escape':
            suggestionsDropdown.style.display = 'none';
            nameInput.setAttribute('aria-expanded', 'false');
             nameInput.removeAttribute('aria-activedescendant');
            break;
        case 'Tab':
            suggestionsDropdown.style.display = 'none';
            nameInput.setAttribute('aria-expanded', 'false');
             nameInput.removeAttribute('aria-activedescendant');
            break;
    }
}

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
         onNameChange(tr);
         nameInput._isSelectingSuggestion = false;
     } catch (error) {
         console.error('Error during re-attached suggestion click:', error);
         nameInput._isSelectingSuggestion = false;
     }
}

function handleQtyInputKeydownNum(e) {
     const allowedKeys = ['0','1','2','3','4','5','6','7','8','9','. ',',','Backspace','ArrowLeft','ArrowRight','Delete'];
     if (e.ctrlKey || e.metaKey) {
         if (['a', 'c', 'v', 'x', 'z'].includes(e.key.toLowerCase())) return;
     }
     if (!allowedKeys.includes(e.key) && e.key !== 'Enter' && e.key !== 'Tab') {
         e.preventDefault();
     }
}

async function handleQtyInputKeydownNav(e, tr, qtyInput) {
     if (e.key === 'Enter' || e.key === 'Tab') {
         e.preventDefault();
         const nextRow = tr.nextElementSibling;
         if (!nextRow) {
             addRow(true);
         } else {
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
    closeAllActionDropdowns();
}

// Переключение на другой вид (ИСПРАВЛЕННАЯ ВЕРСИЯ)
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
    console.log(`Saved state for ${activeViewId}:`, viewStates[activeViewId].substring(0, 100) + '...');

    // 2. Обновляем активный ID
    activeViewId = newViewId;

    // 3. Загружаем состояние нового вида
    const newHtml = viewStates[activeViewId];
    console.log(`Loading state for ${activeViewId}:`, newHtml ? newHtml.substring(0, 100) + '...' : 'EMPTY');

    tableBody.innerHTML = newHtml || '';

    // 4. Если для нового вида нет сохраненного состояния (он новый или пустой)
    if (!newHtml) {
        addRow(true);
    } else {
        // 5. ПОВТОРНО ПРИВЯЗЫВАЕМ ОБРАБОТЧИКИ к загруженным строкам
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
        // Если активный вид не найден в DOM (например, после загрузки из localStorage)
        // Нам нужно убедиться, что activeViewId корректен и соответствующий элемент меню существует.
        // Этот случай должен обрабатываться при загрузке из localStorage.
        console.warn(`Active view element for ID ${activeViewId} not found in menu.`);
    }

    // НОВОЕ: Обновляем заголовок над таблицей
    updateCurrentViewNameDisplay();

    // 8. Закрываем меню после выбора
    closeMenu();

    // НОВОЕ: Сохраняем состояние приложения после переключения вида
    saveAppStateToLocalStorage();
}

// НОВАЯ ФУНКЦИЯ: Обновление текста заголовка над таблицей
function updateCurrentViewNameDisplay() {
     const viewName = viewMetadata[activeViewId] || 'Текущий список'; // Берем имя из метаданных
    if (currentViewNameElement) {
        currentViewNameElement.textContent = viewName;
    }
}

// Добавление нового вида в меню
function addNewView() {
    const newViewId = `view-${nextViewIdCounter++}`;
    const newViewName = `Список ${nextViewIdCounter - 1}`;

    // Создаем новый элемент списка в DOM
    const listItem = document.createElement('li');
    listItem.classList.add('view-item');
    listItem.dataset.viewId = newViewId;
    listItem.innerHTML = `
        <span>${newViewName}</span>
        <div class="view-actions">
            <button class="ellipsis-btn"><i class="fas fa-ellipsis-v"></i></button>
            <div class="actions-dropdown">
                <a href="#" class="rename-action">Переименовать</a>
                <a href="#" class="copy-action">Копировать</a>
                <a href="#" class="delete-action">Удалить</a>
            </div>
        </div>
    `;

    // Добавляем обработчики для нового элемента
    addEventListenersToViewItem(listItem);

    viewList.appendChild(listItem);

    // Инициализируем состояние и метаданные для нового вида
    viewStates[newViewId] = ''; // Пустой tbody
    viewMetadata[newViewId] = newViewName;

    // Переключаемся на новый вид (он будет создан с помощью addRow внутри switchView)
    switchView(newViewId);
    closeAllActionDropdowns();
    // НОВОЕ: Сохраняем состояние приложения после добавления нового вида
    saveAppStateToLocalStorage();
}

// Переименование вида
function renameView(viewItem) {
    const viewId = viewItem.dataset.viewId;
    const span = viewItem.querySelector('span');
    const currentName = viewMetadata[viewId] || span.textContent; // Берем из метаданных или из DOM
    const newName = prompt('Введите новое имя для списка:', currentName);

    if (newName && newName.trim() !== '' && newName !== currentName) {
        const trimmedName = newName.trim();
        span.textContent = trimmedName; // Обновляем в DOM
        viewMetadata[viewId] = trimmedName; // Обновляем в метаданных
        console.log(`View ${viewId} renamed to ${trimmedName}`);
        // НОВОЕ: Обновляем заголовок, если переименован текущий активный список
        if (viewId === activeViewId) {
             updateCurrentViewNameDisplay();
        }
        // НОВОЕ: Сохраняем состояние приложения после переименования
        saveAppStateToLocalStorage();
    }
    closeAllActionDropdowns(viewItem.querySelector('.actions-dropdown'));
}

// Копирование вида
function copyView(viewItem) {
    const sourceViewId = viewItem.dataset.viewId;
    const sourceName = viewMetadata[sourceViewId] || viewItem.querySelector('span').textContent; // Берем имя из метаданных

    // Получаем HTML текущего или сохраненного состояния исходного вида
    let sourceHtml = viewStates[sourceViewId] || ''; // Берем из viewStates

    const newViewId = `view-${nextViewIdCounter++}`;
    const newViewName = `${sourceName} (Копия)`;

    // Создаем новый элемент списка в DOM
    const listItem = document.createElement('li');
    listItem.classList.add('view-item');
    listItem.dataset.viewId = newViewId;
    listItem.innerHTML = `
        <span>${newViewName}</span>
        <div class="view-actions">
            <button class="ellipsis-btn"><i class="fas fa-ellipsis-v"></i></button>
            <div class="actions-dropdown">
                <a href="#" class="rename-action">Переименовать</a>
                <a href="#" class="copy-action">Копировать</a>
                <a href="#" class="delete-action">Удалить</a>
            </div>
        </div>
    `;
    addEventListenersToViewItem(listItem);
    viewList.appendChild(listItem);

    // Копируем HTML состояние и метаданные
    viewStates[newViewId] = sourceHtml;
    viewMetadata[newViewId] = newViewName;
    console.log(`View ${sourceViewId} HTML copied to ${newViewId}`);

    switchView(newViewId); // Переключаемся на копию
    closeAllActionDropdowns();
    // НОВОЕ: Сохраняем состояние приложения после копирования
    saveAppStateToLocalStorage();
}

// Удаление вида
function deleteView(viewItem) {
    const viewIdToDelete = viewItem.dataset.viewId;

    // Не удаляем, если остался только один список
    if (Object.keys(viewStates).length <= 1) {
        alert('Нельзя удалить последний список.');
        closeAllActionDropdowns(viewItem.querySelector('.actions-dropdown'));
        return;
    }

    const viewName = viewMetadata[viewIdToDelete] || viewItem.querySelector('span').textContent; // Берем имя из метаданных

    if (confirm(`Вы уверены, что хотите удалить список "${viewName}"?`)) {
        // Удаляем состояние и метаданные
        delete viewStates[viewIdToDelete];
        delete viewMetadata[viewIdToDelete];

        // Удаляем элемент из списка в DOM
        viewItem.remove();
        console.log(`View ${viewIdToDelete} deleted`);

        // Если удалили активный вид, переключаемся на первый в списке
        if (activeViewId === viewIdToDelete) {
            const firstViewItem = viewList.querySelector('.view-item');
            if (firstViewItem) {
                switchView(firstViewItem.dataset.viewId); // switchView вызовет saveAppStateToLocalStorage
            } else {
                // Это не должно произойти, т.к. мы проверяем, что остался хотя бы один список
                activeViewId = null;
                tableBody.innerHTML = '';
                recalcTotal();
                if (currentViewNameElement) {
                     currentViewNameElement.textContent = '';
                 }
                 saveAppStateToLocalStorage(); // Сохраняем пустое состояние, если вдруг нет списков
            }
        }
        // Если удалили неактивный вид, просто обновляем отображение имени текущего и сохраняем
        else {
            updateCurrentViewNameDisplay();
            saveAppStateToLocalStorage();
        }
    }
     closeAllActionDropdowns();
}

// Добавление обработчиков событий к элементу вида
function addEventListenersToViewItem(viewItem) {
    // Клик по самому элементу (переключение вида)
    viewItem.addEventListener('click', (e) => {
        if (!e.target.closest('.view-actions')) {
            switchView(viewItem.dataset.viewId);
        }
    });

    // Клик по кнопке троеточия
    const ellipsisBtn = viewItem.querySelector('.ellipsis-btn');
    const dropdown = viewItem.querySelector('.actions-dropdown');
    ellipsisBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllActionDropdowns(dropdown);
        dropdown.classList.toggle('show');
    });

    // Клики по действиям в выпадающем меню
    viewItem.querySelector('.rename-action').addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation(); renameView(viewItem);
    });
    viewItem.querySelector('.copy-action').addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation(); copyView(viewItem);
    });
    viewItem.querySelector('.delete-action').addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation(); deleteView(viewItem);
    });
}

// Закрытие всех выпадающих меню действий, кроме одного
function closeAllActionDropdowns(excludeDropdown = null) {
    viewList.querySelectorAll('.actions-dropdown.show').forEach(dropdown => {
        if (dropdown !== excludeDropdown) {
            dropdown.classList.remove('show');
        }
    });
}

// Закрытие меню и dropdown'ов при клике вне их
document.addEventListener('click', (e) => {
     if (!e.target.closest('.view-actions')) {
        closeAllActionDropdowns();
     }
     if (sideMenu.classList.contains('open') && !e.target.closest('.side-menu') && !e.target.closest('.menu-toggle-btn')) {
        closeMenu();
     }
});


// --- Инициализация ---

async function initializeApp() {
    console.log('Initializing application...');
    // 1. Привязываем обработчики меню
    menuToggleBtn.addEventListener('click', () => {
        sideMenu.classList.contains('open') ? closeMenu() : openMenu();
    });
    closeMenuBtn.addEventListener('click', closeMenu);
    addViewBtn.addEventListener('click', addNewView);

    // 2. Привязываем обработчики кнопок таблицы (Экспорт, Печать, Снимок)
    const exportButton = document.getElementById('export-csv');
    const printButton = document.getElementById('print-table');
    const snapshotButton = document.getElementById('snapshot-table');
    if (exportButton) exportButton.addEventListener('click', exportTableToCsv);
    if (printButton) printButton.addEventListener('click', printTable);
    if (snapshotButton) snapshotButton.addEventListener('click', captureTableSnapshot);

    // 3. Привязываем обработчик FAB
    fabButton.addEventListener('click', () => {
        addRow(false);
        saveAppStateToLocalStorage(); // Сохраняем после добавления строки
    });

    // 4. Инициализация итоговой суммы
    totalSumCell.dataset.total = 0;
    totalSumCell.textContent = formatNumberDisplay(0);

    // 5. Загружаем общие данные товаров (асинхронно)
    await fetchProducts();

    // 6. Обновляем статус сети
    updateNetworkStatus();


    // --- НОВОЕ: Загрузка данных из localStorage ---
    const dataLoaded = loadAppStateFromLocalStorage();

    if (dataLoaded) {
        // Если данные успешно загружены из localStorage:
        // Восстанавливаем элементы списка видов в DOM
        viewList.innerHTML = ''; // Очищаем изначальный элемент списка в index.html
        for (const viewId in viewMetadata) {
            if (viewMetadata.hasOwnProperty(viewId)) {
                 const viewName = viewMetadata[viewId];
                 const listItem = document.createElement('li');
                 listItem.classList.add('view-item');
                 // Добавляем класс 'active-view', если это текущий активный вид
                 if (viewId === activeViewId) {
                     listItem.classList.add('active-view');
                 }
                 listItem.dataset.viewId = viewId;
                 listItem.innerHTML = `
                    <span>${viewName}</span>
                    <div class="view-actions">
                        <button class="ellipsis-btn"><i class="fas fa-ellipsis-v"></i></button>
                        <div class="actions-dropdown">
                            <a href="#" class="rename-action">Переименовать</a>
                            <a href="#" class="copy-action">Копировать</a>
                            <a href="#" class="delete-action">Удалить</a>
                        </div>
                    </div>
                 `;
                 addEventListenersToViewItem(listItem); // Привязываем обработчики к новому элементу
                 viewList.appendChild(listItem);
            }
        }

        // Переключаемся на последний активный вид, загруженный из localStorage
         // switchView(activeViewId); // switchView сам вызовет загрузку и перепривязку
         // Вставляем HTML для активного вида напрямую перед вызовом reAttachEventListenersToRows и recalcTotal
         tableBody.innerHTML = viewStates[activeViewId] || '';
         reAttachEventListenersToRows(); // Перепривязываем обработчики к загруженным строкам
         renumberRows(); // Перенумеровываем
         recalcTotal(); // Пересчитываем итог

         // Устанавливаем правильный nextViewIdCounter на основе загруженных данных
         // Это гарантирует, что новые виды будут иметь уникальные ID
         // Находим максимальный номер среди загруженных viewId и добавляем 1
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
        // Если данные НЕ были загружены (первый запуск или ошибка загрузки):
        console.log('Starting with default state.');
        // Инициализируем view-1 с пустым состоянием и метаданными
        viewStates['view-1'] = '';
        viewMetadata['view-1'] = 'Список 1';
        activeViewId = 'view-1';
        nextViewIdCounter = 2; // Следующий вид будет "Список 2"

        // Добавляем первую строку
        addRow();
        // Важно: СОХРАНЯЕМ НАЧАЛЬНОЕ СОСТОЯНИЕ для view-1 ПОСЛЕ addRow()
        // Атрибуты value уже будут обновлены внутри addRow.
        viewStates['view-1'] = tableBody.innerHTML;
        console.log('Initial state for view-1 saved:', viewStates['view-1'].substring(0, 100) + '...');

        // Привязываем обработчики к изначальному элементу списка (view-1) из index.html
        const initialViewItem = viewList.querySelector('.view-item');
        if (initialViewItem) {
            addEventListenersToViewItem(initialViewItem);
        }

        // Сохраняем начальное состояние в localStorage
        saveAppStateToLocalStorage();
    }


    // Устанавливаем начальное имя списка над таблицей (на основе activeViewId)
    updateCurrentViewNameDisplay();


    console.log('Application initialized.');
}

// Запускаем инициализацию после загрузки DOM
document.addEventListener('DOMContentLoaded', initializeApp);
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

    // Сохраняем исходные встроенные стили для элементов, чьи свойства transform/width/overflow мы меняем
    const originalContainerTransform = elementToCapture.style.transform;
    const originalContainerWidth = elementToCapture.style.width;
    const originalContainerOverflowX = elementToCapture.style.overflowX;
    const originalContainerPadding = elementToCapture.style.padding; // Сохраняем padding
    const originalProductTableTransform = productTableElement ? productTableElement.style.transform : '';
    const originalProductTableWidth = productTableElement ? productTableElement.style.width : ''; // Сохраняем ширину таблицы
    const originalProductTableMaxWidth = productTableElement ? productTableElement.style.maxWidth : ''; // Сохраняем max-width таблицы
    const originalProductTableTableLayout = productTableElement ? productTableElement.style.tableLayout : ''; // Сохраняем table-layout

    // Сохраняем display для элементов, которые скрываем
    const originalAppHeaderDisplay = appHeader ? appHeader.style.display : '';
    const originalAppFooterDisplay = appFooter ? appFooter.style.display : '';
    const originalSideMenuDisplay = sideMenu ? sideMenu.style.display : '';
    const originalNetworkStatusDisplay = networkStatus ? networkStatus.style.display : '';

    // Временно переопределяем стили для отключения эффектов медиазапросов (масштабирование и т.д.)
    // Добавляем !important для гарантии переопределения.
    elementToCapture.style.cssText += 'transform: none !important; width: auto !important; max-width: none !important; overflow-x: visible !important; padding: 20px !important;'; // Убедимся, что padding установлен
    if (productTableElement) {
        productTableElement.style.cssText += 'transform: none !important; width: auto !important; max-width: none !important; table-layout: auto !important;'; // Убеждаемся, что таблица может расширяться
    }

    // Временно скрываем глобальные элементы UI
    if (appHeader) appHeader.style.display = 'none';
    if (appFooter) appFooter.style.display = 'none';
    if (sideMenu) sideMenu.style.display = 'none';
    if (networkStatus) networkStatus.style.display = 'none';

    // Временно скрываем столбец "Удалить" в заголовке, теле и подвале таблицы внутри elementToCapture
    const actionHeaders = elementToCapture.querySelectorAll('thead th:last-child');
    const actionCells = elementToCapture.querySelectorAll('tbody td:last-child');
    const footerActionCell = elementToCapture.querySelector('tfoot td:last-child');

    actionHeaders.forEach(th => th.style.display = 'none');
    actionCells.forEach(td => td.style.display = 'none');
    if (footerActionCell) footerActionCell.style.display = 'none';

    // *** Ключевое изменение: Определяем ширину для html2canvas на основе scrollWidth ***
    // Берем максимальную ширину либо контейнера, либо таблицы.
    // Если таблица внутри контейнера имеет фиксированную ширину, которая выходит за контейнер,
    // то scrollWidth таблицы будет больше scrollWidth контейнера.
    const captureWidth = Math.max(elementToCapture.scrollWidth, productTableElement ? productTableElement.scrollWidth : 0);
    const captureHeight = elementToCapture.scrollHeight; // Высота обычно определяется корректно

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
        elementToCapture.style.padding = originalContainerPadding; // Восстанавливаем padding

        if (productTableElement) {
            productTableElement.style.transform = originalProductTableTransform;
            productTableElement.style.width = originalProductTableWidth;
            productTableElement.style.maxWidth = originalProductTableMaxWidth;
            productTableElement.style.tableLayout = originalProductTableTableLayout;
        }

        // Восстанавливаем display для скрытых элементов
        if (appHeader) appHeader.style.display = originalAppHeaderDisplay;
        if (appFooter) appFooter.style.display = originalAppFooterDisplay;
        if (sideMenu) sideMenu.style.display = originalSideMenuDisplay;
        if (networkStatus) networkStatus.style.display = originalNetworkStatusDisplay;

        // Восстанавливаем display для столбцов "Удалить"
        actionHeaders.forEach(th => th.style.display = '');
        actionCells.forEach(td => td.style.display = '');
        if (footerActionCell) footerActionCell.style.display = '';
    });
}

function captureTableSnapshot() {
    const elementToCapture = document.getElementById('main-content');
    const productTable = document.getElementById('product-table');
    const tableBody = productTable.querySelector('tbody');

    // Select elements to temporarily hide
    const actionButtonsElement = document.querySelector('.action-buttons');
    const fabButton = document.getElementById('add-row');
    const networkStatusIndicator = document.getElementById('network-status');
    const deleteButtons = tableBody.querySelectorAll('.delete-btn');
    const suggestionsDropdowns = tableBody.querySelectorAll('.suggestions-dropdown'); // Select all dropdowns

    if (!elementToCapture || !productTable) {
        console.error('Ошибка: Не найдены необходимые элементы для создания снимка (main-content или product-table).');
        alert('Не удалось найти контейнер для создания снимка.');
        return;
    }

    console.log('Попытка создать снимок контейнера...');

    // Store original styles to restore them later
    const originalDisplay = {};
    const originalTableBodyOverflow = tableBody.style.overflow;
    const originalTableBodyHeight = tableBody.style.height;
    const originalTableBodyMaxHeight = tableBody.style.maxHeight;

    // Store original styles for main-content and product-table that might limit size on small screens
    const originalMainContentWidth = elementToCapture.style.width;
    const originalMainContentMaxWidth = elementToCapture.style.maxWidth;
    const originalMainContentOverflowX = elementToCapture.style.overflowX;
    const originalProductTableWidth = productTable.style.width;
    const originalProductTableMinWidth = productTable.style.minWidth;
    const originalProductTableTableLayout = productTable.style.tableLayout;


    // 1. Temporarily hide elements not needed in the screenshot
    if (actionButtonsElement) {
        originalDisplay.actionButtons = actionButtonsElement.style.display;
        actionButtonsElement.style.display = 'none';
    }
    if (fabButton) {
        originalDisplay.fabButton = fabButton.style.display;
        fabButton.style.display = 'none';
    }
    if (networkStatusIndicator) {
        originalDisplay.networkStatusIndicator = networkStatusIndicator.style.display;
        networkStatusIndicator.style.display = 'none';
    }

    // Hide delete buttons
    deleteButtons.forEach(btn => {
        originalDisplay[btn.id || `delete-btn-${Math.random()}`] = btn.style.display; // Use a unique key
        btn.style.display = 'none';
    });

    // Hide suggestions dropdowns
    suggestionsDropdowns.forEach(dropdown => {
        originalDisplay[dropdown.id || `suggestions-dropdown-${Math.random()}`] = dropdown.style.display;
        dropdown.style.display = 'none';
    });


    // Temporarily hide the last column (Delete column) in header and body
    const headerCells = document.querySelectorAll('#product-table thead th:last-child');
    const bodyCells = document.querySelectorAll('#product-table tbody td:last-child');
    const footerCells = document.querySelectorAll('#product-table tfoot td:last-child');

    originalDisplay.headerLastCell = headerCells.length > 0 ? headerCells[0].style.display : null;
    originalDisplay.bodyLastCells = [];
    originalDisplay.footerLastCell = footerCells.length > 0 ? footerCells[0].style.display : null;

    headerCells.forEach(cell => cell.style.display = 'none');
    bodyCells.forEach(cell => {
        originalDisplay.bodyLastCells.push({ element: cell, display: cell.style.display });
        cell.style.display = 'none';
    });
    footerCells.forEach(cell => cell.style.display = 'none');


    // 2. Adjust tableBody and its container styles to ensure all rows and columns are visible
    tableBody.style.overflow = 'visible';
    tableBody.style.height = 'auto';
    tableBody.style.maxHeight = 'none';

    // Temporarily remove width constraints from main-content and product-table
    elementToCapture.style.width = 'fit-content'; // Or a very large fixed width if fit-content isn't enough
    elementToCapture.style.maxWidth = 'none';
    elementToCapture.style.overflowX = 'visible'; // Ensure horizontal scroll is visible

    productTable.style.width = 'max-content'; // Or a very large fixed width
    productTable.style.minWidth = 'auto'; // Remove minimum width constraint if any
    productTable.style.tableLayout = 'auto'; // Let browser determine column widths naturally

    // To ensure inputs show their actual values
    tableBody.querySelectorAll('input').forEach(input => {
        input.blur();
    });

    // Use a slight delay to ensure DOM updates are rendered
    setTimeout(() => {
        // Calculate the effective width and height of the productTable
        // We'll capture the productTable directly, not main-content, for precise table capture.
        // This makes sure we get the full rendered table, unconstrained.
        const captureWidth = productTable.scrollWidth;
        const captureHeight = productTable.scrollHeight;

        html2canvas(productTable, { // Capture productTable directly
            width: captureWidth,
            height: captureHeight,
            // These are generally good for capturing content that might be outside viewport
            scrollX: -window.scrollX,
            scrollY: -window.scrollY,
            windowWidth: document.documentElement.offsetWidth,
            windowHeight: document.documentElement.offsetHeight,
            useCORS: true
        }).then(canvas => {
            const imageDataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');

            const viewName = viewMetadata[activeViewId] ? viewMetadata[activeViewId].trim() : 'таблица';
            const filename = `${viewName.replace(/[^a-zа-я0-9]/gi, '_')}.png`;

            link.download = filename;
            link.href = imageDataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            console.log(`Snapshot for view '${viewName}' created.`);
        }).catch(error => {
            console.error('Ошибка при создании снимка:', error);
            alert('Произошла ошибка при создании снимка таблицы.');
        }).finally(() => {
            // Restore original styles for UI elements
            if (actionButtonsElement && originalDisplay.actionButtons !== undefined) {
                actionButtonsElement.style.display = originalDisplay.actionButtons;
            }
            if (fabButton && originalDisplay.fabButton !== undefined) {
                fabButton.style.display = originalDisplay.fabButton;
            }
            if (networkStatusIndicator && originalDisplay.networkStatusIndicator !== undefined) {
                networkStatusIndicator.style.display = originalDisplay.networkStatusIndicator;
            }
            deleteButtons.forEach(btn => {
                if (originalDisplay[btn.id || `delete-btn-${Math.random()}`] !== undefined) {
                    btn.style.display = originalDisplay[btn.id || `delete-btn-${Math.random()}`];
                }
            });
            suggestionsDropdowns.forEach(dropdown => {
                if (originalDisplay[dropdown.id || `suggestions-dropdown-${Math.random()}`] !== undefined) {
                    dropdown.style.display = originalDisplay[dropdown.id || `suggestions-dropdown-${Math.random()}`];
                }
            });

            headerCells.forEach(cell => { if (originalDisplay.headerLastCell !== null) cell.style.display = originalDisplay.headerLastCell; });
            originalDisplay.bodyLastCells.forEach(item => { item.element.style.display = item.display; });
            footerCells.forEach(cell => { if (originalDisplay.footerLastCell !== null) cell.style.display = originalDisplay.footerLastCell; });

            // Restore tableBody and container styles
            tableBody.style.overflow = originalTableBodyOverflow;
            tableBody.style.height = originalTableBodyHeight;
            tableBody.style.maxHeight = originalTableBodyMaxHeight;

            elementToCapture.style.width = originalMainContentWidth;
            elementToCapture.style.maxWidth = originalMainContentMaxWidth;
            elementToCapture.style.overflowX = originalMainContentOverflowX;

            productTable.style.width = originalProductTableWidth;
            productTable.style.minWidth = originalProductTableMinWidth;
            productTable.style.tableLayout = originalProductTableTableLayout;
        });
    }, 50);
}

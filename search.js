// search.js

function initSearch(mdEditor, htmlEditor, getLayout) {
    const searchInput = document.getElementById('search-input');
    const searchWrapper = document.getElementById('search-wrapper');
    const closeSearchBtn = document.getElementById('close-search-btn');
    let searchOverlay = null;

    // Función para mostrar y enfocar la barra de búsqueda
    function openSearch() {
        searchWrapper.classList.remove('hidden');
        searchInput.focus();
    }

    // Función para ocultar la barra y limpiar la búsqueda
    function closeSearch() {
        searchWrapper.classList.add('hidden');
        searchInput.value = '';
        clearSearchHighlighting(mdEditor);
        clearSearchHighlighting(htmlEditor);
    }
    
    // Asigna el atajo Ctrl/Cmd + F para abrir la búsqueda
    document.addEventListener('keydown', (e) => {
        const accel = e.ctrlKey || e.metaKey;
        if (accel && e.key.toLowerCase() === 'f') {
            e.preventDefault();
            openSearch();
        }
        // Atajo para cerrar la búsqueda con Escape
        if (e.key === 'Escape' && !searchWrapper.classList.contains('hidden')) {
            closeSearch();
        }
    });

    closeSearchBtn.addEventListener('click', closeSearch);

    // Listener para buscar en tiempo real mientras se escribe
    searchInput.addEventListener('input', () => {
        const query = searchInput.value;
        const layout = getLayout(); // Obtenemos el layout actual

        // Determina en qué editor buscar
        if (layout === 'dual') {
            // En vista dual, busca en el que tiene el foco, o en Markdown por defecto
            if (htmlEditor.hasFocus()) {
                performSearch(htmlEditor, query);
                clearSearchHighlighting(mdEditor);
            } else {
                performSearch(mdEditor, query);
                clearSearchHighlighting(htmlEditor);
            }
        } else if (layout === 'md') {
            performSearch(mdEditor, query);
            clearSearchHighlighting(htmlEditor);
        } else if (layout === 'html') {
            performSearch(htmlEditor, query);
            clearSearchHighlighting(mdEditor);
        }
    });

    // --- Funciones de búsqueda para CodeMirror ---

    function performSearch(editor, query) {
        // Limpia la búsqueda anterior antes de realizar una nueva
        clearSearchHighlighting(editor);
        if (!query) {
            return; // No hace nada si la búsqueda está vacía
        }

        // Crea un overlay para resaltar los resultados
        searchOverlay = createSearchOverlay(new RegExp(query, 'gi'));
        editor.addOverlay(searchOverlay);
    }
    
    function clearSearchHighlighting(editor) {
        if (searchOverlay) {
            editor.removeOverlay(searchOverlay);
            searchOverlay = null;
        }
    }

    function createSearchOverlay(query) {
        return {
            token: function(stream) {
                query.lastIndex = stream.pos;
                const match = query.exec(stream.string);
                if (match && match.index == stream.pos) {
                    stream.pos += match[0].length || 1;
                    return "search-highlight"; // Clase CSS para resaltar
                } else if (match) {
                    stream.pos = match.index;
                } else {
                    stream.skipToEnd();
                }
            }
        };
    }
}

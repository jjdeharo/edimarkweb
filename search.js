// search.js

function initSearch(mdEditor, htmlEditor, getLayout) {
    // Elementos del DOM
    const searchWrapper = document.getElementById('search-wrapper');
    const searchInput = document.getElementById('search-input');
    const replaceInput = document.getElementById('replace-input');
    const closeSearchBtn = document.getElementById('close-search-btn');
    const openSearchBtn = document.getElementById('open-search-btn');
    const nextBtn = document.getElementById('search-next-btn');
    const prevBtn = document.getElementById('search-prev-btn');
    const matchesInfo = document.getElementById('search-matches-info');
    const toggleReplaceBtn = document.getElementById('toggle-replace-btn');
    const replaceRow = document.getElementById('replace-row');
    const replaceOneBtn = document.getElementById('replace-one-btn');
    const replaceAllBtn = document.getElementById('replace-all-btn');

    // Estado de la búsqueda
    let state = {
        matches: [],
        currentIndex: -1,
        activeEditor: null,
        queryRegex: null,
        overlay: null,
        currentMatchMarker: null
    };

    // --- INICIO DE LA CORRECCIÓN ---
    function openSearch() {
        searchWrapper.classList.remove('hidden');
        searchInput.value = ''; // Limpia el campo de búsqueda al abrir
        searchInput.focus();
        // Al abrir, también se limpia el estado anterior para empezar de cero
        runSearch(); 
    }
    // --- FIN DE LA CORRECCIÓN ---

    function closeSearch() {
        searchWrapper.classList.add('hidden');
        clearSearchState();
        if (state.activeEditor) {
            state.activeEditor.focus(); // Devuelve el foco al editor
        }
    }
    
    // --- Lógica de la interfaz ---
    openSearchBtn.addEventListener('click', openSearch);
    closeSearchBtn.addEventListener('click', closeSearch);

    toggleReplaceBtn.addEventListener('click', () => {
        const icon = toggleReplaceBtn.querySelector('i');
        const isHidden = replaceRow.classList.contains('hidden');
        replaceRow.classList.toggle('hidden', !isHidden);
        replaceRow.classList.toggle('flex', isHidden);
        icon.style.transform = isHidden ? 'rotate(90deg)' : 'rotate(0deg)';
    });
    
    document.addEventListener('keydown', (e) => {
        const accel = e.ctrlKey || e.metaKey;
        if (accel && e.key.toLowerCase() === 'f') {
            e.preventDefault();
            openSearch();
        }
        if (e.key === 'Escape' && !searchWrapper.classList.contains('hidden')) {
            closeSearch();
        }
    });

    // --- Lógica principal ---
    searchInput.addEventListener('keydown', handleSearchNav);
    replaceInput.addEventListener('keydown', handleSearchNav);

    function handleSearchNav(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.shiftKey ? findPrev() : findNext();
        }
    }

    searchInput.addEventListener('input', runSearch);
    nextBtn.addEventListener('click', findNext);
    prevBtn.addEventListener('click', findPrev);
    replaceOneBtn.addEventListener('click', replaceCurrent);
    replaceAllBtn.addEventListener('click', replaceAll);

    // --- Funciones del motor de búsqueda ---

    function runSearch() {
        const editor = determineActiveEditor();
        if (!editor) {
            if (state.activeEditor && typeof state.activeEditor.clearHighlights === 'function') {
                state.activeEditor.clearHighlights();
            }
            return;
        }

        clearSearchState();
        state.activeEditor = editor;
        
        const query = searchInput.value;
        if (!query) {
            updateMatchesInfo();
            if (typeof editor.clearHighlights === 'function') editor.clearHighlights();
            return;
        }

        state.queryRegex = buildCaseAccentInsensitiveRegex(query);
        if (!state.queryRegex) return;

        state.overlay = createSearchOverlay(state.queryRegex);
        editor.addOverlay(state.overlay);

        const cursor = editor.getSearchCursor(state.queryRegex);
        while (cursor.findNext()) {
            state.matches.push({ from: cursor.from(), to: cursor.to() });
        }

        if (state.matches.length > 0) {
            state.currentIndex = 0;
            highlightCurrentMatch();
        } else if (typeof editor.clearHighlights === 'function') {
            editor.clearHighlights();
        }
        updateMatchesInfo();
    }
    
    function findNext() {
        if (state.matches.length < 1) return;
        state.currentIndex = (state.currentIndex + 1) % state.matches.length;
        highlightCurrentMatch();
    }

    function findPrev() {
        if (state.matches.length < 1) return;
        state.currentIndex = (state.currentIndex - 1 + state.matches.length) % state.matches.length;
        highlightCurrentMatch();
    }
    
    function replaceCurrent() {
        if (state.matches.length < 1 || state.currentIndex === -1) return;
        
        const editor = state.activeEditor;
        const match = state.matches[state.currentIndex];
        
        editor.replaceRange(replaceInput.value, match.from, match.to);
        
        runSearch();
    }

    function replaceAll() {
        if (state.matches.length < 1) return;
        if (!confirm(`¿Reemplazar todas las ${state.matches.length} coincidencias?`)) return;

        const editor = state.activeEditor;
        const replaceText = replaceInput.value;
        
        editor.operation(() => {
            const cursor = editor.getSearchCursor(state.queryRegex);
            while (cursor.findNext()) {
                cursor.replace(replaceText);
            }
        });
        
        clearSearchState();
        updateMatchesInfo();
    }

    // --- Funciones auxiliares ---
    
    function determineActiveEditor() {
        const layout = getLayout();
        if (layout === 'dual') {
            return htmlEditor.hasFocus() ? htmlEditor : mdEditor;
        }
        return layout === 'md' ? mdEditor : htmlEditor;
    }
    
    function clearSearchState() {
        const { activeEditor, overlay, currentMatchMarker } = state;
        if (activeEditor) {
            if (overlay) activeEditor.removeOverlay(overlay);
            if (currentMatchMarker) currentMatchMarker.clear();
            if (typeof activeEditor.clearHighlights === 'function') {
                activeEditor.clearHighlights();
            }
        }
        state = { matches: [], currentIndex: -1, activeEditor: null, queryRegex: null, overlay: null, currentMatchMarker: null };
    }

    function highlightCurrentMatch() {
        if (state.currentMatchMarker) state.currentMatchMarker.clear();
        if (state.matches.length === 0) return;

        const match = state.matches[state.currentIndex];
        const editor = state.activeEditor;
        if (typeof editor.setHighlights === 'function') {
            editor.setHighlights(state.matches, state.currentIndex, searchInput.value);
        }
        state.currentMatchMarker = editor.markText(match.from, match.to, { className: 'cm-search-current' });
        editor.scrollIntoView(match.from, 100);
        updateMatchesInfo();
    }

    function updateMatchesInfo() {
        if (searchInput.value && state.matches.length > 0) {
            matchesInfo.textContent = `${state.currentIndex + 1} / ${state.matches.length}`;
        } else if (searchInput.value) {
            matchesInfo.textContent = "0 / 0";
        } else {
            matchesInfo.textContent = "";
        }
    }

    function buildCaseAccentInsensitiveRegex(text) {
        if (!text) return null;
        // Escapa caracteres especiales de regex
        const escapedText = text.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        return new RegExp(escapedText, 'gi'); // 'g' para global, 'i' para insensible a mayúsculas
    }

    function createSearchOverlay(queryRegex) {
        // La expresión regular para el overlay debe ser insensible a acentos
        const accentInsensitiveSource = queryRegex.source
            .replace(/a/gi, '[aàáâä]')
            .replace(/e/gi, '[eèéêë]')
            .replace(/i/gi, '[iìíîï]')
            .replace(/o/gi, '[oòóôö]')
            .replace(/u/gi, '[uùúûü]');
        const accentInsensitiveRegex = new RegExp(accentInsensitiveSource, 'gi');
        
        return {
            token: function(stream) {
                accentInsensitiveRegex.lastIndex = stream.pos;
                const match = accentInsensitiveRegex.exec(stream.string);
                if (match && match.index == stream.pos) {
                    stream.pos += match[0].length || 1;
                    return "search-highlight";
                } else if (match) {
                    stream.pos = match.index;
                } else {
                    stream.skipToEnd();
                }
            }
        };
    }
}

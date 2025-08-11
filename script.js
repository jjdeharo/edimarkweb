// Declaración de variables globales
let turndownService;
let isUpdating = false;
let syncLock = false; // Evita ReferenceError de código legado
let markdownEditor, htmlEditor;
const AUTOSAVE_KEY_PREFIX = 'edimarkweb-autosave';
const DOCS_LIST_KEY = 'edimarkweb-docslist';
const LAYOUT_KEY = 'edimarkweb-layout';
const FS_KEY = 'edimarkweb-fontsize';

let docs = [];
let currentId = null;
let currentLayout;
let syncEnabled = true;

// --- Funciones de gestión de pestañas y documentos ---
function saveDocsList() {
    const docList = docs.map(d => ({id: d.id, name: d.name}));
    localStorage.setItem(DOCS_LIST_KEY, JSON.stringify(docList));
}

function startRename(tab) {
    const tabNameSpan = tab.querySelector('.tab-name');
    if (!tabNameSpan || tab.querySelector('input')) return;

    const currentName = tabNameSpan.textContent;
    const docId = tab.dataset.id;
    const closeBtn = tab.querySelector('.tab-close');
    const dirtyIndicator = tab.querySelector('.tab-dirty');

    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentName;
    input.className = 'bg-white dark:bg-slate-800 border border-blue-500 rounded px-1 text-sm w-32';
    input.setAttribute('aria-label', 'Nuevo nombre del documento');

    tabNameSpan.style.display = 'none';
    if (closeBtn) closeBtn.style.display = 'none';

    tab.insertBefore(input, dirtyIndicator);
    input.focus();
    input.select();

    const finishRename = () => {
        const newName = input.value.trim();
        
        input.removeEventListener('blur', finishRename);
        input.removeEventListener('keydown', handleKey);
        if (input.parentNode) input.remove();

        tabNameSpan.style.display = '';
        if (closeBtn) closeBtn.style.display = '';

        if (newName && newName !== currentName) {
            const doc = docs.find(d => d.id === docId);
            if (doc) {
                doc.name = newName;
                tabNameSpan.textContent = newName;
                saveDocsList();
            }
        }
        tab.focus();
    };

    const handleKey = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            finishRename();
        } else if (e.key === 'Escape') {
            input.value = currentName;
            finishRename();
        }
    };

    input.addEventListener('blur', finishRename);
    input.addEventListener('keydown', handleKey);
}

function newDoc(name = 'Sin título', md = '') {
    const id = Date.now().toString(36) + Math.random().toString(36).substring(2);
    const newDoc = { id, name, md, lastSaved: md };
    docs.push(newDoc);
    addTabElement(newDoc);
    switchTo(id);
    saveDocsList();
    return newDoc;
}

function addTabElement({ id, name }) {
    const tabBar = document.getElementById('tab-bar');
    const tab = document.createElement('button');
    tab.className = "tab px-3 py-1 rounded-t-md flex items-center gap-2 text-sm";
    tab.dataset.id = id;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', 'false');
    tab.innerHTML = `
        <span class="tab-name">${name}</span>
        <span class="ml-1 text-red-500 tab-dirty hidden" title="Cambios sin guardar">●</span>
        <i data-lucide="x" class="tab-close w-4 h-4 opacity-50 hover:opacity-100"></i>
    `;
    tabBar.appendChild(tab);
    tab.addEventListener('dblclick', () => startRename(tab));
    if(window.lucide) lucide.createIcons();
}

function switchTo(id) {
    if (currentId && currentId !== id) {
        const previousDoc = docs.find(d => d.id === currentId);
        if (previousDoc) {
            previousDoc.md = markdownEditor.getValue();
            updateDirtyIndicator(previousDoc.id, previousDoc.md !== previousDoc.lastSaved);
        }
    }

    currentId = id;
    const doc = docs.find(d => d.id === id);
    if (!doc) return;

    document.querySelectorAll('.tab').forEach(t => {
        const isActive = t.dataset.id === id;
        t.setAttribute('aria-selected', isActive);
        t.classList.toggle('bg-white', isActive);
        t.classList.toggle('dark:bg-slate-900', isActive);
        t.classList.toggle('border-slate-200', isActive);
        t.classList.toggle('dark:border-slate-700', isActive);
        t.classList.toggle('border-transparent', !isActive);
    });

    markdownEditor.setValue(doc.md);
    updateHtml();
    markdownEditor.focus();
    updateDirtyIndicator(id, doc.md !== doc.lastSaved);
}

function closeDoc(id) {
    const docIndex = docs.findIndex(d => d.id === id);
    if (docIndex === -1) return;

    const doc = docs[docIndex];
    const isDirty = doc.md !== doc.lastSaved;

    if (isDirty && !confirm(`¿Cerrar "${doc.name}" sin guardar los cambios?`)) {
        return;
    }

    docs.splice(docIndex, 1);
    document.querySelector(`.tab[data-id="${id}"]`).remove();
    localStorage.removeItem(`${AUTOSAVE_KEY_PREFIX}-${id}`);
    saveDocsList();

    if (currentId === id) {
        if (docs.length > 0) {
            const newIndex = Math.max(0, docIndex - 1);
            switchTo(docs[newIndex].id);
        } else {
            currentId = null;
            markdownEditor.setValue('');
            updateHtml();
        }
    }
}

function updateDirtyIndicator(id, isDirty) {
    const tab = document.querySelector(`.tab[data-id="${id}"] .tab-dirty`);
    if (tab) {
        tab.classList.toggle('hidden', !isDirty);
    }
}

function openManualDoc(forceReload = false) {
    const manualDoc = docs.find(d => d.name === 'Manual');
    
    if (manualDoc && !forceReload) {
        switchTo(manualDoc.id);
        return;
    }

    fetch('manual.md')
        .then(r => r.ok ? r.text() : '# Manual\n\nError: No se pudo cargar el manual.')
        .then(md => {
            if (manualDoc && forceReload) {
                const doc = docs.find(d => d.id === manualDoc.id);
                doc.md = md;
                doc.lastSaved = md;
                switchTo(doc.id);
                updateDirtyIndicator(doc.id, false);
            } else {
                newDoc('Manual', md);
            }
        })
        .catch(err => {
            console.error("Error al cargar el manual:", err);
            if (!manualDoc) {
                newDoc('Manual', '# Error\n\nNo se pudo cargar el manual.');
            }
        });
}


// --- Funciones principales ---
function updateHtml() {
    if (isUpdating) return;
    isUpdating = true;
    const markdownText = markdownEditor.getValue();
    const htmlOutput = document.getElementById('html-output');
    
    const sanitizedText = markdownText.replace(/\\\\/g, '\\\\\\\\').replace(/\\\[/g, '\\\\[').replace(/\\\]/g, '\\\\]').replace(/\\\(/g, '\\\\(').replace(/\\\)/g, '\\\\)');
    
    if (window.marked) {
        const rawHtml = marked.parse(sanitizedText);
        htmlOutput.innerHTML = rawHtml;

        htmlOutput.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(h => {
          if (!h.id) {
            h.id = h.textContent.trim().toLowerCase().replace(/\s+/g,'-').replace(/[^\w\-áéíóúüñ]/g,'');
          }
        });

        if (htmlEditor && !htmlEditor.hasFocus()) {
            htmlEditor.setValue(rawHtml);
        }
    }

    try {
        if (window.renderMathInElement) {
            renderMathInElement(htmlOutput, {
                delimiters: [
                    {left: '$$', right: '$$', display: true}, {left: '\\[', right: '\\]', display: true},
                    {left: '$', right: '$', display: false}, {left: '\\(', right: '\\)', display: false}
                ], throwOnError: false
            });
        }
    } catch (error) { console.warn("KaTeX no está listo.", error); }
    
    if (currentId) {
        const doc = docs.find(d => d.id === currentId);
        if(doc) {
            updateDirtyIndicator(currentId, markdownEditor.getValue() !== doc.lastSaved);
        }
    }
    isUpdating = false;
}

function updateMarkdown() {
    if (isUpdating) return;
    isUpdating = true;
    const htmlOutput = document.getElementById('html-output');
    if (turndownService && !markdownEditor.hasFocus()) {
        markdownEditor.setValue(turndownService.turndown(htmlOutput.innerHTML));
    }
    isUpdating = false;
}

function applyFormat(format) {
    const cursor = markdownEditor.getCursor();
    const selectedText = markdownEditor.getSelection();
    const hadSelection = !!selectedText;
    let newText = '';

    switch (format) {
        case 'bold': 
          if (hadSelection) markdownEditor.replaceSelection(`**${selectedText}**`, 'around');
          else {
            markdownEditor.replaceSelection('****');
            markdownEditor.setCursor({ line: cursor.line, ch: cursor.ch + 2 });
          }
          break;
        case 'italic':
          if (hadSelection) markdownEditor.replaceSelection(`*${selectedText}*`, 'around');
          else {
            markdownEditor.replaceSelection('**');
            markdownEditor.setCursor({ line: cursor.line, ch: cursor.ch + 1 });
          }
          break;
        case 'code':
          if (hadSelection) markdownEditor.replaceSelection(`\`${selectedText}\`` , 'around');
          else {
            markdownEditor.replaceSelection('``');
            markdownEditor.setCursor({ line: cursor.line, ch: cursor.ch + 1 });
          }
          break;
        case 'latex-inline':
          if (hadSelection) markdownEditor.replaceSelection(`$${selectedText}$`, 'around');
          else {
            markdownEditor.replaceSelection('$$');
            markdownEditor.setCursor({ line: cursor.line, ch: cursor.ch + 1 });
          }
          break;
        case 'latex-block':
          if (hadSelection) markdownEditor.replaceSelection(`\n\\[\n${selectedText}\n\\]\n`, 'around');
          else {
            markdownEditor.replaceSelection('\n\\[\n\n\\]\n');
            markdownEditor.setCursor({ line: cursor.line + 2, ch: 0 });
          }
          break;
        
        case 'heading-1': newText = `\n# ${selectedText || 'Título 1'}\n`; break;
        case 'heading-2': newText = `\n## ${selectedText || 'Título 2'}\n`; break;
        case 'heading-3': newText = `\n### ${selectedText || 'Título 3'}\n`; break;
        case 'heading-4': newText = `\n#### ${selectedText || 'Título 4'}\n`; break;
        case 'quote': newText = `\n> ${selectedText || 'Cita'}\n`; break;
        case 'list-ul': 
            newText = hadSelection ? selectedText.split('\n').map(l => l.trim() ? `- ${l}` : '').join('\n') : '\n- ';
            break;
        case 'list-ol':
            newText = hadSelection ? selectedText.split('\n').map((l, i) => l.trim() ? `${i + 1}. ${l}` : '').join('\n') : '\n1. ';
            break;
        case 'link': toggleLinkModal(true, selectedText); return;
        case 'image': toggleImageModal(true, selectedText); return;
        case 'table': toggleTableModal(true); return;
    }
    
    if (newText) markdownEditor.replaceSelection(newText, 'around');
    markdownEditor.focus();
}

function toggleTableModal(show) { document.getElementById('table-modal-overlay').style.display = show ? 'flex' : 'none'; }
function toggleSaveModal(show) { 
    const doc = docs.find(d => d.id === currentId);
    if(doc) {
        document.getElementById('filename').value = doc.name.replace(/\.(md|html)$/i, '');
    }
    document.getElementById('save-modal-overlay').style.display = show ? 'flex' : 'none'; 
}
function toggleClearModal(show) { document.getElementById('clear-modal-overlay').style.display = show ? 'flex' : 'none'; }

function toggleLinkModal(show, presetText = '') {
    document.getElementById('link-modal-overlay').style.display = show ? 'flex' : 'none';
    if (show) {
        document.getElementById('link-text').value = presetText;
        document.getElementById('link-url').value  = '';
        setTimeout(() => document.getElementById(presetText ? 'link-url' : 'link-text').focus(), 0);
    }
}

function toggleImageModal(show, presetText = '') {
    document.getElementById('image-modal-overlay').style.display = show ? 'flex' : 'none';
    if (show) {
        document.getElementById('image-alt-text').value = presetText;
        document.getElementById('image-url').value  = '';
        setTimeout(() => document.getElementById(presetText ? 'image-url' : 'image-alt-text').focus(), 0);
    }
}

function saveFile(filename, content, type) {
    const blob = new Blob([content], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
}

async function copyPlain(text, btn) {
    const originalIcon = btn.innerHTML;
    try {
        await navigator.clipboard.writeText(text);
        btn.innerHTML = '<i data-lucide="check" class="text-green-500"></i>';
    } catch (err) {
        console.error('No se pudo copiar:', err);
        btn.innerHTML = '<i data-lucide="x" class="text-red-500"></i>';
    } finally {
        if (window.lucide) lucide.createIcons();
        setTimeout(() => { btn.innerHTML = originalIcon; if (window.lucide) lucide.createIcons(); }, 2000);
    }
}

async function copyRich(html, btn) {
  const originalIcon = btn.innerHTML;
  try {
    if (navigator.clipboard && navigator.clipboard.write && window.ClipboardItem) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html' : new Blob([html], { type:'text/html'  }),
          'text/plain': new Blob([html], { type:'text/plain' })
        })
      ]);
    } else {
      await navigator.clipboard.writeText(html);
    }
    btn.innerHTML = '<i data-lucide="check" class="text-green-500"></i>';
  } catch (err) {
    console.error('No se pudo copiar:', err);
    btn.innerHTML = '<i data-lucide="x" class="text-red-500"></i>';
  } finally {
    if (window.lucide) lucide.createIcons();
    setTimeout(() => { btn.innerHTML = originalIcon; if (window.lucide) lucide.createIcons(); }, 2000);
  }
}

function buildHtmlWithTex() {
  const htmlOutput = document.getElementById('html-output');
  const clone = htmlOutput.cloneNode(true);
  clone.querySelectorAll('.katex-display').forEach(div => {
    const tex = div.querySelector('annotation[encoding="application/x-tex"]')?.textContent || '';
    div.replaceWith(document.createTextNode(`\n\\[\n${tex}\n\\]\n`));
  });
  clone.querySelectorAll('span.katex').forEach(span => {
    if (span.closest('.katex-display')) return;
    const tex = span.querySelector('annotation[encoding="application/x-tex"]')?.textContent || '';
    span.replaceWith(document.createTextNode(`\\(${tex}\\)`));
  });
  return clone.innerHTML;
}

function applyLayout(layout) {
  currentLayout = layout;
  syncEnabled = (layout === 'dual');
  localStorage.setItem(LAYOUT_KEY, layout);

  const mdPanel = document.getElementById('markdown-panel');
  const htmlPanel = document.getElementById('html-panel');
  const gutters = document.querySelectorAll('.gutter');
  const layoutToggleBtn = document.getElementById('layout-toggle-btn');
  
  layoutToggleBtn.setAttribute('aria-pressed', layout !== 'dual');

  switch (layout) {
    case 'md':
      mdPanel.style.display = 'block';
      htmlPanel.style.display = 'none';
      gutters.forEach(g => g.style.display = 'none');
      mdPanel.style.width = '100%';
      break;
    case 'html':
      mdPanel.style.display = 'none';
      htmlPanel.style.display = 'block';
      gutters.forEach(g => g.style.display = 'none');
      htmlPanel.style.width = '100%';
      break;
    default:
      mdPanel.style.display = 'block';
      htmlPanel.style.display = 'block';
      gutters.forEach(g => g.style.display = '');
      mdPanel.style.width = '50%';
      htmlPanel.style.width = '50%';
  }
  
  const iconMap = { dual: 'layout', md: 'align-left', html: 'align-right' };
  layoutToggleBtn.innerHTML = `<i data-lucide="${iconMap[layout]}"></i>`;
  if(window.lucide) lucide.createIcons();

  setTimeout(() => {
    if (layout !== 'html') markdownEditor.refresh();
    if (layout !== 'md') htmlEditor.refresh();
  }, 10);
}

function applyFontSize(px) {
  document.documentElement.style.setProperty('--fs-base', px + 'px');
  localStorage.setItem(FS_KEY, px);
  if (markdownEditor) markdownEditor.refresh();
  if (htmlEditor) htmlEditor.refresh();
}


window.onload = () => {
    // --- Obtención de elementos del DOM ---
    const mainContainer = document.getElementById('main-container');
    const toggleWidthBtn = document.getElementById('toggle-width-btn');
    const htmlOutput = document.getElementById('html-output');
    const viewToggleBtn = document.getElementById('view-toggle-btn');
    const htmlPanelTitle = document.getElementById('html-panel-title');
    const toolbar = document.getElementById('toolbar');
    const openFileBtn = document.getElementById('open-file-btn');
    const fileInput = document.getElementById('file-input');
    const saveBtn = document.getElementById('save-btn');
    const printBtn = document.getElementById('print-btn');
    const helpBtn = document.getElementById('help-btn');
    const clearAllBtn = document.getElementById('clear-all-btn');
    const copyMdBtn = document.getElementById('copy-md-btn');
    const copyHtmlBtn = document.getElementById('copy-html-btn');
    const headingBtn = document.getElementById('heading-btn');
    const headingOptions = document.getElementById('heading-options');
    const headingDropdownContainer = document.getElementById('heading-dropdown-container');
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const layoutToggleBtn = document.getElementById('layout-toggle-btn');
    const fontSizeSelect = document.getElementById('font-size-select');
    const newTabBtn = document.getElementById('new-tab-btn');
    const tabBar = document.getElementById('tab-bar');
    
    // --- Elementos de modales ---
    const tableModalOverlay = document.getElementById('table-modal-overlay');
    const createTableBtn = document.getElementById('create-table-btn');
    const cancelTableBtn = document.getElementById('cancel-table-btn');
    const saveModalOverlay = document.getElementById('save-modal-overlay');
    const confirmSaveBtn = document.getElementById('confirm-save-btn');
    const cancelSaveBtn = document.getElementById('cancel-save-btn');
    const clearModalOverlay = document.getElementById('clear-modal-overlay');
    const confirmClearBtn = document.getElementById('confirm-clear-btn');
    const cancelClearBtn = document.getElementById('cancel-clear-btn');
    const linkModalOverlay = document.getElementById('link-modal-overlay');
    const insertLinkBtn = document.getElementById('insert-link-btn');
    const cancelLinkBtn = document.getElementById('cancel-link-btn');
    const imageModalOverlay = document.getElementById('image-modal-overlay');
    const insertImageBtn = document.getElementById('insert-image-btn');
    const cancelImageBtn = document.getElementById('cancel-image-btn');

    // --- Inicialización de librerías ---
    if (window.TurndownService) {
        turndownService = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
    }

    markdownEditor = CodeMirror.fromTextArea(document.getElementById('markdown-input'), {
        mode: 'gfm', theme: 'eclipse', lineNumbers: true,
        lineWrapping: true, autofocus: true,
        extraKeys: {
            'Enter': 'newlineAndIndentContinueMarkdownList',
            'Tab': 'indentMore',
            'Shift-Tab': 'indentLess'
        }
    });

    htmlEditor = CodeMirror.fromTextArea(document.getElementById('html-source-view'), {
        mode: 'htmlmixed', theme: 'eclipse', lineNumbers: true, lineWrapping: true
    });
    const cmWrapper = htmlEditor.getWrapperElement();
    cmWrapper.style.display = 'none';
    
    // --- INICIO DE LA CORRECCIÓN ---
    toggleWidthBtn.addEventListener('click', () => {
        mainContainer.classList.toggle('is-expanded');
        const isExpanded = mainContainer.classList.contains('is-expanded');
        const iconName = isExpanded ? 'minimize' : 'maximize';
        // Se regenera el contenido del botón para que Lucide lo vuelva a procesar
        toggleWidthBtn.innerHTML = `<i data-lucide="${iconName}"></i>`;
        lucide.createIcons();
    });
    // --- FIN DE LA CORRECCIÓN ---

    // --- Gestión del tema (claro/oscuro) ---
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    const storedTheme = localStorage.getItem('theme');

    function applyTheme(theme) {
      document.documentElement.classList.toggle('dark', theme === 'dark');
      localStorage.setItem('theme', theme);
      const newEditorTheme = theme === 'dark' ? 'material-darker' : 'eclipse';
      markdownEditor.setOption('theme', newEditorTheme);
      htmlEditor.setOption('theme', newEditorTheme);
      const icon = theme === 'dark' ? 'moon' : 'sun';
      themeToggleBtn.innerHTML = `<i data-lucide="${icon}"></i>`;
      if (window.lucide) lucide.createIcons();
    }

    if (storedTheme) applyTheme(storedTheme);
    else applyTheme(prefersDark.matches ? 'dark' : 'light');
    prefersDark.addEventListener('change', (e) => {
      if (!localStorage.getItem('theme')) applyTheme(e.matches ? 'dark' : 'light');
    });
    themeToggleBtn.addEventListener('click', () => {
      const newTheme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
      applyTheme(newTheme);
    });

    // --- Paneles redimensionables y diseño ---
    Split(['#markdown-panel', '#html-panel'], {
        sizes: [50, 50],
        minSize: 280,
        gutterSize: 8,
        onDrag: () => { markdownEditor.refresh(); htmlEditor.refresh(); }
    });
    currentLayout = localStorage.getItem(LAYOUT_KEY) || 'dual';
    applyLayout(currentLayout);

    // --- Tamaño de fuente ---
    const savedFs = localStorage.getItem(FS_KEY) || 16;
    fontSizeSelect.value = savedFs;
    applyFontSize(savedFs);
    fontSizeSelect.addEventListener('change', e => applyFontSize(e.target.value));

    // --- Carga inicial de documentos y autoguardado ---
    const savedDocsList = JSON.parse(localStorage.getItem(DOCS_LIST_KEY) || '[]');
    if (savedDocsList.length > 0) {
        savedDocsList.forEach(docInfo => {
            const md = localStorage.getItem(`${AUTOSAVE_KEY_PREFIX}-${docInfo.id}`) || '';
            docs.push({ ...docInfo, md, lastSaved: md });
            addTabElement(docInfo);
        });
        switchTo(docs[0].id);
    } else {
        openManualDoc();
    }
    
    setInterval(() => {
        if (currentId) {
            const content = markdownEditor.getValue();
            const doc = docs.find(d => d.id === currentId);
            if (doc) doc.md = content;
            localStorage.setItem(`${AUTOSAVE_KEY_PREFIX}-${currentId}`, content);
        }
    }, 3000);

    // --- Eventos de la barra de herramientas ---
    toolbar.addEventListener('click', (e) => {
        const button = e.target.closest('button');
        if (button && button.dataset.format) {
            applyFormat(button.dataset.format);
            if (button.dataset.format.startsWith('heading-')) {
                headingOptions.classList.add('hidden');
            }
        }
    });
    
    headingBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        headingOptions.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
        if (!headingDropdownContainer.contains(e.target)) {
            headingOptions.classList.add('hidden');
        }
    });

    // --- Eventos de los botones principales y pestañas ---
    newTabBtn.addEventListener('click', () => newDoc());
    helpBtn.addEventListener('click', (e) => openManualDoc(e.ctrlKey || e.metaKey));
    tabBar.addEventListener('click', (e) => {
        const tab = e.target.closest('.tab');
        const closeBtn = e.target.closest('.tab-close');
        if (closeBtn && tab) { e.stopPropagation(); closeDoc(tab.dataset.id); } 
        else if (tab) { switchTo(tab.dataset.id); }
    });

    layoutToggleBtn.addEventListener('click', () => {
      const layouts = ['dual', 'md', 'html'];
      const next = layouts[(layouts.indexOf(currentLayout) + 1) % layouts.length];
      applyLayout(next);
    });

    viewToggleBtn.addEventListener('click', () => {
        const isPreviewVisible = htmlOutput.style.display !== 'none';
        cmWrapper.style.display = isPreviewVisible ? 'block' : 'none';
        htmlOutput.style.display = isPreviewVisible ? 'none' : 'block';
        if (isPreviewVisible) setTimeout(() => htmlEditor.refresh(), 1);
        htmlPanelTitle.textContent = isPreviewVisible ? 'Código HTML' : 'Previsualización';
        viewToggleBtn.innerHTML = isPreviewVisible ? '<i data-lucide="eye"></i>' : '<i data-lucide="code-2"></i>';
        if (window.lucide) lucide.createIcons();
    });
    
    openFileBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const doc = newDoc(file.name, e.target.result);
            doc.lastSaved = e.target.result;
            updateDirtyIndicator(doc.id, false);
        };
        reader.readAsText(file);
        fileInput.value = '';
    });

    copyMdBtn.addEventListener('click', () => copyPlain(markdownEditor.getValue(), copyMdBtn));
    copyHtmlBtn.addEventListener('click', () => {
       const isPreview = htmlOutput.style.display !== 'none';
       const html = isPreview ? buildHtmlWithTex() : htmlEditor.getValue();
       copyRich(html, copyHtmlBtn);
    });
    
    printBtn.addEventListener('click', () => {
        const printContent = document.getElementById('html-output').innerHTML;
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(`<!DOCTYPE html><html><head><title>Imprimir</title><script src="https://cdn.tailwindcss.com?plugins=typography"><\/script><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css"><style>body { margin: 1.5rem; -webkit-print-color-adjust: exact; print-color-adjust: exact; }<\/style></head><body class="prose max-w-none">${printContent}</body></html>`);
        doc.close();
        setTimeout(() => {
            iframe.contentWindow.print();
            document.body.removeChild(iframe);
        }, 400);
    });

    // --- Eventos de los modales ---
    createTableBtn.addEventListener('click', () => {
        const cols = parseInt(document.getElementById('table-cols').value, 10) || 2;
        const rows = parseInt(document.getElementById('table-rows').value, 10) || 1;
        let tableMd = '\n|';
        for (let i = 1; i <= cols; i++) tableMd += ` Cabecera ${i} |`;
        tableMd += '\n|';
        for (let i = 0; i < cols; i++) tableMd += '------------|';
        tableMd += '\n';
        for (let r = 0; r < rows; r++) {
            tableMd += '|';
            for (let c = 0; c < cols; c++) tableMd += ' Celda      |';
            tableMd += '\n';
        }
        markdownEditor.replaceSelection(tableMd);
        toggleTableModal(false);
        markdownEditor.focus();
    });
    cancelTableBtn.addEventListener('click', () => toggleTableModal(false));
    tableModalOverlay.addEventListener('click', (e) => { if (e.target === tableModalOverlay) toggleTableModal(false); });
    
    saveBtn.addEventListener('click', () => toggleSaveModal(true));
    confirmSaveBtn.addEventListener('click', () => {
        const filenameInput = document.getElementById('filename');
        let filename = filenameInput.value || 'documento';
        const isMd = document.getElementById('format-md').checked;
        const extension = isMd ? '.md' : '.html';
        if (!filename.endsWith(extension)) filename += extension;
        const content = isMd ? markdownEditor.getValue() : `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${filename.replace(/\.html$/, '')}</title><script src="https://cdn.tailwindcss.com?plugins=typography"><\/script><script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"><\/script><style>body { margin: 2rem; } .prose { max-width: 80ch; margin: auto; } </style></head><body class="prose max-w-none">${buildHtmlWithTex()}</body></html>`;
        saveFile(filename, content, isMd ? 'text/markdown;charset=utf-8' : 'text/html;charset=utf-8');
        const doc = docs.find(d => d.id === currentId);
        if (doc) {
            const displayName = filename.replace(/\.(md|html)$/i, '');
            doc.lastSaved = markdownEditor.getValue();
            doc.name = displayName;
            document.querySelector(`.tab[data-id="${currentId}"] .tab-name`).textContent = displayName;
            updateDirtyIndicator(currentId, false);
            saveDocsList();
        }
        toggleSaveModal(false);
    });
    cancelSaveBtn.addEventListener('click', () => toggleSaveModal(false));
    saveModalOverlay.addEventListener('click', (e) => { if (e.target === saveModalOverlay) toggleSaveModal(false); });

    clearAllBtn.addEventListener('click', () => toggleClearModal(true));
    confirmClearBtn.addEventListener('click', () => {
      markdownEditor.setValue('');
      htmlEditor.setValue('');
      document.getElementById('html-output').innerHTML = '';
      if(currentId) {
          const doc = docs.find(d => d.id === currentId);
          if(doc) { doc.md = ''; doc.lastSaved = ''; updateDirtyIndicator(currentId, false); }
      }
      toggleClearModal(false);
      markdownEditor.focus();
    });
    cancelClearBtn.addEventListener('click', () => toggleClearModal(false));
    clearModalOverlay.addEventListener('click', (e) => { if (e.target === clearModalOverlay) toggleClearModal(false); });
    
    insertLinkBtn.addEventListener('click', () => {
      const text = document.getElementById('link-text').value.trim() || 'enlace';
      const url  = document.getElementById('link-url').value.trim()  || '#';
      markdownEditor.replaceSelection(`[${text}](${url})`);
      toggleLinkModal(false);
      markdownEditor.focus();
    });
    cancelLinkBtn.addEventListener('click', () => toggleLinkModal(false));
    linkModalOverlay.addEventListener('click', e => { if (e.target === linkModalOverlay) toggleLinkModal(false); });
    
    insertImageBtn.addEventListener('click', () => {
      const alt = document.getElementById('image-alt-text').value.trim() || 'imagen';
      const url = document.getElementById('image-url').value.trim() || '#';
      markdownEditor.replaceSelection(`![${alt}](${url})`);
      toggleImageModal(false);
      markdownEditor.focus();
    });
    cancelImageBtn.addEventListener('click', () => toggleImageModal(false));
    imageModalOverlay.addEventListener('click', e => { if (e.target === imageModalOverlay) toggleImageModal(false); });

    // --- Atajos de teclado y otros ---
    window.addEventListener('beforeunload', (e) => {
        const hasUnsaved = docs.some(d => d.md !== d.lastSaved);
        if (hasUnsaved) { e.preventDefault(); e.returnValue = 'Hay documentos con cambios sin guardar. ¿Seguro que quieres salir?'; }
    });

    const isMac = navigator.platform.includes('Mac');
    let ctrlPressed = false;
    let currentHoveredLink = null;
    
    const shortcutMap = { 'b': 'bold', 'i': 'italic', '`': 'code', 'k': 'link', 'm': 'latex-inline', 'M': 'latex-block', 'Q': 'quote', 'L': 'list-ul', 'O': 'list-ol', 'T': 'table', 'I': 'image', '1': 'heading-1', '2': 'heading-2', '3': 'heading-3', '4': 'heading-4' };

    document.addEventListener('keydown', e => {
        const accel = isMac ? e.metaKey : e.ctrlKey;
        if (accel) ctrlPressed = true;

        if (document.getElementById('search-wrapper').classList.contains('hidden')) {
            if (accel && e.key.toLowerCase() === 't') { e.preventDefault(); newTabBtn.click(); }
            if (accel && e.key.toLowerCase() === 'w') { e.preventDefault(); if (currentId) closeDoc(currentId); }
            if (accel && e.key === 'Tab') {
                e.preventDefault();
                if(docs.length < 2) return;
                const currentIndex = docs.findIndex(d => d.id === currentId);
                const nextIndex = (e.shiftKey ? currentIndex - 1 + docs.length : currentIndex + 1) % docs.length;
                switchTo(docs[nextIndex].id);
            }

            if (!accel) return;
            switch (e.key.toLowerCase()) {
                case 's': e.preventDefault(); saveBtn.click(); break;
                case 'p': e.preventDefault(); printBtn.click(); break;
                case 'l': e.preventDefault(); layoutToggleBtn.click(); break;
                case 'h': e.preventDefault(); openManualDoc(e.shiftKey); break;
            }
            if (['=', '+', '-'].includes(e.key)) {
                e.preventDefault();
                const sizes = [14, 16, 18, 20];
                let idx = sizes.indexOf(Number(fontSizeSelect.value));
                idx = e.key === '-' ? Math.max(0, idx - 1) : Math.min(sizes.length - 1, idx + 1);
                fontSizeSelect.value = sizes[idx];
                applyFontSize(sizes[idx]);
            }
            const key = e.shiftKey ? e.key.toUpperCase() : e.key.toLowerCase();
            if (shortcutMap[key]) { e.preventDefault(); applyFormat(shortcutMap[key]); }
        }
    });

    document.addEventListener('keyup', e => {
        if (!e.metaKey && !e.ctrlKey) {
            ctrlPressed = false;
            if (currentHoveredLink) { currentHoveredLink.classList.remove('ctrl-hover'); currentHoveredLink.title = ''; currentHoveredLink = null; }
        }
    });

    window.addEventListener('blur', () => {
        ctrlPressed = false;
        if (currentHoveredLink) { currentHoveredLink.classList.remove('ctrl-hover'); currentHoveredLink.title = ''; currentHoveredLink = null; }
    });

    htmlOutput.addEventListener('mousemove', e => {
        const targetLink = e.target.closest('a');
        if (ctrlPressed && targetLink) {
            if (currentHoveredLink !== targetLink) {
                if (currentHoveredLink) currentHoveredLink.classList.remove('ctrl-hover');
                targetLink.classList.add('ctrl-hover');
                targetLink.title = 'Ctrl + clic para abrir enlace';
                currentHoveredLink = targetLink;
            }
        } else if (currentHoveredLink) {
            currentHoveredLink.classList.remove('ctrl-hover');
            currentHoveredLink.title = '';
            currentHoveredLink = null;
        }
    });
    
    if (window.lucide) lucide.createIcons();
    document.querySelectorAll('button[title]').forEach(btn => {
        if (!btn.hasAttribute('aria-label')) { btn.setAttribute('aria-label', btn.title.replace(/\s*\(.+\)$/, '')); }
    });

    // --- Sincronización ---
    function scrollMarkdownToRatio(r) {
      if (!syncEnabled) return;
      const scroller = markdownEditor.getScrollerElement();
      scroller.scrollTop = r * (scroller.scrollHeight - scroller.clientHeight);
    }
    function syncFromMarkdown() {
      if (!syncEnabled) return;
      const lineRatio = markdownEditor.getCursor().line / Math.max(1, markdownEditor.lineCount() - 1);
      htmlOutput.scrollTop = lineRatio * (htmlOutput.scrollHeight - htmlOutput.clientHeight);
    }
    markdownEditor.on('change', () => { requestAnimationFrame(() => { updateHtml(); syncFromMarkdown(); }); });
    htmlOutput.addEventListener('click', e => {
      if (ctrlPressed && e.target.closest('a')) {
          const a = e.target.closest('a');
          const href = a.getAttribute('href') || '';
          e.preventDefault(); e.stopPropagation();
          if (href.startsWith('#')) {
              const target = htmlOutput.querySelector(href);
              if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } else {
              window.open(a.href, '_blank', 'noopener');
          }
          return;
      }
      const clickY = e.clientY - htmlOutput.getBoundingClientRect().top + htmlOutput.scrollTop;
      const ratio  = clickY / Math.max(1, htmlOutput.scrollHeight);
      scrollMarkdownToRatio(ratio);
    });
    htmlEditor.getWrapperElement().addEventListener('mouseup', () => {
      requestAnimationFrame(() => {
        htmlOutput.innerHTML = htmlEditor.getValue();
        updateMarkdown();
        const lineRatio = htmlEditor.getCursor().line / Math.max(1, htmlEditor.lineCount() - 1);
        scrollMarkdownToRatio(lineRatio);
      });
    });

    if (typeof initSearch === 'function') {
        initSearch(markdownEditor, htmlEditor, () => currentLayout);
    }
};

/* =========================================================
   Arrastrar .md con "fondo por detrás" para soltar en toda la app
   ========================================================= */
(function () {
  // Limpia posibles versiones anteriores
  for (const id of ['drop-backdrop']) {
    const el = document.getElementById(id);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  // Backdrop: capa que no captura eventos (pointer-events:none)
  const backdrop = document.createElement('div');
  backdrop.id = 'drop-backdrop';
  backdrop.className = [
    'fixed inset-0 hidden z-[45] drop-dim',
    'flex items-center justify-center'
  ].join(' ');

  // Marco interior (no bloquea clics, solo visual)
  const frame = document.createElement('div');
  frame.className = [
    'pointer-events-none relative',
    'inset-0 w-[min(95vw,1100px)] h-[min(70vh,520px)]',
    'rounded-2xl border-4 drop-outline border-blue-400/70 dark:border-blue-300/70',
    'shadow-2xl drop-ants'
  ].join(' ');

  // Mensaje central con icono
  const center = document.createElement('div');
  center.className = 'absolute inset-0 grid place-content-center text-center';
  center.innerHTML = [
    '<div class="pointer-events-none px-6 py-5 rounded-xl bg-white/85 dark:bg-slate-900/80 ring-1 ring-slate-200 dark:ring-slate-700">',
      '<div class="flex flex-col items-center gap-2">',
        '<i data-lucide="arrow-down-to-line" class="w-14 h-14 text-slate-600 dark:text-slate-200"></i>',
        '<p class="drop-hint text-lg font-semibold text-slate-800 dark:text-slate-100">Suelta aquí para abrir en una pestaña nueva</p>',
        '<p class="drop-hint text-sm text-slate-600 dark:text-slate-300">Archivos Markdown (.md, .markdown). También puedes soltar varios.</p>',
      '</div>',
    '</div>'
  ].join('');

  backdrop.appendChild(frame);
  backdrop.appendChild(center);
  document.body.prepend(backdrop); // "por detrás" del resto al insertarlo primero, aunque se ve encima visualmente

  // Render de iconos lucide si están cargados
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons(backdrop);
  }

  // Utilidad: ¿hay archivos en el DataTransfer?
  function hasFiles(e) {
    const dt = e.dataTransfer;
    if (!dt) return false;
    return Array.from(dt.types || []).includes('Files') || (dt.files && dt.files.length > 0);
  }

  let dragDepth = 0;
  const tabBar = document.getElementById('tab-bar');
  const newTabBtn = document.getElementById('new-tab-btn');

  function addHalo() {
    tabBar && tabBar.classList.add('ring-2','ring-blue-500','ring-offset-2','ring-offset-transparent','animate-pulse');
    newTabBtn && newTabBtn.classList.add('ring-2','ring-blue-500','rounded-md','animate-pulse');
  }
  function removeHalo() {
    tabBar && tabBar.classList.remove('ring-2','ring-blue-500','ring-offset-2','ring-offset-transparent','animate-pulse');
    newTabBtn && newTabBtn.classList.remove('ring-2','ring-blue-500','rounded-md','animate-pulse');
  }

  // Eventos de arrastre globales
  document.addEventListener('dragenter', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth++;
    backdrop.classList.remove('hidden');
    addHalo();
  });

  document.addEventListener('dragover', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
  });

  document.addEventListener('dragleave', (e) => {
    if (!hasFiles(e)) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) {
      backdrop.classList.add('hidden');
      removeHalo();
    }
  });

  function handleDrop(e) {
    e.preventDefault();
    backdrop.classList.add('hidden');
    removeHalo();
    dragDepth = 0;

    const files = Array.from(e.dataTransfer?.files || []);
    if (!files.length) return;

    const mdFiles = files.filter(f => {
      const name = (f.name || '').toLowerCase();
      return /\.md$|\.markdown$/.test(name) || (f.type && f.type === 'text/markdown');
    });

    if (!mdFiles.length) {
      alert('Solo se pueden soltar archivos Markdown (.md/.markdown)');
      return;
    }

    mdFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const content = ev.target?.result || '';
          const doc = (typeof newDoc === 'function')
            ? newDoc(file.name || 'Sin título', content)
            : null;

          if (doc && typeof updateDirtyIndicator === 'function') {
            doc.lastSaved = content;
            updateDirtyIndicator(doc.id, false);
          }
        } catch (err) {
          console.error('No se pudo abrir el archivo arrastrado:', err);
        }
      };
      reader.readAsText(file);
    });
  }

  document.addEventListener('drop', handleDrop);
  backdrop.addEventListener('drop', handleDrop);
})();


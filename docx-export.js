/*
  DOCX export helper for EdiMarkWeb.
  Reuses the Pandoc WASM bridge from MDAITex (pandoc-wasm.js).
*/
import { pandoc } from './pandoc-wasm.js';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const PANDOC_WASM_SOURCES = [
  { url: 'pandoc.b64', gzip: false },
  { url: 'pandoc.b64.gz', gzip: true },
  { url: 'https://raw.githubusercontent.com/mdaitex/mdaitex.github.io/main/pandoc.b64', gzip: false },
  { url: 'https://raw.githubusercontent.com/mdaitex/mdaitex.github.io/main/pandoc.b64.gz', gzip: true },
];
const MAX_RETRIES = 3;
const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

let base64PandocWasm = null;
let pandocInitialized = false;
let initializationAttempts = 0;

function translate(key, fallback = '') {
  const catalog = window.__edimarkTranslations;
  if (catalog && Object.prototype.hasOwnProperty.call(catalog, key)) {
    return catalog[key];
  }
  return fallback;
}

function normalizeNewlines(str) {
  return typeof str === 'string' ? str.replace(/\r\n?/g, '\n') : '';
}

// Matches the inline math trim used in MDAITex.
function trimInlineMath(content) {
  if (typeof content !== 'string') return '';
  return content.replace(/\$(\s*)([^$\n]+?)(\s*)\$(?!\$)/g, (_match, _p1, expr) => {
    return `$${expr}$`;
  });
}

async function readResponseAsText(response, gzip, throttled = false) {
  if (!gzip) {
    if (throttled || isIOS) {
      const reader = response.body?.getReader();
      if (!reader) {
        return (await response.text()).trim();
      }
      let result = '';
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        result += decoder.decode(value, { stream: true });
        if (throttled) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
      result += decoder.decode();
      return result.trim();
    }
    return (await response.text()).trim();
  }

  if (typeof DecompressionStream === 'function' && response.body) {
    const decompressedStream = response.body.pipeThrough(new DecompressionStream('gzip'));
    const reader = decompressedStream.getReader();
    let result = '';
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      result += decoder.decode(value, { stream: true });
      if (throttled) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    result += decoder.decode();
    return result.trim();
  }

  // Fallback: rely on server-side decompression if available.
  return '';
}

async function loadPandocWasm({ onStatus } = {}, silent = false) {
  if (base64PandocWasm && pandocInitialized) {
    return base64PandocWasm;
  }

  if (initializationAttempts >= MAX_RETRIES) {
    throw new Error('pandoc_init_max_retries');
  }
  initializationAttempts += 1;

  if (!silent && typeof onStatus === 'function') {
    onStatus(translate('initializing_pandoc', 'Inicializando Pandoc...'));
  }

  try {
    for (const source of PANDOC_WASM_SOURCES) {
      try {
        const response = await fetch(source.url, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const throttled = isIOS && !source.gzip;
        const text = await readResponseAsText(response, source.gzip, throttled);
        if (text) {
          base64PandocWasm = text;
          break;
        }
      } catch (innerError) {
        console.warn(`Fallo al cargar ${source.url}:`, innerError);
      }
    }

    if (!base64PandocWasm) {
      throw new Error('pandoc_wasm_unavailable');
    }
    if (base64PandocWasm.length < 1000) {
      throw new Error('pandoc_wasm_invalid');
    }

    pandocInitialized = true;
    return base64PandocWasm;
  } catch (error) {
    console.error(`Error en carga WASM (intento ${initializationAttempts}):`, error);
    if (initializationAttempts < MAX_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, 1000 * initializationAttempts));
      return loadPandocWasm({ onStatus }, silent);
    }
    throw error;
  }
}

function triggerStatus(onStatus, key, fallback, extra = '') {
  if (typeof onStatus === 'function') {
    const base = translate(key, fallback);
    onStatus(extra ? `${base} ${extra}`.trim() : base);
  }
}

function triggerNotification(onNotification, key, fallback) {
  if (typeof onNotification === 'function') {
    const message = translate(key, fallback);
    if (message) {
      onNotification(message);
    }
  }
}

function saveBlob(blob, filename) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => {
    URL.revokeObjectURL(link.href);
  }, 1000);
}

async function exportMarkdownToDocx({
  markdown = '',
  onStatus = () => {},
  onNotification = () => {},
  outputFilename = 'documento.docx',
} = {}) {
  const normalized = normalizeNewlines(trimInlineMath(markdown || ''));
  if (!normalized.trim()) {
    const message = translate('no_content', 'No hay contenido para exportar.');
    throw new Error(message || 'No content');
  }

  const preparingKey = 'docx_export_preparing';
  triggerStatus(onStatus, preparingKey, 'Preparando DOCX, espera...');

  let iosTimer;
  if (isIOS) {
    const iosAdvice = translate('ios_specific_advice', '');
    if (iosAdvice) {
      iosTimer = setTimeout(() => {
        triggerStatus(onStatus, preparingKey, 'Preparando DOCX, espera...', iosAdvice);
      }, 1000);
    }
  }

  try {
    const base64 = await loadPandocWasm({ onStatus });
    const resultadoBytes = await pandoc('-f markdown -t docx', normalized, base64);
    if (iosTimer) clearTimeout(iosTimer);

    const blob = new Blob([resultadoBytes], { type: DOCX_MIME });
    saveBlob(blob, outputFilename);

    triggerStatus(onStatus, 'docx_export_done', 'Exportación a DOCX completada.');
  } catch (error) {
    if (iosTimer) clearTimeout(iosTimer);
    triggerStatus(onStatus, 'docx_export_error', 'Error durante la exportación a DOCX.');
    if (isIOS) {
      triggerNotification(onNotification, 'ios_specific_advice', 'En iOS, si el problema persiste, prueba a cerrar y reiniciar el navegador.');
    }
    throw error;
  }
}

window.DocxExporter = {
  exportMarkdownToDocx,
  trimInlineMath,
};

export { exportMarkdownToDocx, trimInlineMath };

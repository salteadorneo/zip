let isLoadingZip = false;
let urlInputDebounceTimer = null;

const STORAGE_KEYS = {
    ZIP_URL: 'zip_last_url',
    ZIP_BLOB: 'zip_blob_data',
    ZIP_NAME: 'zip_name'
};

async function saveZipToStorage(blob, name, sourceUrl = null) {
    try {
        if (blob.size > 5 * 1024 * 1024 && 'indexedDB' in window) {
            const db = await new Promise((resolve, reject) => {
                const req = indexedDB.open('ZipStorage', 1);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
                req.onupgradeneeded = (e) => {
                    const store = e.target.result.createObjectStore('zips', { keyPath: 'id' });
                };
            });

            const store = db.transaction('zips', 'readwrite').objectStore('zips');
            store.clear();
            store.add({ id: 'current', blob, name, sourceUrl, timestamp: Date.now() });
            
            localStorage.setItem(STORAGE_KEYS.ZIP_NAME, name);
            if (sourceUrl) localStorage.setItem(STORAGE_KEYS.ZIP_URL, sourceUrl);
            localStorage.setItem('zip_in_idb', 'true');
        } else {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    localStorage.setItem(STORAGE_KEYS.ZIP_BLOB, e.target.result);
                    localStorage.setItem(STORAGE_KEYS.ZIP_NAME, name);
                    if (sourceUrl) localStorage.setItem(STORAGE_KEYS.ZIP_URL, sourceUrl);
                    localStorage.removeItem('zip_in_idb');
                } catch (e) {
                    console.warn('No se puede guardar en localStorage:', e.message);
                }
            };
            reader.readAsDataURL(blob);
        }
    } catch (e) {
        console.warn('Error guardando ZIP:', e.message);
    }
}

async function loadZipFromStorage() {
    try {
        if (localStorage.getItem('zip_in_idb') === 'true') {
            try {
                const db = await new Promise((resolve, reject) => {
                    const req = indexedDB.open('ZipStorage', 1);
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = () => reject(req.error);
                });

                const store = db.transaction('zips', 'readonly').objectStore('zips');
                const data = await new Promise((resolve, reject) => {
                    const req = store.get('current');
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = () => reject(req.error);
                });

                if (data) {
                    currentZipBlob = data.blob;
                    currentZipName = data.name;
                    return true;
                }
            } catch (e) {
                console.warn('Error cargando desde IndexedDB:', e.message);
            }
        }

        const dataUrl = localStorage.getItem(STORAGE_KEYS.ZIP_BLOB);
        if (dataUrl) {
            const response = await fetch(dataUrl);
            currentZipBlob = await response.blob();
            currentZipName = localStorage.getItem(STORAGE_KEYS.ZIP_NAME) || 'archivo.zip';
            return true;
        }

        return false;
    } catch (e) {
        console.warn('Error restaurando ZIP:', e.message);
        return false;
    }
}

function clearZipStorage() {
    localStorage.removeItem(STORAGE_KEYS.ZIP_BLOB);
    localStorage.removeItem(STORAGE_KEYS.ZIP_URL);
    localStorage.removeItem(STORAGE_KEYS.ZIP_NAME);
    localStorage.removeItem('zip_in_idb');

    if ('indexedDB' in window) {
        try {
            indexedDB.deleteDatabase('ZipStorage');
        } catch (e) {
            console.warn('Error borrando IndexedDB:', e.message);
        }
    }
}

function ensureZipLoaded() {
    return new Promise((resolve) => {
        if (typeof JSZip !== 'undefined') {
            resolve();
        } else {
            const checkInterval = setInterval(() => {
                if (typeof JSZip !== 'undefined') {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
            setTimeout(() => {
                clearInterval(checkInterval);
                resolve();
            }, 5000);
        }
    });
}

function showError(message) {
    const errorEl = document.getElementById('error');
    errorEl.textContent = message;
    errorEl.style.display = 'block';
    setTimeout(() => {
        errorEl.style.display = 'none';
    }, 5000);
}

function showSuccess(message) {
    const successEl = document.getElementById('success');
    successEl.textContent = message;
    successEl.style.display = 'block';
    setTimeout(() => {
        successEl.style.display = 'none';
    }, 3000);
}

function setLoading(isLoading) {
    const loadingEl = document.getElementById('loading');
    if (loadingEl) {
        loadingEl.style.display = isLoading ? 'block' : 'none';
    }
}

let currentZip = null;
let currentFiles = [];
let currentZipName = '';
let activeFileButton = null;
let allDirectoryButtons = [];
let currentZipBlob = null;

function initFromQueryString() {
    const urlParams = new URLSearchParams(window.location.search);
    const zipUrl = urlParams.get('url');
    if (zipUrl) {
        document.getElementById('urlInput').value = decodeURIComponent(zipUrl);
        setTimeout(loadZipFromUrl, 100);
    } else {
        loadZipFromStorageOnInit();
    }
}

async function loadZipFromStorageOnInit() {
    try {
        const loaded = await loadZipFromStorage();
        if (loaded && currentZipBlob) {
            setLoading(true);
            await ensureZipLoaded();
            
            if (typeof JSZip === 'undefined') {
                throw new Error('JSZip no se cargo');
            }

            const arrayBuffer = await currentZipBlob.arrayBuffer();
            const zip = new JSZip();
            const loadedZip = await zip.loadAsync(arrayBuffer);

            currentFiles = [];
            const entries = Object.keys(loadedZip.files);

            for (const path of entries) {
                const file = loadedZip.files[path];

                if (file.dir) {
                    currentFiles.push({
                        path: path,
                        size: 0,
                        data: null,
                        isDir: true
                    });
                } else {
                    const data = await file.async('uint8array');
                    currentFiles.push({
                        path: path,
                        size: file.uncompressedSize || data.length,
                        data: data,
                        isDir: false
                    });
                }
            }

            processZip(currentFiles);
            console.log('ZIP restaurado desde storage');
        }
    } catch (error) {
        console.error('Error restaurando ZIP:', error);
    } finally {
        setLoading(false);
    }
}

function showResults() {
    document.getElementById('welcomeScreen').classList.add('hidden');
    document.getElementById('results').classList.remove('hidden');
    document.getElementById('header').classList.remove('hidden');
    document.getElementById('statusBar').classList.remove('hidden');
}

function hideResults() {
    document.getElementById('welcomeScreen').classList.remove('hidden');
    document.getElementById('results').classList.add('hidden');
    document.getElementById('header').classList.add('hidden');
    document.getElementById('statusBar').classList.add('hidden');
}

function loadZipFromWelcome() {
    const urlInput = document.getElementById('welcomeUrlInput');
    urlInput.value = urlInput.value.trim();
    if (urlInput.value) {
        document.getElementById('urlInput').value = urlInput.value;
        loadZipFromUrl();
    }
}

function setupUrlInputAutoLoad() {
    const urlInput = document.getElementById('welcomeUrlInput');

    urlInput.addEventListener('input', function () {
        clearTimeout(urlInputDebounceTimer);
        urlInputDebounceTimer = setTimeout(() => {
            loadZipFromWelcome();
        }, 500);
    });

    urlInput.addEventListener('blur', function () {
        clearTimeout(urlInputDebounceTimer);
        if (this.value.trim()) {
            loadZipFromWelcome();
        }
    });

    urlInput.addEventListener('paste', function () {
        clearTimeout(urlInputDebounceTimer);
        setTimeout(() => {
            if (this.value.trim()) {
                loadZipFromWelcome();
            }
        }, 10);
    });
}

function setupWelcomeDropZone() {
    const welcomeDropZone = document.getElementById('welcomeDropZone');
    if (!welcomeDropZone) return;

    welcomeDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        welcomeDropZone.classList.add('border-zinc-400', 'dark:border-zinc-600', 'bg-zinc-100', 'dark:bg-zinc-800');
    });

    welcomeDropZone.addEventListener('dragleave', () => {
        welcomeDropZone.classList.remove('border-zinc-400', 'dark:border-zinc-600', 'bg-zinc-100', 'dark:bg-zinc-800');
    });

    welcomeDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        welcomeDropZone.classList.remove('border-zinc-400', 'dark:border-zinc-600', 'bg-zinc-100', 'dark:bg-zinc-800');

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const fileInput = document.getElementById('welcomeFileInput');
            fileInput.files = files;
            const event = new Event('change', { bubbles: true });
            fileInput.dispatchEvent(event);
        }
    });
}

document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('welcomeFileInput').addEventListener('change', loadZipFromFile);
    document.getElementById('fileInput').addEventListener('change', loadZipFromFile);
    setupUrlInputAutoLoad();
    setupWelcomeDropZone();
    initFromQueryString();
});

function processZip(files) {
    allDirectoryButtons = [];

    showResults();

    const resultsSection = document.getElementById('results');
    const fileTree = document.getElementById('fileTree');
    const emptyState = document.getElementById('emptyState');
    const filePreview = document.getElementById('filePreview');

    const fileCount = files.filter(f => !f.isDir).length;
    const dirCount = files.filter(f => f.isDir).length;
    const totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0);
    const compressedSize = currentZipBlob ? currentZipBlob.size : 0;
    const ratio = totalSize > 0 ? ((compressedSize / totalSize - 1) * 100).toFixed(1) : 0;

    document.getElementById('fileName').textContent = currentZipName;
    document.getElementById('statusFileCount').textContent = fileCount;
    document.getElementById('statusDirCount').textContent = dirCount;
    document.getElementById('statusSize').textContent = formatBytes(totalSize);
    document.getElementById('statusCompressed').textContent = formatBytes(compressedSize);
    document.getElementById('statusRatio').textContent = ratio != 0 ? '(' + ratio + '%)' : '';

    const statusCompressedMobile = document.getElementById('statusCompressedMobile');
    const statusRatioMobile = document.getElementById('statusRatioMobile');
    if (statusCompressedMobile) statusCompressedMobile.textContent = formatBytes(compressedSize);
    if (statusRatioMobile) statusRatioMobile.textContent = ratio != 0 ? '(' + ratio + '%)' : '';

    const expandBtn = document.getElementById('expandBtn');
    const collapseBtn = document.getElementById('collapseBtn');
    if (dirCount === 0) {
        expandBtn.classList.add('opacity-50', 'cursor-not-allowed');
        collapseBtn.classList.add('opacity-50', 'cursor-not-allowed');
        expandBtn.onclick = null;
        collapseBtn.onclick = null;
    } else {
        expandBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        collapseBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        expandBtn.onclick = expandAllDirectories;
        collapseBtn.onclick = collapseAllDirectories;
    }

    fileTree.innerHTML = '';

    const tree = {};
    files.forEach(file => {
        const parts = file.path.split('/').filter(p => p);
        let current = tree;

        parts.forEach((part, index) => {
            if (!current[part]) {
                current[part] = { children: {}, file: null, isDir: true };
            }
            if (index === parts.length - 1 && !file.isDir) {
                current[part] = { ...current[part], file: file, isDir: false };
            }
            current = current[part].children;
        });
    });

    function renderTree(node, level = 0, container = null) {
        const targetContainer = container || fileTree;
        const items = Object.entries(node).sort((a, b) => {
            const aIsDir = a[1].isDir;
            const bIsDir = b[1].isDir;
            if (aIsDir !== bIsDir) return bIsDir - aIsDir;
            return a[0].localeCompare(b[0]);
        });

        items.forEach(([name, item]) => {
            const div = document.createElement('div');

            const icon = item.isDir ? '📁' : '📄';
            const btn = document.createElement('button');
            btn.className = 'w-full text-left px-2 py-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 text-sm truncate text-zinc-800 dark:text-zinc-100 flex items-center gap-2 transition-colors';
            btn.style.paddingLeft = (level * 16 + 8) + 'px';

            if (item.file && !item.isDir) {
                btn.innerHTML = '<span class="flex-shrink-0">' + icon + '</span><span class="flex-1 truncate">' + name + '</span>';
                btn.onclick = () => previewFile(item.file, btn);
                btn.className += ' hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer';
                btn.dataset.filePath = item.file.path;
                div.appendChild(btn);
            } else if (item.isDir) {
                const hasChildren = Object.keys(item.children).length > 0;
                const arrow = hasChildren ? '▼' : '';
                btn.innerHTML = '<span class="flex-shrink-0 w-4">' + arrow + '</span><span class="flex-shrink-0">' + icon + '</span><span class="flex-1 truncate">' + name + '</span>';
                btn.className += ' cursor-pointer';
                btn.dataset.expanded = 'true';
                btn.dataset.filePath = name;
                div.appendChild(btn);

                if (hasChildren) {
                    allDirectoryButtons.push(btn);

                    const childrenDiv = document.createElement('div');
                    childrenDiv.className = 'directory-contents';
                    childrenDiv.dataset.expanded = 'true';

                    btn.onclick = () => {
                        const isExpanded = childrenDiv.dataset.expanded === 'true';
                        childrenDiv.dataset.expanded = isExpanded ? 'false' : 'true';
                        childrenDiv.style.display = isExpanded ? 'none' : 'block';
                        const arrowSpan = btn.querySelector(':first-child');
                        arrowSpan.textContent = isExpanded ? '▶' : '▼';
                    };

                    div.appendChild(childrenDiv);
                    renderTree(item.children, level + 1, childrenDiv);
                }
            }

            targetContainer.appendChild(div);
        });
    }

    renderTree(tree);
    emptyState.classList.add('hidden');
    filePreview.classList.add('hidden');
    resultsSection.classList.remove('hidden');
}

function previewFile(file, buttonElement) {
    const preview = document.getElementById('filePreview');
    const previewTitle = document.getElementById('previewTitle');
    const previewContent = document.getElementById('previewContent');
    const isText = isTextFile(file.path);
    const isImage = isImageFile(file.path);

    let content = '';

    if (isImage && file.data) {
        const blob = new Blob([file.data], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        previewContent.innerHTML = '<img src="' + url + '" alt="' + file.path + '" class="max-w-full max-h-full object-contain" />';
        previewContent.style.display = 'flex';
        previewContent.style.alignItems = 'center';
        previewContent.style.justifyContent = 'center';
    } else if (isText && file.data) {
        previewContent.style.display = 'block';
        try {
            const text = new TextDecoder().decode(file.data);
            content = text.length > 50000 ? text.substring(0, 50000) + '\n\n[...truncado...]' : text;
        } catch (e) {
            content = '[No se puede decodificar como texto]';
        }
        previewContent.textContent = content;
    } else {
        previewContent.style.display = 'flex';
        previewContent.style.alignItems = 'center';
        previewContent.style.justifyContent = 'center';
        previewContent.textContent = '[Archivo binario]';
    }

    previewTitle.textContent = file.path;
    preview.classList.remove('hidden');
    preview.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    window.currentPreviewFile = file;

    if (activeFileButton) {
        activeFileButton.classList.remove('bg-blue-100', 'dark:bg-blue-900', 'text-blue-700', 'dark:text-blue-300');
    }

    if (buttonElement) {
        buttonElement.classList.add('bg-blue-100', 'dark:bg-blue-900', 'text-blue-700', 'dark:text-blue-300');
        activeFileButton = buttonElement;
    }
}

async function loadZipFromUrl() {
    if (isLoadingZip) {
        return;
    }

    const urlInput = document.getElementById('urlInput').value.trim();

    if (!urlInput) {
        showError('Por favor, ingresa una URL valida');
        return;
    }

    try {
        const url = new URL(urlInput);
        currentZipName = url.pathname.split('/').pop() || 'archivo.zip';
    } catch {
        currentZipName = 'archivo.zip';
    }

    currentFiles = [];
    isLoadingZip = true;
    setLoading(true);
    console.log('Cargando desde URL:', urlInput);

    try {
        await ensureZipLoaded();
        if (typeof JSZip === 'undefined') {
            throw new Error('JSZip no se cargo. Recarga la pagina.');
        }

        const proxyUrl = '/api/proxy?url=' + encodeURIComponent(urlInput);
        console.log('Usando proxy:', proxyUrl);

        const response = await fetch(proxyUrl);

        if (!response.ok) {
            throw new Error('HTTP ' + response.status + ': ' + response.statusText);
        }

        console.log('Respuesta OK');
        const arrayBuffer = await response.arrayBuffer();
        console.log('Datos recibidos:', formatBytes(arrayBuffer.byteLength));
        currentZipBlob = new Blob([arrayBuffer], { type: 'application/zip' });

        console.log('Procesando ZIP...');
        const zip = new JSZip();
        const loaded = await zip.loadAsync(arrayBuffer);

        const entries = Object.keys(loaded.files);
        console.log('Total entradas en ZIP:', entries.length);
        console.log('Entradas:', entries);

        for (const path of entries) {
            const file = loaded.files[path];

            if (file.dir) {
                currentFiles.push({
                    path: path,
                    size: 0,
                    data: null,
                    isDir: true
                });
            } else {
                const data = await file.async('uint8array');
                currentFiles.push({
                    path: path,
                    size: file.uncompressedSize || data.length,
                    data: data,
                    isDir: false
                });
            }
        }

        const fileCount = currentFiles.filter(f => !f.isDir).length;
        const dirCount = currentFiles.filter(f => f.isDir).length;
        console.log('ZIP procesado:', currentFiles.length, 'elementos (', fileCount, 'archivos,', dirCount, 'dirs )');
        
        await saveZipToStorage(currentZipBlob, currentZipName, urlInput);
        
        processZip(currentFiles);

    } catch (error) {
        console.error('Error:', error);
        showError('Error: ' + error.message);
    } finally {
        setLoading(false);
        isLoadingZip = false;
    }
}

function loadZipFromFile(event) {
    if (isLoadingZip) {
        return;
    }

    const file = event.target.files[0];

    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.zip')) {
        showError('Por favor, selecciona un archivo ZIP valido');
        event.target.value = '';
        return;
    }

    currentZipName = file.name;
    currentZipBlob = file;
    currentFiles = [];
    isLoadingZip = true;

    window.history.replaceState({}, document.title, window.location.pathname);
    document.getElementById('urlInput').value = '';

    setLoading(true);
    console.log('Cargando archivo local:', file.name);

    const reader = new FileReader();

    reader.onload = async function (event) {
        try {
            await ensureZipLoaded();
            if (typeof JSZip === 'undefined') {
                throw new Error('JSZip no se cargo');
            }

            const arrayBuffer = event.target.result;
            const zip = new JSZip();
            const loaded = await zip.loadAsync(arrayBuffer);

            currentFiles = [];
            const entries = Object.keys(loaded.files);
            console.log('Total entradas en ZIP:', entries.length);
            console.log('Entradas:', entries);

            for (const path of entries) {
                const fileEntry = loaded.files[path];

                if (fileEntry.dir) {
                    currentFiles.push({
                        path: path,
                        size: 0,
                        data: null,
                        isDir: true
                    });
                } else {
                    const data = await fileEntry.async('uint8array');
                    currentFiles.push({
                        path: path,
                        size: fileEntry.uncompressedSize || data.length,
                        data: data,
                        isDir: false
                    });
                }
            }

            const fileCount = currentFiles.filter(f => !f.isDir).length;
            const dirCount = currentFiles.filter(f => f.isDir).length;
            console.log('ZIP procesado:', currentFiles.length, 'elementos (', fileCount, 'archivos,', dirCount, 'dirs )');
            
            await saveZipToStorage(currentZipBlob, currentZipName);
            
            processZip(currentFiles);

        } catch (error) {
            console.error('Error:', error);
            showError('Error: ' + error.message);
        } finally {
            setLoading(false);
            isLoadingZip = false;
        }
    };

    reader.readAsArrayBuffer(file);
}



document.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
});

document.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        const zipFile = Array.from(files).find(f => f.name.toLowerCase().endsWith('.zip'));
        if (zipFile) {
            const fileInput = document.getElementById('fileInput');
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(zipFile);
            fileInput.files = dataTransfer.files;

            const event = new Event('change', { bubbles: true });
            fileInput.dispatchEvent(event);
        }
    }
});

function downloadCurrentFile() {
    if (!window.currentPreviewFile) {
        showError('No hay archivo seleccionado');
        return;
    }
    downloadFile(window.currentPreviewFile);
}

function copyToClipboard() {
    if (!window.currentPreviewFile) {
        showError('No hay archivo seleccionado');
        return;
    }

    const file = window.currentPreviewFile;

    if (!isTextFile(file.path)) {
        showError('Solo se pueden copiar archivos de texto');
        return;
    }

    if (!file.data) {
        showError('No hay datos del archivo');
        return;
    }

    try {
        const text = new TextDecoder().decode(file.data);
        navigator.clipboard.writeText(text).then(() => {
            showSuccess('Contenido copiado al portapapeles');
        }).catch(() => {
            showError('No se pudo copiar al portapapeles');
        });
    } catch (error) {
        showError('Error al copiar: ' + error.message);
    }
}

function downloadFile(file) {
    console.log('Descargando: ' + file.path);

    if (!file.data) {
        showError('No hay datos del archivo para descargar');
        return;
    }

    const blob = new Blob([file.data], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.path.split('/').pop();
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showSuccess('Archivo descargado: ' + link.download);
}

function expandAllDirectories() {
    allDirectoryButtons.forEach(btn => {
        const childrenDiv = btn.nextElementSibling;
        if (childrenDiv && childrenDiv.classList.contains('directory-contents')) {
            childrenDiv.style.display = 'block';
            childrenDiv.dataset.expanded = 'true';
            const arrowSpan = btn.querySelector(':first-child');
            if (arrowSpan) {
                arrowSpan.textContent = '▼';
            }
        }
    });
}

function filterFileTree(searchTerm) {
    const fileTree = document.getElementById('fileTree');
    const allButtons = fileTree.querySelectorAll('button[data-file-path]');
    const searchLower = searchTerm.toLowerCase();

    if (!searchTerm) {
        allButtons.forEach(btn => {
            btn.parentElement.style.display = '';
            btn.classList.remove('opacity-50');
        });

        fileTree.querySelectorAll('.directory-contents').forEach(dir => {
            if (dir.dataset.expanded === 'true') {
                dir.style.display = 'block';
            } else {
                dir.style.display = 'none';
            }
        });

        const message = fileTree.querySelector('.search-no-results');
        if (message) message.remove();
        return;
    }

    const matchedButtons = [];
    allButtons.forEach(btn => {
        const fileName = btn.dataset.filePath.split('/').pop().toLowerCase();
        if (fileName.includes(searchLower)) {
            matchedButtons.push(btn);
        }
    });

    if (matchedButtons.length === 0) {
        allButtons.forEach(btn => btn.parentElement.style.display = 'none');
        fileTree.querySelectorAll('.directory-contents').forEach(dir => dir.style.display = 'none');

        const existingMessage = fileTree.querySelector('.search-no-results');
        if (!existingMessage) {
            const message = document.createElement('div');
            message.className = 'search-no-results p-2 text-xs text-zinc-500 dark:text-zinc-400';
            message.textContent = 'No se encontraron resultados';
            fileTree.appendChild(message);
        }
        return;
    }

    allButtons.forEach(btn => {
        btn.parentElement.style.display = 'none';
        btn.classList.remove('opacity-50');
    });
    fileTree.querySelectorAll('.directory-contents').forEach(dir => dir.style.display = 'none');

    matchedButtons.forEach(matchedBtn => {
        let current = matchedBtn.parentElement;

        while (current && current !== fileTree) {
            current.style.display = '';

            if (current.classList.contains('directory-contents')) {
                current.style.display = 'block';
            }

            const sibling = current.querySelector('button[data-file-path]');
            if (sibling && sibling !== matchedBtn) {
                sibling.classList.add('opacity-50');
            }

            current = current.parentElement;
        }

        matchedBtn.classList.remove('opacity-50');
    });

    const message = fileTree.querySelector('.search-no-results');
    if (message) message.remove();
}

function clearZipAndReload() {
    clearZipStorage();
    currentZip = null;
    currentFiles = [];
    currentZipName = '';
    currentZipBlob = null;
    activeFileButton = null;
    allDirectoryButtons = [];
    
    document.getElementById('urlInput').value = '';
    document.getElementById('searchInput').value = '';
    
    hideResults();
    window.location.href = window.location.pathname;
}

function collapseAllDirectories() {
    allDirectoryButtons.forEach(btn => {
        const childrenDiv = btn.nextElementSibling;
        if (childrenDiv && childrenDiv.classList.contains('directory-contents')) {
            childrenDiv.style.display = 'none';
            childrenDiv.dataset.expanded = 'false';
            const arrowSpan = btn.querySelector(':first-child');
            if (arrowSpan) {
                arrowSpan.textContent = '▶';
            }
        }
    });
}

function downloadZipFile() {
    if (!currentZipBlob) {
        showError('No hay archivo ZIP cargado');
        return;
    }

    const url = URL.createObjectURL(currentZipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = currentZipName || 'archivo.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showSuccess('ZIP descargado: ' + (currentZipName || 'archivo.zip'));
}

export function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export function isTextFile(fileName) {
    const textExtensions = [
        'txt', 'md', 'markdown', 'json', 'xml', 'csv', 'html', 'htm', 'css',
        'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'h', 'php',
        'rb', 'go', 'rs', 'sh', 'bash', 'yml', 'yaml', 'sql', 'r', 'log',
        'env', 'properties', 'gradle', 'maven', 'dockerfile', 'gitignore',
        'editorconfig', 'eslintrc', 'prettierrc', 'babelrc'
    ];
    const ext = fileName.split('.').pop().toLowerCase();
    return textExtensions.includes(ext);
}

export function isImageFile(fileName) {
    const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'];
    const ext = fileName.split('.').pop().toLowerCase();
    return imageExtensions.includes(ext);
}

export function validateZipFile(file) {
    if (!file) return false;
    const name = file.name || file.toLowerCase();
    return name.toLowerCase().endsWith('.zip');
}

export function createZipFileEntry(path, size = 0, isDir = false) {
    return {
        path: path,
        size: size,
        data: isDir ? null : new Uint8Array(size),
        isDir: isDir
    };
}

export function processZipEntries(entries) {
    const files = [];
    const dirs = [];
    
    entries.forEach(entry => {
        if (entry.isDir) {
            dirs.push(entry);
        } else {
            files.push(entry);
        }
    });
    
    return { files, dirs, total: entries.length };
}

export function buildFileTree(entries) {
    const tree = {};
    
    entries.forEach(entry => {
        const parts = entry.path.split('/').filter(p => p);
        let current = tree;
        
        parts.forEach((part, index) => {
            if (!current[part]) {
                current[part] = { children: {}, file: null, isDir: true };
            }
            if (index === parts.length - 1 && !entry.isDir) {
                current[part] = { ...current[part], file: entry, isDir: false };
            }
            current = current[part].children;
        });
    });
    
    return tree;
}

export function calculateCompressionRatio(uncompressed, compressed) {
    if (uncompressed === 0) return 0;
    return ((compressed / uncompressed - 1) * 100).toFixed(1);
}

// Exponer funciones globalmente para ser llamadas desde HTML
window.clearZipAndReload = clearZipAndReload;
window.loadZipFromUrl = loadZipFromUrl;
window.loadZipFromFile = loadZipFromFile;
window.previewFile = previewFile;
window.filterFileTree = filterFileTree;
window.expandAllDirectories = expandAllDirectories;
window.collapseAllDirectories = collapseAllDirectories;
window.downloadCurrentFile = downloadCurrentFile;
window.downloadZipFile = downloadZipFile;
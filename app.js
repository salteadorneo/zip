// Esperar a que JSZip cargue
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

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
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

function initFromQueryString() {
    const urlParams = new URLSearchParams(window.location.search);
    const zipUrl = urlParams.get('url');
    if (zipUrl) {
        document.getElementById('urlInput').value = decodeURIComponent(zipUrl);
        setTimeout(loadZipFromUrl, 100);
    }
}

function processZip(files) {
    // Limpiar array de directorios previos
    allDirectoryButtons = [];
    
    const resultsSection = document.getElementById('results');
    const fileTree = document.getElementById('fileTree');
    const emptyState = document.getElementById('emptyState');
    const filePreview = document.getElementById('filePreview');

    const fileCount = files.filter(f => !f.isDir).length;
    const dirCount = files.filter(f => f.isDir).length;
    const totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0);

    document.getElementById('fileName').textContent = currentZipName;
    document.getElementById('fileCount').textContent = fileCount;
    document.getElementById('dirCount').textContent = dirCount;
    document.getElementById('totalSize').textContent = formatBytes(totalSize);

    fileTree.innerHTML = '';
    
    // Construir árbol de directorios
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

    // Renderizar árbol
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
                // Es un archivo
                btn.innerHTML = '<span class="flex-shrink-0">' + icon + '</span><span class="flex-1 truncate">' + name + '</span>';
                btn.onclick = () => previewFile(item.file, btn);
                btn.className += ' hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer';
                btn.dataset.filePath = item.file.path;
                div.appendChild(btn);
            } else if (item.isDir) {
                // Es un directorio
                const hasChildren = Object.keys(item.children).length > 0;
                const arrow = hasChildren ? '▼' : '';
                btn.innerHTML = '<span class="flex-shrink-0 w-4">' + arrow + '</span><span class="flex-shrink-0">' + icon + '</span><span class="flex-1 truncate">' + name + '</span>';
                btn.className += ' cursor-pointer';
                btn.dataset.expanded = 'true';
                
                div.appendChild(btn);
                
                if (hasChildren) {
                    // Registrar botón en array global
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
        // Mostrar imagen
        const blob = new Blob([file.data], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        previewContent.innerHTML = '<img src="' + url + '" alt="' + file.path + '" class="max-w-full max-h-full object-contain" />';
        previewContent.style.display = 'flex';
        previewContent.style.alignItems = 'center';
        previewContent.style.justifyContent = 'center';
    } else if (isText && file.data) {
        // Mostrar texto
        previewContent.style.display = 'block';
        try {
            const text = new TextDecoder().decode(file.data);
            content = text.length > 50000 ? text.substring(0, 50000) + '\n\n[...truncado...]' : text;
        } catch (e) {
            content = '[No se puede decodificar como texto]';
        }
        previewContent.textContent = content;
    } else {
        // Archivo binario
        previewContent.style.display = 'flex';
        previewContent.style.alignItems = 'center';
        previewContent.style.justifyContent = 'center';
        previewContent.textContent = '[Archivo binario]';
    }

    previewTitle.textContent = file.path;
    preview.classList.remove('hidden');
    preview.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    
    // Guardar referencia del archivo actual para descarga
    window.currentPreviewFile = file;
    
    // Remover clase activa del botón anterior
    if (activeFileButton) {
        activeFileButton.classList.remove('bg-blue-100', 'dark:bg-blue-900', 'text-blue-700', 'dark:text-blue-300');
    }
    
    // Agregar clase activa al botón actual
    if (buttonElement) {
        buttonElement.classList.add('bg-blue-100', 'dark:bg-blue-900', 'text-blue-700', 'dark:text-blue-300');
        activeFileButton = buttonElement;
    }
}

function isTextFile(fileName) {
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

function isImageFile(fileName) {
    const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'];
    const ext = fileName.split('.').pop().toLowerCase();
    return imageExtensions.includes(ext);
}

async function loadZipFromUrl() {
    const urlInput = document.getElementById('urlInput').value.trim();

    if (!urlInput) {
        showError('Por favor, ingresa una URL valida');
        return;
    }

    // Extraer nombre del archivo de la URL
    try {
        const url = new URL(urlInput);
        currentZipName = url.pathname.split('/').pop() || 'archivo.zip';
    } catch {
        currentZipName = 'archivo.zip';
    }

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

        console.log('Procesando ZIP...');
        const zip = new JSZip();
        const loaded = await zip.loadAsync(arrayBuffer);

        currentFiles = [];
        const entries = Object.keys(loaded.files);

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

        console.log('ZIP procesado:', currentFiles.length, 'elementos');
        processZip(currentFiles);
        showSuccess('ZIP cargado correctamente');

    } catch (error) {
        console.error('Error:', error);
        showError('Error: ' + error.message);
    } finally {
        setLoading(false);
    }
}

async function loadZipFromFile(event) {
    const file = event.target.files[0];

    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.zip')) {
        showError('Por favor, selecciona un archivo ZIP valido');
        event.target.value = '';
        return;
    }

    // Guardar nombre del archivo y limpiar URL
    currentZipName = file.name;
    window.history.replaceState({}, document.title, window.location.pathname);
    document.getElementById('urlInput').value = '';

    setLoading(true);
    console.log('Cargando archivo local:', file.name);

    try {
        await ensureZipLoaded();
        if (typeof JSZip === 'undefined') {
            throw new Error('JSZip no se cargo');
        }

        const zip = new JSZip();
        const loaded = await zip.loadAsync(file);

        currentFiles = [];
        const entries = Object.keys(loaded.files);

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

        console.log('ZIP procesado:', currentFiles.length, 'elementos');
        processZip(currentFiles);
        showSuccess('Archivo cargado correctamente');

    } catch (error) {
        console.error('Error:', error);
        showError('Error: ' + error.message);
    } finally {
        setLoading(false);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initFromQueryString();

    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.addEventListener('change', loadZipFromFile);
    }

    const dropZone = document.getElementById('dropZone');
    if (dropZone) {
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                fileInput.files = files;
                const event = new Event('change', { bubbles: true });
                fileInput.dispatchEvent(event);
            }
        });
    }
});

window.addEventListener('load', () => {
    console.log('ZIP Preview v2.0.0 cargado');
});

// Descargar archivo individual del ZIP
function downloadCurrentFile() {
    if (!window.currentPreviewFile) {
        showError('No hay archivo seleccionado');
        return;
    }
    downloadFile(window.currentPreviewFile);
}

function downloadFile(file) {
    console.log('Descargando: ' + file.path);
    
    if (!file.data) {
        showError('No hay datos del archivo para descargar');
        return;
    }

    // Crear descarga directa del contenido ya cargado
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

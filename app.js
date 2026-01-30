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

function initFromQueryString() {
    const urlParams = new URLSearchParams(window.location.search);
    const zipUrl = urlParams.get('url');
    if (zipUrl) {
        document.getElementById('urlInput').value = decodeURIComponent(zipUrl);
        setTimeout(loadZipFromUrl, 100);
    }
}

function processZip(files) {
    const resultsSection = document.getElementById('results');
    const fileList = document.getElementById('fileList');
    const filePreview = document.getElementById('filePreview');

    const fileCount = files.filter(f => !f.isDir).length;
    const dirCount = files.filter(f => f.isDir).length;
    const totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0);

    document.getElementById('fileCount').textContent = fileCount;
    document.getElementById('dirCount').textContent = dirCount;
    document.getElementById('totalSize').textContent = formatBytes(totalSize);

    fileList.innerHTML = '';
    filePreview.innerHTML = '';
    filePreview.classList.add('hidden');

    files.forEach((file) => {
        const item = document.createElement('div');
        item.className = 'file-item';
        
        const icon = file.isDir ? 'Ì≥Å' : 'Ì≥Ñ';
        const name = file.path.split('/').pop() || file.path;
        const size = file.isDir ? '' : '<div class="file-size">' + formatBytes(file.size) + '</div>';

        item.innerHTML = '<div class="file-info"><div class="file-name">' + icon + ' ' + name + '</div>' + size + '</div>';

        if (!file.isDir) {
            item.onclick = () => previewFile(file);
        } else {
            item.style.opacity = '0.7';
        }

        fileList.appendChild(item);
    });

    resultsSection.classList.remove('hidden');
}

function previewFile(file) {
    const preview = document.getElementById('filePreview');
    const isText = isTextFile(file.path);

    let content = '';
    if (isText && file.data) {
        try {
            const text = new TextDecoder().decode(file.data);
            content = text.length > 50000 ? text.substring(0, 50000) + '\n\n[...truncado...]' : text;
        } catch (e) {
            content = '[No se puede decodificar como texto]';
        }
    } else {
        content = '[Archivo binario - no se puede previsualiziar]';
    }

    preview.innerHTML = '<div class="file-preview-header">' + file.path + '</div><div class="file-preview-content">' + escapeHtml(content) + '</div>';
    preview.classList.remove('hidden');
    preview.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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

async function loadZipFromUrl() {
    const urlInput = document.getElementById('urlInput').value.trim();

    if (!urlInput) {
        showError('Por favor, ingresa una URL valida');
        return;
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

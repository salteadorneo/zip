// Utilidades
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

// Variables globales
let currentZip = null;
let currentFiles = [];

// Auto-cargar ZIP desde par√°metro URL
function initFromQueryString() {
    const urlParams = new URLSearchParams(window.location.search);
    const zipUrl = urlParams.get('url');
    if (zipUrl) {
        document.getElementById('urlInput').value = decodeURIComponent(zipUrl);
        setTimeout(loadZipFromUrl, 100);
    }
}

// Procesar y mostrar ZIP
function processZip(files) {
    const resultsSection = document.getElementById('results');
    const fileList = document.getElementById('fileList');
    const filePreview = document.getElementById('filePreview');

    // Contar archivos y directorios
    const fileCount = files.filter(f => !f.isDir).length;
    const dirCount = files.filter(f => f.isDir).length;
    const totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0);

    document.getElementById('fileCount').textContent = fileCount;
    document.getElementById('dirCount').textContent = dirCount;
    document.getElementById('totalSize').textContent = formatBytes(totalSize);

    // Limpiar lista anterior
    fileList.innerHTML = '';
    filePreview.innerHTML = '';
    filePreview.classList.add('hidden');

    // Mostrar archivos
    files.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = 'file-item';
        
        const icon = file.isDir ? 'Ì≥Å' : 'Ì≥Ñ';
        const name = file.path.split('/').pop() || file.path;
        const size = file.isDir ? '' : `<div class="file-size">${formatBytes(file.size)}</div>`;

        item.innerHTML = `
            <div class="file-info">
                <div class="file-name">${icon} ${name}</div>
                ${size}
            </div>
        `;

        // Click para preview
        if (!file.isDir) {
            item.onclick = () => previewFile(file);
        } else {
            item.style.opacity = '0.7';
        }

        fileList.appendChild(item);
    });

    resultsSection.classList.remove('hidden');
}

// Preview de archivo
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

    preview.innerHTML = `
        <div class="file-preview-header">Ì≥Ñ ${file.path}</div>
        <div class="file-preview-content">${escapeHtml(content)}</div>
    `;
    preview.classList.remove('hidden');

    // Scroll al preview
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

// Cargar ZIP desde URL
async function loadZipFromUrl() {
    const urlInput = document.getElementById('urlInput').value.trim();

    if (!urlInput) {
        showError('Por favor, ingresa una URL v√°lida');
        return;
    }

    setLoading(true);
    console.log('Ì≥• Cargando desde URL:', urlInput);

    try {
        // Usar el proxy del servidor
        const proxyUrl = `/api/proxy?url=${encodeURIComponent(urlInput)}`;
        console.log('Ì¥ó Proxy URL:', proxyUrl);

        const response = await fetch(proxyUrl);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        console.log('‚úì Respuesta recibida');
        const arrayBuffer = await response.arrayBuffer();
        console.log('‚úì ArrayBuffer:', formatBytes(arrayBuffer.byteLength));

        // Procesar con zip.js
        console.log('2Ô∏è‚É£ Procesando ZIP...');
        const blobReader = new zip.BlobReader(new Blob([arrayBuffer]));
        const zipReader = new zip.ZipReader(blobReader);
        const entries = await zipReader.getEntries();

        currentFiles = [];

        for (const entry of entries) {
            if (!entry.directory) {
                const data = await entry.getData(new zip.ArrayBufferWriter());
                currentFiles.push({
                    path: entry.filename,
                    size: entry.uncompressed,
                    data: new Uint8Array(data),
                    isDir: false
                });
            } else {
                currentFiles.push({
                    path: entry.filename,
                    size: 0,
                    data: null,
                    isDir: true
                });
            }
        }

        await zipReader.close();
        
        console.log('‚úì ZIP procesado:', currentFiles.length, 'elementos');
        processZip(currentFiles);
        showSuccess('‚úì ZIP cargado correctamente');

    } catch (error) {
        console.error('‚ùå Error:', error);
        showError(`Error: ${error.message}`);
    } finally {
        setLoading(false);
    }
}

// Cargar ZIP desde archivo local
async function loadZipFromFile(event) {
    const file = event.target.files[0];

    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.zip')) {
        showError('Por favor, selecciona un archivo ZIP v√°lido');
        event.target.value = '';
        return;
    }

    setLoading(true);
    console.log('Ì≥Å Cargando archivo local:', file.name);

    try {
        const blobReader = new zip.BlobReader(file);
        const zipReader = new zip.ZipReader(blobReader);
        const entries = await zipReader.getEntries();

        currentFiles = [];

        for (const entry of entries) {
            if (!entry.directory) {
                const data = await entry.getData(new zip.ArrayBufferWriter());
                currentFiles.push({
                    path: entry.filename,
                    size: entry.uncompressed,
                    data: new Uint8Array(data),
                    isDir: false
                });
            } else {
                currentFiles.push({
                    path: entry.filename,
                    size: 0,
                    data: null,
                    isDir: true
                });
            }
        }

        await zipReader.close();
        
        console.log('‚úì ZIP procesado:', currentFiles.length, 'elementos');
        processZip(currentFiles);
        showSuccess('‚úì Archivo cargado correctamente');

    } catch (error) {
        console.error('‚ùå Error:', error);
        showError(`Error: ${error.message}`);
    } finally {
        setLoading(false);
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Cargar desde query string si existe
    initFromQueryString();

    // File input
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.addEventListener('change', loadZipFromFile);
    }

    // Drag & drop
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
    console.log('‚úì ZIP Preview v2.0.0 cargado');
});

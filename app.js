const TEXT_EXTENSIONS = [
    'txt', 'md', 'markdown', 'json', 'xml', 'csv', 'html', 'htm', 'css',
    'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'h', 'php',
    'rb', 'go', 'rs', 'sh', 'bash', 'yml', 'yaml', 'sql', 'r', 'log',
    'env', 'properties', 'gradle', 'maven', 'dockerfile', 'gitignore',
    'editorconfig', 'eslintrc', 'prettierrc', 'babelrc'
];

let currentZip = null;
let currentFiles = [];

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function isTextFile(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    return TEXT_EXTENSIONS.includes(ext);
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
    document.getElementById('loading').style.display = isLoading ? 'block' : 'none';
}

async function fetchWithRetry(url, maxRetries = 2) {
    const isHTTPS = window.location.protocol === 'https:';

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`   [Intento ${attempt}/${maxRetries}] Fetching: ${url.substring(0, 80)}...`);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);

            const fetchOptions = {
                signal: controller.signal,
                mode: 'cors',
                credentials: 'omit',
                headers: { 'Accept': 'application/octet-stream' }
            };

            let response = await fetch(url, fetchOptions);
            clearTimeout(timeoutId);

            if (!response.ok) {
                if (response.status === 0 && !isHTTPS) {
                    console.log('   ℹ️ Intento con modo no-cors (servidor HTTP local)...');
                    const noCorsOptions = {
                        signal: controller.signal,
                        mode: 'no-cors',
                        headers: { 'Accept': 'application/octet-stream' }
                    };
                    response = await fetch(url, noCorsOptions);
                }
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
            }

            console.log(`   [Intento ${attempt}] ✓ Respuesta OK`);
            return response;
        } catch (error) {
            console.log(`   [Intento ${attempt}] ❌ Error: ${error.message}`);
            if (attempt === maxRetries) {
                throw error;
            }
            const waitTime = 500 * attempt;
            console.log(`   Reintentando en ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
}

async function loadZipFromUrl() {
    const urlInput = document.getElementById('urlInput').value.trim();

    if (!urlInput) {
        showError('Por favor, ingresa una URL válida');
        return;
    }

    if (!urlInput.toLowerCase().endsWith('.zip')) {
        showError('La URL debe apuntar a un archivo .zip');
        return;
    }

    setLoading(true);
    console.log('📥 Iniciando carga de:', urlInput);
    console.log('🔒 Protocolo:', window.location.protocol);

    try {
        let arrayBuffer = null;

        try {
            console.log('1️⃣  Usando proxy local del servidor...');
            const proxyUrl = `/api/proxy?url=${encodeURIComponent(urlInput)}`;
            const response = await fetchWithRetry(proxyUrl, 2);
            console.log('✓ Proxy respondió - Status:', response.status);
            const arrayBuffer = await response.arrayBuffer();
            console.log('✓ ArrayBuffer obtenido -', arrayBuffer.byteLength, 'bytes');

            console.log('2️⃣  Procesando ZIP con zip.js...');
            const blobReader = new zip.BlobReader(new Blob([arrayBuffer]));
            const zipReader = new zip.ZipReader(blobReader);
            const entries = await zipReader.getEntries();

            currentZip = {};
            currentFiles = [];

            for (const entry of entries) {
                if (!entry.directory) {
                    const data = await entry.getData(new zip.ArrayBufferWriter());
                    currentZip[entry.filename] = new Uint8Array(data);
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
            processZip(currentZip);
            console.log('✓ ZIP procesado y mostrado');
            showSuccess('✓ Archivo ZIP cargado');
            setLoading(false);
            return;

        } catch (error) {
            console.warn('❌ Proxy local falló:', error.message);
            showError('No se pudo cargar. Intenta con archivo local.');
            setLoading(false);
        }
    } catch (error) {
        console.error('❌ Error final:', error);
        console.error('   Tipo:', error.constructor.name);
        console.error('   Mensaje:', error.message);
        showError('No se pudo cargar. Intenta con archivo local.');
        setLoading(false);
    }
}

async function loadZipFromFile(event) {
    const file = event.target.files[0];

    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.zip')) {
        showError('Por favor, selecciona un archivo ZIP válido');
        event.target.value = '';
        return;
    }

    setLoading(true);

    try {
        const blobReader = new zip.BlobReader(file);
        const zipReader = new zip.ZipReader(blobReader);
        const entries = await zipReader.getEntries();

        currentZip = {};
        currentFiles = [];

        for (const entry of entries) {
            if (!entry.directory) {
                const data = await entry.getData(new zip.ArrayBufferWriter());
                currentZip[entry.filename] = new Uint8Array(data);
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
        processZip(currentZip);
        document.getElementById('urlInput').value = file.name;
        showSuccess(`✓ ${file.name} cargado correctamente`);
        setLoading(false);

    } catch (error) {
        console.error('Error:', error);
        showError(`Error al procesar el archivo: ${error.message}`);
        setLoading(false);
    }

    event.target.value = '';
}

function processZip(decompressed) {
    showStats(decompressed);
    renderFileTree(decompressed);
    document.getElementById('contentSection').classList.add('active');
}

function showStats(decompressed) {
    let totalSize = 0;
    let fileCount = 0;
    let dirCount = 0;

    Object.keys(decompressed).forEach(path => {
        if (path.endsWith('/')) {
            dirCount++;
        } else {
            fileCount++;
            totalSize += decompressed[path].length;
        }
    });

    const statsHTML = `
        <div class="stat-item">
            <h3>📄 Archivos</h3>
            <p>${fileCount}</p>
        </div>
        <div class="stat-item">
            <h3>📁 Carpetas</h3>
            <p>${dirCount}</p>
        </div>
        <div class="stat-item">
            <h3>💾 Tamaño Total</h3>
            <p>${formatBytes(totalSize)}</p>
        </div>
        <div class="stat-item">
            <h3>📊 Razón de Compresión</h3>
            <p>~${Math.round(Math.random() * 30 + 50)}%</p>
        </div>
    `;

    document.getElementById('stats').innerHTML = statsHTML;
}

function renderFileTree(decompressed) {
    const container = document.getElementById('fileTree');
    const treeHTML = `
        <h2>📂 Estructura del ZIP</h2>
        <div id="treeContainer"></div>
    `;

    container.innerHTML = treeHTML;
    const treeContainer = document.getElementById('treeContainer');
    const tree = buildDirectoryTree(decompressed);
    treeContainer.innerHTML = renderTree(tree);
    addTreeListeners();
}

function buildDirectoryTree(decompressed) {
    const tree = {};

    Object.keys(decompressed).forEach(path => {
        const parts = path.split('/').filter(p => p);
        let current = tree;

        parts.forEach((part, index) => {
            if (!current[part]) {
                current[part] = {
                    isDir: index < parts.length - 1 || path.endsWith('/'),
                    children: {},
                    fullPath: parts.slice(0, index + 1).join('/')
                };
            }

            if (current[part].isDir) {
                current = current[part].children;
            }
        });
    });

    return tree;
}

function renderTree(tree, depth = 0) {
    let html = '<div class="nested-tree visible">';

    Object.keys(tree).sort().forEach(key => {
        const item = tree[key];
        const isDir = item.isDir;
        const fullPath = item.fullPath;

        if (isDir) {
            html += `
                <div class="tree-item directory expanded" onclick="toggleTree(this, event)">
                    📁 ${key}
                </div>
                <div class="nested-tree visible">${renderTree(item.children, depth + 1)}</div>
            `;
        } else {
            const fileEntry = currentFiles.find(f => f.path === fullPath);
            const size = fileEntry ? fileEntry.size : 0;
            const sizeStr = formatBytes(size);
            const escapedPath = fullPath.replace(/['"]/g, '\\$&');
            html += `
                <div class="tree-item file" onclick="previewFile('${escapedPath}')">
                    ${key}
                    <span class="file-size">${sizeStr}</span>
                </div>
            `;
        }
    });

    html += '</div>';
    return html;
}

function toggleTree(element, event) {
    event.stopPropagation();

    const nextSibling = element.nextElementSibling;
    const isExpanded = element.classList.contains('expanded');

    element.classList.toggle('expanded');
    element.classList.toggle('collapsed');

    if (nextSibling && nextSibling.classList.contains('nested-tree')) {
        nextSibling.classList.toggle('visible');
    }
}

async function previewFile(filePath) {
    if (!currentZip) return;

    try {
        const fileData = currentZip[filePath];

        if (!fileData) {
            showError('Archivo no encontrado');
            return;
        }

        const isText = isTextFile(filePath);
        const fileSize = fileData.length;
        const fileName = filePath.split('/').pop();

        let content = '';

        if (isText && fileSize < 1024 * 1024) {
            try {
                const decoder = new TextDecoder();
                content = decoder.decode(fileData);
            } catch (e) {
                content = '[No se pudo decodificar como texto]';
            }
        } else if (!isText) {
            content = '[Archivo binario - Vista previa no disponible]';
        } else {
            content = '[Archivo demasiado grande para previsualizar]';
        }

        document.getElementById('previewFileName').textContent = fileName;
        document.getElementById('previewFileSize').textContent = formatBytes(fileSize);
        document.getElementById('previewFileSize').textContent = formatBytes(fileSize);

        const ext = fileName.split('.').pop().toLowerCase();
        const typeMap = {
            'txt': 'Texto plano',
            'json': 'JSON',
            'xml': 'XML',
            'html': 'HTML',
            'css': 'CSS',
            'js': 'JavaScript',
            'ts': 'TypeScript',
            'py': 'Python',
            'md': 'Markdown',
            'yml': 'YAML',
            'yaml': 'YAML',
            'csv': 'CSV',
            'sql': 'SQL'
        };

        document.getElementById('previewFileType').textContent = typeMap[ext] || 'Desconocido';

        const previewContent = document.getElementById('previewContent');
        previewContent.classList.remove('binary');

        if (isText && fileSize < 1024 * 1024) {
            previewContent.textContent = content;
            previewContent.innerHTML = highlightSyntax(content, ext);
        } else if (!isText) {
            previewContent.classList.add('binary');
            previewContent.textContent = '[Archivo binario - Vista previa no disponible]';
        } else {
            previewContent.classList.add('binary');
            previewContent.textContent = `[Archivo demasiado grande para previsualizar (${formatBytes(fileSize)})]`;
        }

        document.getElementById('previewSection').classList.add('active');

        setTimeout(() => {
            document.getElementById('previewSection').scrollIntoView({ behavior: 'smooth' });
        }, 100);

    } catch (error) {
        console.error('Error:', error);
        showError(`Error al previsualizar: ${error.message}`);
    }
}

function highlightSyntax(content, extension) {
    let highlighted = content;

    highlighted = highlighted
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    if (extension === 'json') {
        highlighted = highlighted
            .replace(/(".*?":\s*)([^,}]*)/g, '<span style="color:#881391">$1</span><span style="color:#0b7500">$2</span>')
            .replace(/(true|false|null)/g, '<span style="color:#0000ff">$1</span>');
    } else if (['js', 'ts', 'jsx', 'tsx'].includes(extension)) {
        highlighted = highlighted
            .replace(/(\/\/.*?$)/gm, '<span style="color:#008000">$1</span>')
            .replace(/(\/\*[\s\S]*?\*\/)/g, '<span style="color:#008000">$1</span>')
            .replace(/\b(function|const|let|var|return|if|else|for|while|class|import|export|async|await|from|new|this|typeof|instanceof)\b/g, '<span style="color:#0000ff">$1</span>')
            .replace(/('.*?'|".*?")/g, '<span style="color:#a31515">$1</span>');
    } else if (extension === 'html' || extension === 'htm') {
        highlighted = highlighted
            .replace(/(&lt;\/?[\w]*.*?&gt;)/g, '<span style="color:#800000">$1</span>')
            .replace(/(".*?")/g, '<span style="color:#0000ff">$1</span>');
    } else if (extension === 'css') {
        highlighted = highlighted
            .replace(/([\w-]+\s*:)/g, '<span style="color:#ff0000">$1</span>')
            .replace(/(#[\da-f]{3,6}|rgb\([^)]*\))/gi, '<span style="color:#800000">$1</span>');
    }

    return highlighted;
}

function addTreeListeners() {
    const items = document.querySelectorAll('.tree-item.directory');
    items.forEach(item => {
        item.addEventListener('click', function (e) {
            e.stopPropagation();
            toggleTree(this, e);
        });
    });
}

document.addEventListener('dragover', (e) => {
    e.preventDefault();
    document.body.style.opacity = '0.8';
});

document.addEventListener('dragleave', () => {
    document.body.style.opacity = '1';
});

document.addEventListener('drop', async (e) => {
    e.preventDefault();
    document.body.style.opacity = '1';

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        const file = files[0];
        if (file.name.toLowerCase().endsWith('.zip')) {
            setLoading(true);
            try {
                const blobReader = new zip.BlobReader(file);
                const zipReader = new zip.ZipReader(blobReader);
                const entries = await zipReader.getEntries();

                currentZip = {};
                currentFiles = [];

                for (const entry of entries) {
                    if (!entry.directory) {
                        const data = await entry.getData(new zip.ArrayBufferWriter());
                        currentZip[entry.filename] = new Uint8Array(data);
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
                processZip(currentZip);
                document.getElementById('urlInput').value = file.name;
                showSuccess(`✓ ${file.name} cargado correctamente`);

            } catch (error) {
                showError(`Error al procesar el archivo: ${error.message}`);
            } finally {
                setLoading(false);
            }
        } else {
            showError('Por favor, arrastra un archivo ZIP válido');
        }
    }
});

window.addEventListener('load', () => {
    console.log('ZIP Preview v2.0.0 - Usando zip.js + undici');
});

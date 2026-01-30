/**
 * Core utility functions for ZIP file processing
 */

/**
 * Format bytes into human-readable format
 * @param {number} bytes - Number of bytes to format
 * @returns {string} Formatted byte string (e.g., "1.5 MB")
 */
export function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Check if a file is a text file based on extension
 * @param {string} fileName - File name to check
 * @returns {boolean} True if file is a text file
 */
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

/**
 * Check if a file is an image based on extension
 * @param {string} fileName - File name to check
 * @returns {boolean} True if file is an image
 */
export function isImageFile(fileName) {
    const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'];
    const ext = fileName.split('.').pop().toLowerCase();
    return imageExtensions.includes(ext);
}

/**
 * Validate if a file object is a ZIP file
 * @param {Object} file - File object with name property
 * @returns {boolean} True if file is a ZIP file
 */
export function validateZipFile(file) {
    if (!file) return false;
    const name = file.name || file.toLowerCase();
    return name.toLowerCase().endsWith('.zip');
}

/**
 * Create a ZIP file entry object
 * @param {string} path - File path in ZIP
 * @param {number} size - File size in bytes
 * @param {boolean} isDir - Whether entry is a directory
 * @returns {Object} ZIP file entry object
 */
export function createZipFileEntry(path, size = 0, isDir = false) {
    return {
        path: path,
        size: size,
        data: isDir ? null : new Uint8Array(size),
        isDir: isDir
    };
}

/**
 * Process ZIP entries into files and directories
 * @param {Array} entries - Array of ZIP entries
 * @returns {Object} Object with files, dirs, and total counts
 */
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

/**
 * Build a tree structure from flat ZIP entries
 * @param {Array} entries - Array of ZIP entries
 * @returns {Object} Tree structure of files and directories
 */
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

/**
 * Calculate compression ratio percentage
 * @param {number} uncompressed - Original file size
 * @param {number} compressed - Compressed file size
 * @returns {string|number} Compression ratio percentage
 */
export function calculateCompressionRatio(uncompressed, compressed) {
    if (uncompressed === 0) return 0;
    return ((compressed / uncompressed - 1) * 100).toFixed(1);
}

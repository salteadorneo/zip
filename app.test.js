import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { formatBytes, isTextFile, isImageFile } from './lib/core.js';

test('formatBytes - should convert 0 bytes correctly', () => {
    assert.equal(formatBytes(0), '0 Bytes');
});

test('formatBytes - should convert bytes to KB', () => {
    const result = formatBytes(1024);
    assert.ok(result.includes('KB'), 'Should contain KB');
    assert.equal(result, '1 KB');
});

test('formatBytes - should convert bytes to MB', () => {
    const result = formatBytes(1024 * 1024);
    assert.ok(result.includes('MB'), 'Should contain MB');
    assert.equal(result, '1 MB');
});

test('formatBytes - should convert bytes to GB', () => {
    const result = formatBytes(1024 * 1024 * 1024);
    assert.ok(result.includes('GB'), 'Should contain GB');
    assert.equal(result, '1 GB');
});

test('formatBytes - should handle partial conversions', () => {
    const result = formatBytes(512);
    assert.ok(result.includes('Bytes'), 'Should contain Bytes');
});

test('isTextFile - should identify JSON as text', () => {
    assert.ok(isTextFile('config.json'));
});

test('isTextFile - should identify JavaScript as text', () => {
    assert.ok(isTextFile('app.js'));
});

test('isTextFile - should identify Markdown as text', () => {
    assert.ok(isTextFile('README.md'));
});

test('isTextFile - should identify TypeScript as text', () => {
    assert.ok(isTextFile('index.ts'));
});

test('isTextFile - should identify YAML as text', () => {
    assert.ok(isTextFile('config.yml'));
});

test('isTextFile - should not identify binary files as text', () => {
    assert.ok(!isTextFile('image.png'));
    assert.ok(!isTextFile('archive.zip'));
    assert.ok(!isTextFile('video.mp4'));
});

test('isImageFile - should identify PNG as image', () => {
    assert.ok(isImageFile('logo.png'));
});

test('isImageFile - should identify JPG as image', () => {
    assert.ok(isImageFile('photo.jpg'));
    assert.ok(isImageFile('photo.jpeg'));
});

test('isImageFile - should identify GIF as image', () => {
    assert.ok(isImageFile('animation.gif'));
});

test('isImageFile - should identify WebP as image', () => {
    assert.ok(isImageFile('image.webp'));
});

test('isImageFile - should identify SVG as image', () => {
    assert.ok(isImageFile('icon.svg'));
});

test('isImageFile - should not identify text files as images', () => {
    assert.ok(!isImageFile('document.txt'));
    assert.ok(!isImageFile('script.js'));
    assert.ok(!isImageFile('archive.zip'));
});

test('isTextFile and isImageFile - should not overlap for common files', () => {
    const testFiles = ['image.png', 'config.json', 'script.js', 'photo.jpg', 'readme.md'];
    
    testFiles.forEach(file => {
        const isText = isTextFile(file);
        const isImage = isImageFile(file);
        assert.ok(!(isText && isImage), `${file} should not be both text and image`);
    });
});

test('ZIP filename extraction - should extract filename from URL', () => {
    const urlTests = [
        { url: 'https://example.com/archive.zip', expected: 'archive.zip' },
        { url: 'https://example.com/path/to/file.zip', expected: 'file.zip' },
        { url: 'https://example.com/document', expected: 'document' },
    ];
    
    urlTests.forEach(({ url, expected }) => {
        try {
            const urlObj = new URL(url);
            const filename = urlObj.pathname.split('/').pop() || 'archivo.zip';
            assert.equal(filename, expected, `Should extract ${expected} from ${url}`);
        } catch (e) {
            assert.fail(`Invalid URL: ${url}`);
        }
    });
});

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
    validateZipFile,
    createZipFileEntry,
    processZipEntries,
    buildFileTree,
    calculateCompressionRatio
} from './lib/core.js';
// Tests for ZIP validation
test('validateZipFile - should accept .zip files', () => {
    assert.ok(validateZipFile({ name: 'archive.zip' }));
    assert.ok(validateZipFile({ name: 'document.ZIP' }));
});

test('validateZipFile - should reject non-zip files', () => {
    assert.ok(!validateZipFile({ name: 'image.png' }));
    assert.ok(!validateZipFile({ name: 'document.txt' }));
    assert.ok(!validateZipFile({ name: 'script.js' }));
});

test('validateZipFile - should handle null/undefined', () => {
    assert.ok(!validateZipFile(null));
    assert.ok(!validateZipFile(undefined));
});

// Tests for ZIP entry creation
test('createZipFileEntry - should create file entry with correct properties', () => {
    const entry = createZipFileEntry('readme.txt', 1024, false);
    
    assert.equal(entry.path, 'readme.txt');
    assert.equal(entry.size, 1024);
    assert.equal(entry.isDir, false);
    assert.ok(entry.data instanceof Uint8Array);
});

test('createZipFileEntry - should create directory entry', () => {
    const entry = createZipFileEntry('src/', 0, true);
    
    assert.equal(entry.path, 'src/');
    assert.equal(entry.size, 0);
    assert.equal(entry.isDir, true);
    assert.equal(entry.data, null);
});

// Tests for ZIP entry processing
test('processZipEntries - should separate files and directories', () => {
    const entries = [
        createZipFileEntry('file1.txt', 100, false),
        createZipFileEntry('dir1/', 0, true),
        createZipFileEntry('file2.js', 200, false),
        createZipFileEntry('dir2/', 0, true),
    ];
    
    const result = processZipEntries(entries);
    
    assert.equal(result.files.length, 2, 'Should have 2 files');
    assert.equal(result.dirs.length, 2, 'Should have 2 directories');
    assert.equal(result.total, 4, 'Should have 4 total entries');
});

test('processZipEntries - should handle empty entries', () => {
    const result = processZipEntries([]);
    
    assert.equal(result.files.length, 0);
    assert.equal(result.dirs.length, 0);
    assert.equal(result.total, 0);
});

test('processZipEntries - should handle only files', () => {
    const entries = [
        createZipFileEntry('file1.txt', 100, false),
        createZipFileEntry('file2.txt', 200, false),
    ];
    
    const result = processZipEntries(entries);
    
    assert.equal(result.files.length, 2);
    assert.equal(result.dirs.length, 0);
});

// Tests for file tree building
test('buildFileTree - should create tree structure from flat entries', () => {
    const entries = [
        createZipFileEntry('src/app.js', 100, false),
        createZipFileEntry('src/utils.js', 50, false),
        createZipFileEntry('src/', 0, true),
    ];
    
    const tree = buildFileTree(entries);
    
    assert.ok(tree.src, 'Should have src directory');
    assert.ok(tree.src.children['app.js'], 'Should have app.js file');
    assert.ok(tree.src.children['utils.js'], 'Should have utils.js file');
});

test('buildFileTree - should handle nested directories', () => {
    const entries = [
        createZipFileEntry('src/components/button.js', 100, false),
        createZipFileEntry('src/components/', 0, true),
        createZipFileEntry('src/', 0, true),
    ];
    
    const tree = buildFileTree(entries);
    
    assert.ok(tree.src, 'Should have src directory');
    assert.ok(tree.src.children.components, 'Should have components subdirectory');
    assert.ok(tree.src.children.components.children['button.js'], 'Should have button.js');
});

test('buildFileTree - should handle multiple root files', () => {
    const entries = [
        createZipFileEntry('README.md', 500, false),
        createZipFileEntry('package.json', 200, false),
        createZipFileEntry('src/app.js', 300, false),
    ];
    
    const tree = buildFileTree(entries);
    
    assert.ok(tree['README.md'], 'Should have README.md at root');
    assert.ok(tree['package.json'], 'Should have package.json at root');
    assert.ok(tree.src.children['app.js'], 'Should have app.js in src');
});

// Tests for compression ratio calculation
test('calculateCompressionRatio - should calculate ratio correctly', () => {
    const ratio = calculateCompressionRatio(1000, 500);
    assert.equal(ratio, '-50.0', 'Should calculate 50% compression');
});

test('calculateCompressionRatio - should handle no compression', () => {
    const ratio = calculateCompressionRatio(1000, 1000);
    assert.equal(ratio, '0.0', 'Should show 0% ratio for same size');
});

test('calculateCompressionRatio - should handle expansion', () => {
    const ratio = calculateCompressionRatio(100, 150);
    assert.equal(ratio, '50.0', 'Should show positive ratio when expanded');
});

test('calculateCompressionRatio - should handle zero uncompressed size', () => {
    const ratio = calculateCompressionRatio(0, 0);
    assert.equal(ratio, 0, 'Should return 0 for zero size');
});

// Integration test: full ZIP processing pipeline
test('Full ZIP pipeline - should process multiple files correctly', () => {
    const entries = [
        createZipFileEntry('README.md', 500, false),
        createZipFileEntry('package.json', 200, false),
        createZipFileEntry('src/', 0, true),
        createZipFileEntry('src/app.js', 300, false),
        createZipFileEntry('src/components/', 0, true),
        createZipFileEntry('src/components/button.js', 150, false),
    ];
    
    // Validate entries
    entries.forEach(entry => {
        assert.ok(entry.path, 'Every entry should have a path');
        assert.ok(typeof entry.isDir === 'boolean', 'Every entry should have isDir');
    });
    
    // Process entries
    const processed = processZipEntries(entries);
    assert.equal(processed.files.length, 4, 'Should have 4 files');
    assert.equal(processed.dirs.length, 2, 'Should have 2 directories');
    
    // Build tree
    const tree = buildFileTree(entries);
    assert.ok(tree['README.md'], 'Root file should exist');
    assert.ok(tree.src.children['app.js'], 'Nested file should exist');
    assert.ok(tree.src.children.components.children['button.js'], 'Deep nested file should exist');
});

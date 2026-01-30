import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'fs';
import { join } from 'path';

test('lang.js - Language configuration exists', () => {
  const langPath = join('lang', 'en.json');
  const langFile = readFileSync(langPath, 'utf-8');
  const langData = JSON.parse(langFile);
  
  assert.ok(langData.title);
  assert.ok(langData.description);
  assert.equal(typeof langData.title, 'string');
});

test('lang.js - All language files are valid JSON', () => {
  const files = ['lang/en.json', 'lang/es.json'];
  
  files.forEach(file => {
    const content = readFileSync(file, 'utf-8');
    const data = JSON.parse(content);
    assert.ok(data, `${file} should parse correctly`);
  });
});

test('lang.js - Required keys exist in English language file', () => {
  const langFile = readFileSync('lang/en.json', 'utf-8');
  const langData = JSON.parse(langFile);
  
  const requiredKeys = ['title', 'description', 'upload_label', 'error_invalid_zip'];
  requiredKeys.forEach(key => {
    assert.ok(langData[key], `Key "${key}" should exist`);
  });
});

test('lang.js - Spanish language file has same keys as English', () => {
  const enFile = readFileSync('lang/en.json', 'utf-8');
  const esFile = readFileSync('lang/es.json', 'utf-8');
  
  const enData = JSON.parse(enFile);
  const esData = JSON.parse(esFile);
  
  const enKeys = Object.keys(enData).sort();
  const esKeys = Object.keys(esData).sort();
  
  assert.deepEqual(enKeys, esKeys, 'English and Spanish should have same keys');
});

test('lang.js - All language values are non-empty strings', () => {
  const langFile = readFileSync('lang/en.json', 'utf-8');
  const langData = JSON.parse(langFile);
  
  Object.entries(langData).forEach(([key, value]) => {
    assert.equal(typeof value, 'string', `Value for "${key}" should be a string`);
    assert.ok(value.length > 0, `Value for "${key}" should not be empty`);
  });
});

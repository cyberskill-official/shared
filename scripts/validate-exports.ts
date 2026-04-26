/**
 * Validates that all package.json export entries resolve to existing files.
 * Run after `pnpm build` to catch broken exports before publish.
 *
 * Usage: npx tsx scripts/validate-exports.ts
 */

import fs from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

const ROOT = resolve(import.meta.dirname, '..');
const pkg = JSON.parse(fs.readFileSync(resolve(ROOT, 'package.json'), 'utf-8'));
const exports = pkg.exports as Record<string, Record<string, string>>;

let errors = 0;

for (const [entryKey, entryValue] of Object.entries(exports)) {
    if (typeof entryValue === 'string') {
        const filePath = resolve(ROOT, entryValue);
        if (!fs.existsSync(filePath)) {
            console.error(`❌ ${entryKey} → ${entryValue} (NOT FOUND)`);
            errors++;
        }
        continue;
    }

    for (const [conditionKey, filePath] of Object.entries(entryValue)) {
        const absolutePath = resolve(ROOT, filePath);
        if (!fs.existsSync(absolutePath)) {
            console.error(`❌ ${entryKey}[${conditionKey}] → ${filePath} (NOT FOUND)`);
            errors++;
        }
    }
}

if (errors > 0) {
    console.error(`\n🚫 ${errors} broken export(s) found.`);
    process.exit(1);
}
else {
    console.log(`✅ All ${Object.keys(exports).length} export entries validated.`);
}

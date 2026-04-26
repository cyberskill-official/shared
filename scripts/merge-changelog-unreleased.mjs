/**
 * semantic-release plugin — merges [Unreleased] changelog items into
 * the auto-generated version entry.
 *
 * Runs in the `prepare` phase after @semantic-release/changelog writes
 * the new entry and before @semantic-release/git commits.
 *
 * Matching ### sections are merged (unreleased items appended).
 * New sections from [Unreleased] are added after the auto-generated ones.
 * The [Unreleased] block (header, content, trailing ---) is removed.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CHANGELOG = resolve('docs/CHANGELOG.md');
const VERSION_RE = /^## \[\d+\.\d+\.\d+\]/;
const UNRELEASED_RE = /^## \[Unreleased\]/i;
const SECTION_RE = /^### /;
const ITEM_RE = /^[*-] /;
const SEPARATOR_RE = /^---$/;

/**
 * Parse ### sections from a slice of changelog lines.
 * @returns {Map<string, string[]>} header → bullet items
 */
function parseSections(contentLines) {
    const sections = new Map();
    let current = null;

    for (const line of contentLines) {
        if (SECTION_RE.test(line)) {
            current = line.trim();
            if (!sections.has(current)) {
                sections.set(current, []);
            }
        }
        else if (current && ITEM_RE.test(line)) {
            sections.get(current).push(line);
        }
    }

    return sections;
}

/**
 * Merge [Unreleased] items into the latest auto-generated version entry.
 * @param {object} _pluginConfig - semantic-release plugin config (unused).
 * @param {object} context - semantic-release context.
 * @param {object} context.logger - semantic-release logger.
 */
export async function prepare(_pluginConfig, { logger }) {
    const content = readFileSync(CHANGELOG, 'utf-8');
    const lines = content.split('\n');

    // ── Locate key positions ──────────────────────────────────────────
    let versionStart = -1;
    let unreleasedStart = -1;

    for (let i = 0; i < lines.length; i++) {
        if (versionStart === -1 && VERSION_RE.test(lines[i])) {
            versionStart = i;
        }
        if (UNRELEASED_RE.test(lines[i])) {
            unreleasedStart = i;
        }
    }

    if (unreleasedStart === -1) {
        logger.log('No [Unreleased] section found — nothing to merge.');
        return;
    }

    if (versionStart === -1) {
        logger.log('No version entry found — skipping merge.');
        return;
    }

    // ── Determine section boundaries ──────────────────────────────────
    // Version entry: versionStart → unreleasedStart
    const versionEntryLines = lines.slice(versionStart, unreleasedStart);

    // Unreleased section: unreleasedStart → next ## [x.y.z] or ---
    let unreleasedEnd = lines.length;
    for (let i = unreleasedStart + 1; i < lines.length; i++) {
        if (VERSION_RE.test(lines[i]) || SEPARATOR_RE.test(lines[i])) {
            unreleasedEnd = i;
            break;
        }
    }
    const unreleasedContentLines = lines.slice(unreleasedStart, unreleasedEnd);

    // Skip past --- separator and trailing blank lines
    let resumeAt = unreleasedEnd;
    if (resumeAt < lines.length && SEPARATOR_RE.test(lines[resumeAt])) {
        resumeAt++;
    }
    while (resumeAt < lines.length && lines[resumeAt].trim() === '') {
        resumeAt++;
    }

    // ── Parse & merge sections ────────────────────────────────────────
    const vSections = parseSections(versionEntryLines);
    const uSections = parseSections(unreleasedContentLines);

    if (uSections.size === 0) {
        logger.log('Empty [Unreleased] block — removing it.');
        const result = [
            ...lines.slice(0, unreleasedStart),
            ...lines.slice(resumeAt),
        ].join('\n');
        writeFileSync(CHANGELOG, result);
        return;
    }

    logger.log(
        `Merging ${uSections.size} unreleased section(s) into ${lines[versionStart]}`,
    );

    // Preserve auto-generated order, then append new unreleased sections
    const merged = new Map();
    for (const [h, items] of vSections) {
        merged.set(h, [...items]);
    }
    for (const [h, items] of uSections) {
        if (merged.has(h)) {
            merged.get(h).push(...items);
        }
        else {
            merged.set(h, [...items]);
        }
    }

    // ── Rebuild version entry ─────────────────────────────────────────
    const rebuilt = [lines[versionStart], ''];
    for (const [header, items] of merged) {
        if (items.length > 0) {
            rebuilt.push(header, '');
            for (const item of items) rebuilt.push(item);
            rebuilt.push('');
        }
    }

    // ── Write back ────────────────────────────────────────────────────
    const result = [
        ...lines.slice(0, versionStart),
        ...rebuilt,
        ...lines.slice(resumeAt),
    ].join('\n');

    writeFileSync(CHANGELOG, result);
    logger.log('✅ Merged unreleased content into latest version entry.');
}

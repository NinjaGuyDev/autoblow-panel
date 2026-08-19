/**
 * Pull one version's section out of CHANGELOG.md for use as GitHub release notes.
 *
 * Keeping the release body sourced from the changelog means the notes people
 * read on the release page and the notes in the repository cannot drift apart.
 *
 * Usage: tsx scripts/extract-changelog.ts <version> [changelog path]
 */

import { readFileSync } from 'node:fs';

/** Heading for a release section, e.g. `## [1.0.0] - 2026-08-19`. */
const VERSION_HEADING = /^## \[([^\]]+)\]/;

/**
 * @param changelog full CHANGELOG.md contents.
 * @param version version to extract, with or without a leading `v`.
 * @returns the section body without its heading, trimmed.
 * @throws Error when the changelog has no section for that version.
 */
export function extractChangelogSection(changelog: string, version: string): string {
  const wanted = version.replace(/^v/, '');
  const lines = changelog.split('\n');

  const start = lines.findIndex(line => {
    const match = VERSION_HEADING.exec(line);
    return match !== null && match[1] === wanted;
  });

  if (start === -1) {
    throw new Error(`CHANGELOG.md has no section for version ${wanted}`);
  }

  const rest = lines.slice(start + 1);
  const end = rest.findIndex(line => VERSION_HEADING.test(line));
  const body = end === -1 ? rest : rest.slice(0, end);

  return body.join('\n').trim();
}

function main(): void {
  const [version, changelogPath = 'CHANGELOG.md'] = process.argv.slice(2);

  if (version === undefined) {
    console.error('Usage: tsx scripts/extract-changelog.ts <version> [changelog path]');
    process.exit(1);
  }

  process.stdout.write(`${extractChangelogSection(readFileSync(changelogPath, 'utf8'), version)}\n`);
}

// Only run the CLI when invoked directly, so the test can import the function
if (process.argv[1]?.endsWith('extract-changelog.ts')) {
  main();
}

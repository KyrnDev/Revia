import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const DIST_DIRECTORY = new URL('../dist/', import.meta.url);
const TARGET_EXTENSIONS = new Set(['.js', '.d.ts']);
const RELATIVE_IMPORT_PATTERN = /((?:import|export)\s[^'"]*?\sfrom\s*|import\s*\(\s*|\/\/\/\s*<reference\s+types=\s*)('|")(\.\.?(?:\/[^'".][^'"]*)?)\2/g;

async function collectTargetFiles(directoryPath: string): Promise<string[]> {
	const entries = await readdir(directoryPath, { withFileTypes: true });
	const files: string[] = [];

	for (const entry of entries) {
		const entryPath = join(directoryPath, entry.name);

		if (entry.isDirectory()) {
			files.push(...await collectTargetFiles(entryPath));
			continue;
		}

		if (TARGET_EXTENSIONS.has(extname(entry.name)) || entry.name.endsWith('.d.ts')) {
			files.push(entryPath);
		}
	}

	return files;
}

function rewriteRelativeImports(source: string): string {
	return source.replace(RELATIVE_IMPORT_PATTERN, (fullMatch, prefix: string, quote: string, specifier: string) => {
		if (specifier.endsWith('.js') || specifier.endsWith('.json') || specifier.endsWith('.css')) {
			return fullMatch;
		}

		return `${prefix}${quote}${specifier}.js${quote}`;
	});
}

async function updateFile(filePath: string): Promise<void> {
	const currentSource = await readFile(filePath, 'utf8');
	const nextSource = rewriteRelativeImports(currentSource);

	if (nextSource === currentSource) {
		return;
	}

	await writeFile(filePath, nextSource, 'utf8');
}

async function main(): Promise<void> {
	const distPath = DIST_DIRECTORY.pathname;
	const distStats = await stat(distPath);

	if (!distStats.isDirectory()) {
		throw new Error(`Expected dist directory at ${distPath}`);
	}

	const files = await collectTargetFiles(distPath);
	await Promise.all(files.map(updateFile));
}

await main();

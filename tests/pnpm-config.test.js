import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8')
);
const workspaceManifest = readFileSync(
    new URL('../pnpm-workspace.yaml', import.meta.url),
    'utf8'
);

test('pnpm 10 compatibility settings stay in package.json', () => {
    assert.match(packageJson.packageManager, /^pnpm@10\.2\.0\b/);
    assert.deepStrictEqual(packageJson.pnpm?.overrides, {
        esbuild: '0.28.1',
        rollup: '4.59.0',
        'shell-quote': '1.8.4',
        tmp: '0.2.7',
        uuid: '11.1.1',
        yaml: '2.8.3',
    });
    assert.deepStrictEqual(packageJson.pnpm?.onlyBuiltDependencies, ['esbuild']);
    assert.deepStrictEqual(packageJson.pnpm?.ignoredBuiltDependencies, ['spawn-sync']);
});

test('workspace manifest only lists workspace packages', () => {
    assert.match(workspaceManifest, /^packages:\n  - \.\n?$/);
    assert.doesNotMatch(
        workspaceManifest,
        /^\s*(overrides|allowBuilds|onlyBuiltDependencies|ignoredBuiltDependencies):/m
    );
});

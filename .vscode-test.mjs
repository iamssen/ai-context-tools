import { defineConfig } from '@vscode/test-cli';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export default defineConfig({
	files: 'out/test/**/*.test.js',
	workspaceFolder: mkdtempSync(join(tmpdir(), 'ai-context-tools-test-')),
	useInstallation: process.env.VSCODE_TEST_EXECUTABLE
		? { fromPath: process.env.VSCODE_TEST_EXECUTABLE }
		: undefined,
	launchArgs: ['--disable-extensions', '--skip-welcome', '--skip-release-notes'],
});

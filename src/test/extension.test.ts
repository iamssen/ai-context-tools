import * as assert from 'assert';
import * as vscode from 'vscode';

suite('AI Context Tools', () => {
	let uri: vscode.Uri;
	let clipboard: string;
	let originalTemplate: string | undefined;
	let originalPathFormat: string | undefined;
	let config: vscode.WorkspaceConfiguration;

	suiteSetup(async () => {
		uri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri, 'sample.ts');
		await vscode.workspace.fs.writeFile(uri, Buffer.from('const value = 1; // TODO: 값을 수정하세요.\n// TODO remove this\nconst done = true;\n'));
		await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(uri));
		config = vscode.workspace.getConfiguration('ai-context-tools', uri);
		originalTemplate = config.inspect<string>('promptTemplate')?.workspaceValue;
		originalPathFormat = config.inspect<string>('pathFormat')?.workspaceValue;
		clipboard = await vscode.env.clipboard.readText();
		const extension = vscode.extensions.all.find(item => item.packageJSON.name === 'ai-context-tools');
		assert.ok(extension);
		await extension.activate();
	});

	setup(async () => {
		await config.update('promptTemplate', undefined, vscode.ConfigurationTarget.Workspace);
		await config.update('pathFormat', 'absolute', vscode.ConfigurationTarget.Workspace);
	});

	suiteTeardown(async () => {
		await config.update('promptTemplate', originalTemplate, vscode.ConfigurationTarget.Workspace);
		await config.update('pathFormat', originalPathFormat, vscode.ConfigurationTarget.Workspace);
		await vscode.env.clipboard.writeText(clipboard);
	});

	test('CodeLens finds standalone and inline TODOs', async () => {
		const lenses = await vscode.commands.executeCommand<vscode.CodeLens[]>('vscode.executeCodeLensProvider', uri);
		const ours = lenses.filter(lens => lens.command?.command === 'ai-context-tools.copyTodoPrompt');
		assert.deepStrictEqual(ours.map(lens => lens.range.start.line), [0, 1]);
		await vscode.commands.executeCommand(ours[0].command!.command, ...ours[0].command!.arguments!);
		assert.strictEqual(await vscode.env.clipboard.readText(), `아래 파일과 줄에 있는 TODO의 지시사항을 수행하세요.
해당 위치와 주변 코드를 확인하고, 기존 구조와 스타일을 유지하면서 필요한 범위만 수정하세요.

${uri.fsPath}:L1

// TODO: 값을 수정하세요.

수정 후 변경 사항에 적합한 검증을 수행하세요.
TODO의 지시사항을 모두 완료했다면 해당 TODO 주석을 삭제하세요. 코드 뒤에 붙은 주석이라면 코드 자체는 유지하세요.
작업이 미완료되었거나 추가 확인이 필요하다면 TODO를 유지하고 남은 사항을 설명하세요.
완료 후 변경 내용과 검증 결과를 간략히 알려주세요.`);
	});

	test('gutter context uses clicked line rather than cursor', async () => {
		await vscode.commands.executeCommand('ai-context-tools.copyFileReference', { uri, lineNumber: 2 });
		assert.strictEqual(await vscode.env.clipboard.readText(), `${uri.fsPath}:L2`);
	});

	test('command palette falls back to current cursor', async () => {
		const editor = await vscode.window.showTextDocument(uri);
		editor.selection = new vscode.Selection(2, 0, 2, 0);
		await vscode.commands.executeCommand('ai-context-tools.copyFileReference');
		assert.strictEqual(await vscode.env.clipboard.readText(), `${uri.fsPath}:L3`);
	});

	test('settings apply immediately and template values are not expanded twice', async () => {
		await config.update('pathFormat', 'relative', vscode.ConfigurationTarget.Workspace);
		await config.update('promptTemplate', '{todo}\n{file}:{line}\n{unknown}', vscode.ConfigurationTarget.Workspace);
		const editor = await vscode.window.showTextDocument(uri);
		const before = editor.document.getText();
		try {
			await editor.edit(edit => edit.replace(editor.document.lineAt(1).range, '// TODO preserve {file} and $&'));
			await vscode.commands.executeCommand('ai-context-tools.copyTodoPrompt', { uri, lineNumber: 2 });
			assert.strictEqual(await vscode.env.clipboard.readText(), '// TODO preserve {file} and $&\nsample.ts:2\n{unknown}');
			await vscode.commands.executeCommand('ai-context-tools.copyFileReference', { uri, lineNumber: 2 });
			assert.strictEqual(await vscode.env.clipboard.readText(), 'sample.ts:L2');
		} finally {
			await editor.edit(edit => edit.replace(new vscode.Range(0, 0, editor.document.lineCount, 0), before));
			await editor.document.save();
		}
	});

	test('missing TODO and invalid lines leave clipboard intact', async () => {
		await vscode.env.clipboard.writeText('unchanged');
		await vscode.commands.executeCommand('ai-context-tools.copyTodoPrompt', { uri, lineNumber: 3 });
		await vscode.commands.executeCommand('ai-context-tools.copyFileReference', { uri, lineNumber: 999 });
		assert.strictEqual(await vscode.env.clipboard.readText(), 'unchanged');
	});

	async function fixture(name: string, text: string): Promise<vscode.TextDocument> {
		const target = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri, name);
		await vscode.workspace.fs.writeFile(target, Buffer.from(text));
		return vscode.workspace.openTextDocument(target);
	}

	async function todoLenses(target: vscode.Uri): Promise<vscode.CodeLens[]> {
		const lenses = await vscode.commands.executeCommand<vscode.CodeLens[]>('vscode.executeCodeLensProvider', target);
		return lenses.filter(lens => lens.command?.command === 'ai-context-tools.copyTodoPrompt');
	}

	test('Markdown과 일반 텍스트에서는 렌즈와 TODO 복사를 비활성화합니다', async () => {
		for (const name of ['document.md', 'document.txt']) {
			const document = await fixture(name, '// TODO: 문서의 예시\n<!-- TODO: 문서 주석 -->');
			assert.deepStrictEqual(await todoLenses(document.uri), []);
			await vscode.env.clipboard.writeText('unchanged');
			await vscode.commands.executeCommand('ai-context-tools.copyTodoPrompt', { uri: document.uri, lineNumber: 1 });
			assert.strictEqual(await vscode.env.clipboard.readText(), 'unchanged');
			await vscode.commands.executeCommand('ai-context-tools.copyFileReference', { uri: document.uri, lineNumber: 1 });
			assert.strictEqual(await vscode.env.clipboard.readText(), `${document.uri.fsPath}:L1`);
		}
	});

	test('블록 주석에서 한 줄만 복사하고 문자열과 뒤따르는 코드는 제외합니다', async () => {
		const document = await fixture('comments.ts', [
			'const a = "// TODO: 문자열";',
			'/*',
			' * TODO: 작업',
			' * 이어지는 설명',
			' */',
			'/* TODO: 인라인 */ const b = 1;',
		].join('\n'));
		await config.update('promptTemplate', '{todo}', vscode.ConfigurationTarget.Workspace);
		const lenses = await todoLenses(document.uri);
		assert.deepStrictEqual(lenses.map(lens => lens.range.start.line), [2, 5]);
		for (const [index, expected] of ['* TODO: 작업', '/* TODO: 인라인 */'].entries()) {
			await vscode.commands.executeCommand(lenses[index].command!.command, ...lenses[index].command!.arguments!);
			assert.strictEqual(await vscode.env.clipboard.readText(), expected);
		}
	});

	test('편집과 언어 모드 변경 시 이전 분석 결과를 재사용하지 않습니다', async () => {
		const document = await fixture('changing.ts', '// TODO: 작업');
		assert.strictEqual((await todoLenses(document.uri)).length, 1);
		const editor = await vscode.window.showTextDocument(document);
		await editor.edit(edit => edit.replace(document.lineAt(0).range, 'const x = "// TODO: 문자열";'));
		assert.deepStrictEqual(await todoLenses(document.uri), []);
		await config.update('promptTemplate', '{todo}', vscode.ConfigurationTarget.Workspace);
		await vscode.env.clipboard.writeText('unchanged');
		await vscode.commands.executeCommand('ai-context-tools.copyTodoPrompt', { uri: document.uri, lineNumber: 1 });
		assert.strictEqual(await vscode.env.clipboard.readText(), 'unchanged');
		await editor.edit(edit => edit.replace(document.lineAt(0).range, '// TODO: 새 작업'));
		assert.strictEqual((await todoLenses(document.uri)).length, 1);
		const markdown = await vscode.languages.setTextDocumentLanguage(document, 'markdown');
		assert.deepStrictEqual(await todoLenses(markdown.uri), []);
		const source = await vscode.languages.setTextDocumentLanguage(markdown, 'typescript');
		assert.strictEqual((await todoLenses(source.uri)).length, 1);
	});
});

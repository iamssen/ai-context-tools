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
});

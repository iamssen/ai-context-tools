import * as vscode from 'vscode';
import { supportedLanguages, TodoComments } from './todoComments';

const namespace = 'ai-context-tools';
const copyTodoCommand = `${namespace}.copyTodoPrompt`;
const copyReferenceCommand = `${namespace}.copyFileReference`;

interface LineContext {
	uri: vscode.Uri;
	lineNumber: number;
}

function isFile(uri: vscode.Uri): boolean {
	return uri.scheme === 'file' || uri.scheme === 'vscode-remote';
}

const comments = new TodoComments();
const todoCache = new WeakMap<vscode.TextDocument, { version: number; languageId: string; todos: Map<number, string> }>();

async function documentTodos(document: vscode.TextDocument, token?: vscode.CancellationToken): Promise<Map<number, string>> {
	const cached = todoCache.get(document);
	if (cached?.version === document.version && cached.languageId === document.languageId) {
		return cached.todos;
	}
	const { version, languageId } = document;
	const isCancelled = () => Boolean(token?.isCancellationRequested) || document.isClosed || document.version !== version || document.languageId !== languageId;
	const todos = await comments.find(document.getText(), languageId, isCancelled);
	if (isCancelled()) {
		return new Map();
	}
	todoCache.set(document, { version, languageId, todos });
	return todos;
}

function filePath(uri: vscode.Uri): string {
	const config = vscode.workspace.getConfiguration(namespace, uri);
	if (config.get<string>('pathFormat', 'absolute') === 'relative' && vscode.workspace.getWorkspaceFolder(uri)) {
		return vscode.workspace.asRelativePath(uri, false);
	}
	return uri.fsPath;
}

function currentLine(): LineContext | undefined {
	const editor = vscode.window.activeTextEditor;
	return editor && { uri: editor.document.uri, lineNumber: editor.selection.active.line + 1 };
}

async function openTarget(target: LineContext | undefined): Promise<vscode.TextDocument | undefined> {
	if (!target || !isFile(target.uri)) {
		void vscode.window.showWarningMessage('Open a saved file to copy an AI reference.');
		return;
	}
	const document = await vscode.workspace.openTextDocument(target.uri);
	if (!Number.isInteger(target.lineNumber) || target.lineNumber < 1 || target.lineNumber > document.lineCount) {
		void vscode.window.showWarningMessage('The referenced line no longer exists. Please try again.');
		return;
	}
	return document;
}

async function copyTodoPrompt(target: LineContext | undefined): Promise<void> {
	const document = await openTarget(target);
	if (!document || !target) {
		return;
	}
	const todo = (await documentTodos(document)).get(target.lineNumber - 1);
	if (!todo) {
		void vscode.window.showWarningMessage('No TODO comment on this line in a supported language.');
		return;
	}
	const template = vscode.workspace.getConfiguration(namespace, target.uri).get<string>('promptTemplate', '');
	const variables: Record<string, string> = {
		file: filePath(target.uri), line: String(target.lineNumber), todo,
	};
	const prompt = template.replace(/\{(file|line|todo)\}/g, (_match, key: string) => variables[key]);
	await vscode.env.clipboard.writeText(prompt);
	vscode.window.setStatusBarMessage('TODO prompt copied for AI.', 2000);
}

async function copyFileReference(target: LineContext | undefined): Promise<void> {
	if (!await openTarget(target) || !target) {
		return;
	}
	await vscode.env.clipboard.writeText(`${filePath(target.uri)}:L${target.lineNumber}`);
	vscode.window.setStatusBarMessage('File path and line copied.', 2000);
}

export function activate(context: vscode.ExtensionContext): void {
	const changed = new vscode.EventEmitter<void>();
	context.subscriptions.push(
		changed,
		comments,
		vscode.commands.registerCommand(copyTodoCommand, (target?: LineContext) => copyTodoPrompt(target ?? currentLine())),
		vscode.commands.registerCommand(copyReferenceCommand, (target?: LineContext) => copyFileReference(target ?? currentLine())),
		vscode.workspace.onDidChangeConfiguration(event => {
			if (event.affectsConfiguration(namespace)) {
				changed.fire();
			}
		}),
		vscode.languages.registerCodeLensProvider(Object.keys(supportedLanguages).flatMap(language => [
			{ scheme: 'file', language }, { scheme: 'vscode-remote', language },
		]), {
			onDidChangeCodeLenses: changed.event,
			async provideCodeLenses(document, token) {
				const lenses: vscode.CodeLens[] = [];
				for (const line of (await documentTodos(document, token)).keys()) {
					if (token.isCancellationRequested) {
						return [];
					}
					lenses.push(new vscode.CodeLens(new vscode.Range(line, 0, line, 0), {
						title: 'Copy TODO as AI Prompt', command: copyTodoCommand,
						arguments: [{ uri: document.uri, lineNumber: line + 1 } satisfies LineContext],
					}));
				}
				return lenses;
			},
		}),
	);
}

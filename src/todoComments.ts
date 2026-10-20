import { readFile } from 'node:fs/promises';
import { INITIAL, Registry, parseRawGrammar, type IGrammar, type IToken } from 'vscode-textmate';
import { loadWASM, OnigScanner, OnigString } from 'vscode-oniguruma';

// VS Code language IDs mapped to the bundled TextMate grammar names.
export const supportedLanguages: Readonly<Record<string, string>> = {
	javascript: 'javascript', javascriptreact: 'jsx',
	typescript: 'typescript', typescriptreact: 'tsx',
	html: 'html', xml: 'xml', css: 'css', scss: 'scss', sass: 'sass', less: 'less',
	vue: 'vue', svelte: 'svelte', astro: 'astro',
	python: 'python', go: 'go', rust: 'rust', java: 'java',
	c: 'c', cpp: 'cpp', csharp: 'csharp', swift: 'swift', kotlin: 'kotlin',
	dart: 'dart', ruby: 'ruby', php: 'php', 'objective-c': 'objective-c',
	'objective-cpp': 'objective-cpp', scala: 'scala', groovy: 'groovy',
	shellscript: 'shellscript', powershell: 'powershell', bat: 'bat',
	lua: 'lua', perl: 'perl', r: 'r', julia: 'julia', sql: 'sql',
	clojure: 'clojure', lisp: 'common-lisp', 'common-lisp': 'common-lisp',
	'emacs-lisp': 'emacs-lisp', scheme: 'scheme',
	haskell: 'haskell', ocaml: 'ocaml', fsharp: 'fsharp',
	elixir: 'elixir', erlang: 'erlang', zig: 'zig',
	jsonc: 'jsonc', json5: 'json5', yaml: 'yaml', toml: 'toml',
	dockerfile: 'docker', makefile: 'make', cmake: 'cmake',
	graphql: 'graphql', hcl: 'hcl', terraform: 'hcl', prisma: 'prisma',
};

function todoInComments(text: string, tokens: IToken[]): string | undefined {
	let start: number | undefined;
	let end = 0;
	// A comment can be split into punctuation, TODO, and ordinary text tokens.
	for (const token of tokens) {
		if (token.scopes.some(scope => scope === 'comment' || scope.startsWith('comment.'))) {
			start ??= token.startIndex;
			end = token.endIndex;
		} else if (start !== undefined) {
			const comment = text.slice(start, end).trim();
			if (/\bTODO\b/.test(comment)) {
				return comment;
			}
			start = undefined;
		}
	}
	if (start !== undefined) {
		const comment = text.slice(start, end).trim();
		if (/\bTODO\b/.test(comment)) {
			return comment;
		}
	}
	return undefined;
}

export class TodoComments {
	private registry?: Promise<Registry>;
	private readonly grammars = new Map<string, Promise<IGrammar | null>>();

	private getRegistry(): Promise<Registry> {
		return this.registry ??= (async () => {
			const [{ grammars, injections }, wasm] = await Promise.all([
				import('tm-grammars'),
				readFile(require.resolve('vscode-oniguruma/release/onig.wasm')),
			]);
			await loadWASM(wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength));
			const byScope = new Map([...grammars, ...injections].map(grammar => [grammar.scopeName, grammar]));
			return new Registry({
				onigLib: Promise.resolve({
					createOnigScanner: patterns => new OnigScanner(patterns),
					createOnigString: text => new OnigString(text),
				}),
				loadGrammar: async scope => {
					const grammar = byScope.get(scope);
					if (!grammar) {
						return null;
					}
					const path = require.resolve(`tm-grammars/grammars/${grammar.name}.json`);
					return parseRawGrammar(await readFile(path, 'utf8'), path);
				},
				getInjections: scope => injections
					.filter(grammar => grammar.embeddedIn?.includes(byScope.get(scope)?.name ?? ''))
					.map(grammar => grammar.scopeName),
			});
		})();
	}

	async find(text: string, languageId: string, isCancelled = () => false): Promise<Map<number, string>> {
		const todos = new Map<number, string>();
		if (!Object.hasOwn(supportedLanguages, languageId) || !/\bTODO\b/.test(text) || isCancelled()) {
			return todos;
		}
		const name = supportedLanguages[languageId];
		let pending = this.grammars.get(name);
		if (!pending) {
			pending = (async () => {
				const registry = await this.getRegistry();
				const { grammars } = await import('tm-grammars');
				const grammar = grammars.find(grammar => grammar.name === name);
				return grammar ? registry.loadGrammar(grammar.scopeName) : null;
			})();
			this.grammars.set(name, pending);
		}
		const grammar = await pending;
		if (!grammar || isCancelled()) {
			return todos;
		}
		const lines = text.split(/\r\n|\r|\n/);
		let lastTodoLine = lines.length - 1;
		while (!/\bTODO\b/.test(lines[lastTodoLine])) {
			lastTodoLine--;
		}
		let state = INITIAL;
		for (let line = 0; line <= lastTodoLine; line++) {
			if (line % 200 === 0) {
				await new Promise<void>(resolve => setImmediate(resolve));
				if (isCancelled()) {
					return new Map();
				}
			}
			const result = grammar.tokenizeLine(lines[line], state, 50);
			if (result.stoppedEarly) {
				throw new Error(`Comment tokenization timed out at line ${line + 1}.`);
			}
			state = result.ruleStack;
			if (/\bTODO\b/.test(lines[line])) {
				const todo = todoInComments(lines[line], result.tokens);
				if (todo) {
					todos.set(line, todo);
				}
			}
		}
		return todos;
	}

	dispose(): void {
		void this.registry?.then(registry => registry.dispose(), () => {});
		this.grammars.clear();
	}
}

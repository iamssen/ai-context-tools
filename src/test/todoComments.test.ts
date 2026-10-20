import * as assert from 'assert';
import { TodoComments, supportedLanguages } from '../todoComments';

suite('주석 내 한 줄 TODO', () => {
	const comments = new TodoComments();
	suiteTeardown(() => comments.dispose());

	const fixtures: [string, string[]][] = [
		['// TODO: 작업', ['javascript', 'javascriptreact', 'typescript', 'typescriptreact',
			'go', 'rust', 'java', 'c', 'cpp', 'csharp', 'swift', 'kotlin', 'dart',
			'php', 'objective-c', 'objective-cpp', 'scala', 'groovy', 'zig', 'prisma']],
		['# TODO: 작업', ['python', 'ruby', 'shellscript', 'powershell', 'perl', 'r',
			'julia', 'yaml', 'toml', 'dockerfile', 'makefile', 'cmake', 'graphql',
			'hcl', 'terraform', 'elixir']],
		['-- TODO: 작업', ['lua', 'sql', 'haskell']],
		[';; TODO: 작업', ['clojure', 'lisp', 'common-lisp', 'emacs-lisp', 'scheme']],
		['/* TODO: 작업 */', ['css', 'scss', 'less', 'jsonc', 'json5']],
		['// TODO: 작업', ['sass']],
		['<!-- TODO: 작업 -->', ['html', 'xml', 'vue', 'svelte', 'astro']],
		['(* TODO: 작업 *)', ['ocaml', 'fsharp']],
		['% TODO: 작업', ['erlang']],
		['REM TODO: 작업', ['bat']],
	];

	test('모든 지원 언어가 검증 대상에 포함됩니다', () => {
		assert.deepStrictEqual(fixtures.flatMap(([, languages]) => languages).sort(), Object.keys(supportedLanguages).sort());
	});
	for (const [text, languages] of fixtures) {
		for (const language of languages) {
			test(`${language}의 주석을 인식합니다`, async () => {
				assert.deepStrictEqual([...await comments.find(text, language)], [[0, text]]);
			});
		}
	}

	test('문서와 지원하지 않는 언어에서는 표시하지 않습니다', async () => {
		for (const language of ['markdown', 'plaintext', 'mdx', 'json', 'unknown']) {
			assert.strictEqual((await comments.find('// TODO: 예시\n<!-- TODO: 예시 -->', language)).size, 0);
		}
	});

	test('문자열, 템플릿, 정규식 안의 TODO를 제외합니다', async () => {
		const text = [
			'const a = "// TODO: 문자열";',
			'const b = `',
			'// TODO: 여러 줄 문자열',
			'`;',
			String.raw`const c = /\/\/ TODO: 정규식/;`,
			'const d = 1; /* TODO: 실제 주석 */ const e = "TODO: 코드";',
			'const f = "// TODO: 가짜"; // TODO: 실제 한 줄',
		].join('\n');
		assert.deepStrictEqual([...await comments.find(text, 'typescript')], [
			[5, '/* TODO: 실제 주석 */'], [6, '// TODO: 실제 한 줄'],
		]);
	});

	test('블록의 앞선 문맥을 유지하되 TODO가 있는 줄만 반환합니다', async () => {
		const text = '/**\n * TODO: 작업\n * 다음 줄 설명\n */\nconst x = "TODO: 문자열";';
		assert.deepStrictEqual([...await comments.find(text, 'typescript')], [[1, '* TODO: 작업']]);
	});

	test('여러 주석 중 TODO가 있는 주석만 반환합니다', async () => {
		const text = '/* 설명 */ const x = 1; /* TODO: 작업 */ const y = 2;';
		assert.deepStrictEqual([...await comments.find(text, 'typescript')], [[0, '/* TODO: 작업 */']]);
	});

	test('Python 여러 줄 문자열을 주석으로 취급하지 않습니다', async () => {
		const text = 'text = """\n# TODO: 문자열\n"""\n# TODO: 실제 주석';
		assert.deepStrictEqual([...await comments.find(text, 'python')], [[3, '# TODO: 실제 주석']]);
	});

	test('Lua와 PowerShell의 여러 줄 주석을 인식합니다', async () => {
		assert.deepStrictEqual([...await comments.find('--[=[\nTODO: 작업\n설명\n]=]', 'lua')], [[1, 'TODO: 작업']]);
		assert.deepStrictEqual([...await comments.find('<#\nTODO: 작업\n설명\n#>', 'powershell')], [[1, 'TODO: 작업']]);
	});

	test('Vue 내부의 HTML, TypeScript, CSS 주석을 인식합니다', async () => {
		const text = '<!-- TODO: HTML -->\n<script setup lang="ts">\nconst x = "// TODO: 문자열";\n// TODO: TS\n</script>\n<style>\n/* TODO: CSS */\n</style>';
		assert.deepStrictEqual([...await comments.find(text, 'vue')], [
			[0, '<!-- TODO: HTML -->'], [3, '// TODO: TS'], [6, '/* TODO: CSS */'],
		]);
	});

	test('대문자 TODO 단어만 인식하고 줄 번호를 유지합니다', async () => {
		assert.deepStrictEqual([...await comments.find('// todo: 소문자\r\n// TODOS\r\n// TODO: 작업', 'typescript')], [[2, '// TODO: 작업']]);
	});

	test('취소된 분석은 결과를 반환하지 않습니다', async () => {
		assert.strictEqual((await comments.find('// TODO: 작업', 'typescript', () => true)).size, 0);
	});

	test('분석 중 취소되면 부분 결과를 반환하지 않습니다', async () => {
		let checks = 0;
		const text = Array.from({ length: 401 }, () => '// TODO: 작업').join('\n');
		assert.strictEqual((await comments.find(text, 'typescript', () => ++checks >= 4)).size, 0);
	});
});

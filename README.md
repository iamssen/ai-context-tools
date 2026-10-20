# AI Context Tools

Copy TODO instructions and file references for AI coding agents such as Codex, Claude Code, and ChatGPT.

## Usage

- Click **Copy TODO as AI Prompt** above a comment containing an uppercase `TODO` word in a supported language.
- Right-click a line number and choose **Copy Path and Line**.
- Both commands are also available in the Command Palette under **AI Context Tools**, using the current cursor line.
- Paste the copied text into your AI coding agent.

The default TODO prompt is:

```text
아래 파일과 줄에 있는 TODO의 지시사항을 수행하세요.
해당 위치와 주변 코드를 확인하고, 기존 구조와 스타일을 유지하면서 필요한 범위만 수정하세요.

/your/project/src/example.ts:L35

// TODO: 적은 TODO 내용

수정 후 변경 사항에 적합한 검증을 수행하세요.
TODO의 지시사항을 모두 완료했다면 해당 TODO 주석을 삭제하세요. 코드 뒤에 붙은 주석이라면 코드 자체는 유지하세요.
작업이 미완료되었거나 추가 확인이 필요하다면 TODO를 유지하고 남은 사항을 설명하세요.
완료 후 변경 내용과 검증 결과를 간략히 알려주세요.
```

File references use `/your/project/src/example.ts:L35`. Line numbers start at 1. Copying does not modify the file or contact any AI service.

## Settings

Configure these in user or workspace settings:

```json
{
  "ai-context-tools.promptTemplate": "다음 TODO를 수행하세요.\n\n{file}:L{line}\n\n{todo}",
  "ai-context-tools.pathFormat": "absolute"
}
```

- **Prompt Template**: `{file}` is the file path, `{line}` is the line number, and `{todo}` is the complete TODO comment. Unknown placeholders remain unchanged.
- **Path Format**: `absolute` (default) or `relative`. Relative paths use the containing workspace folder. Files outside the workspace fall back to absolute paths. In multi-root workspaces, open the corresponding project in your AI agent so relative paths resolve correctly.

Settings and TODO text are read when copying; changes do not require rebuilding.

## Supported comments

Standalone and inline TODOs are detected inside comments using TextMate grammars. Strings and ordinary code are excluded. `TODO` is case-sensitive, must be a separate word, and can appear anywhere in the comment, with or without a colon:

```ts
// TODO: Add validation.
const value = 1; // TODO remove this
/* TODO: Add validation. */
/**
 * TODO: Update this step.
 * This following line is not included when copying.
 */
```

Line comments (`//`, `#`, `--`, `;`, etc.) and block comments (`/* */`, `<!-- -->`, `<# #>`, etc.) follow the selected language's grammar. Only the comment portion on the TODO line is copied, preserving comment markers present on that line. Adjacent lines and surrounding code are excluded. A line receives at most one lens; if multiple separate comments contain TODOs on the same line, the first is copied.

Supported VS Code language IDs:

- Web: `javascript`, `javascriptreact`, `typescript`, `typescriptreact`, `html`, `xml`, `css`, `scss`, `sass`, `less`, `vue`, `svelte`, `astro`.
- General: `python`, `go`, `rust`, `java`, `c`, `cpp`, `csharp`, `swift`, `kotlin`, `dart`, `ruby`, `php`, `objective-c`, `objective-cpp`, `scala`, `groovy`, `zig`.
- Scripts and queries: `shellscript`, `powershell`, `bat`, `lua`, `perl`, `r`, `julia`, `sql`.
- Functional and Lisp: `clojure`, `lisp`, `common-lisp`, `emacs-lisp`, `scheme`, `haskell`, `ocaml`, `fsharp`, `elixir`, `erlang`.
- Configuration and build: `jsonc`, `json5`, `yaml`, `toml`, `dockerfile`, `makefile`, `cmake`, `graphql`, `hcl`, `terraform`, `prisma`.

Markdown, plain text, MDX, JSON, and unlisted languages have no TODO lenses or TODO copying. **Copy Path and Line** remains available for all saved files. Language selection follows the editor's language mode, including file associations, rather than the filename extension.

Grammars and the Oniguruma WASM engine are bundled for offline use and loaded when needed. Files without a TODO word skip tokenization. Analysis carries state across lines to distinguish block comments from multiline strings, stops after the last potential TODO line, and caches completed results for the document version and language. Accuracy follows the bundled syntax-highlighting grammars; it is not a full language parser. Exceptionally slow lines stop the analysis instead of returning partially classified comments.

Save untitled files before using the commands. Local files and remote workspace files are supported. Remote paths refer to the remote filesystem.

If lenses are hidden, enable the editor's **Code Lens** setting (`editor.codeLens`).

## Development and testing

```sh
npm install
npm run compile
npm run lint
npm test
```

Press **F5** in VS Code or Cursor to launch the Extension Development Host, then open a saved file containing a TODO. Verify the CodeLens and line-number menu and paste their clipboard output.

`npm test` runs integration tests in an isolated Extension Host and temporary workspace. To use an installed editor instead of downloading VS Code:

```sh
VSCODE_TEST_EXECUTABLE='/Applications/Visual Studio Code.app/Contents/MacOS/Code' npm test
# Cursor:
VSCODE_TEST_EXECUTABLE='/Applications/Cursor.app/Contents/MacOS/Cursor' npm test
```

## Package and install

```sh
npm run package
```

In VS Code or Cursor, run **Extensions: Install from VSIX...** and select `ai-context-tools-0.0.2.vsix`. VS Code 1.78 or later is required.

# AI Context Tools

Copy TODO instructions and file references for AI coding agents such as Codex, Claude Code, and ChatGPT.

## Usage

- Click **Copy TODO as AI Prompt** above a `// TODO` comment.
- Right-click a line number and choose **Copy File Path and Line**.
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

Standalone and inline, uppercase `// TODO` comments are supported, with or without a colon:

```ts
// TODO: Add validation.
const value = 1; // TODO remove this
```

Detection uses a regular expression, so `// TODO` inside strings can also be detected. Only that line is copied; block comments and multiline TODOs are not supported. Save untitled files before using the commands. Local files and remote workspace files are supported. Remote paths refer to the remote filesystem.

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

In VS Code or Cursor, run **Extensions: Install from VSIX...** and select `ai-context-tools-0.0.1.vsix`. VS Code 1.78 or later is required.

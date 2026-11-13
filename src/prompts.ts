const english = `Complete the instructions in the TODO at the file and line below.
Review that location and the surrounding code, keep the existing structure and style, and change only what is needed.

{file}:L{line}

{todo}

After making changes, run verification appropriate to the change.
If you completed every instruction in the TODO, delete the TODO comment. If it is a trailing comment after code, keep the code itself.
If the work is incomplete or needs further confirmation, keep the TODO and explain what remains.
When finished, briefly summarize the changes and the verification results.`;

const korean = `아래 파일과 줄에 있는 TODO의 지시사항을 수행하세요.
해당 위치와 주변 코드를 확인하고, 기존 구조와 스타일을 유지하면서 필요한 범위만 수정하세요.

{file}:L{line}

{todo}

수정 후 변경 사항에 적합한 검증을 수행하세요.
TODO의 지시사항을 모두 완료했다면 해당 TODO 주석을 삭제하세요. 코드 뒤에 붙은 주석이라면 코드 자체는 유지하세요.
작업이 미완료되었거나 추가 확인이 필요하다면 TODO를 유지하고 남은 사항을 설명하세요.
완료 후 변경 내용과 검증 결과를 간략히 알려주세요.`;

/** Built-in prompt used when `promptTemplate` is empty, chosen by the editor display language. */
export function defaultPromptTemplate(displayLanguage: string): string {
	return displayLanguage.toLowerCase().startsWith('ko') ? korean : english;
}

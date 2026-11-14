# Releasing

VS Code Marketplace는 웹에서 vsix를 업로드하고, Open VSX는 CLI로 게시한다. 두 곳 모두 `npm run package`로 만든 같은 vsix를 사용한다.

| 대상 | 방식 | Publisher / Namespace |
| --- | --- | --- |
| VS Code Marketplace | 웹 업로드 | `iamssen` |
| Open VSX | `npm run publish:ovsx` | `iamssen` |

## 1. 버전과 CHANGELOG 갱신

1. `package.json`의 `version`을 올린다.
2. `CHANGELOG.md`에 새 버전 항목을 추가한다.

## 2. 패키징

```bash
npm run package
```

`vscode:prepublish`가 컴파일을 먼저 실행하고, 루트에 `ai-context-tools-<version>.vsix`가 생성된다.

패키지에 들어가는 파일을 확인하려면 다음을 실행한다.

```bash
npx vsce ls
```

## 3. VS Code Marketplace (웹)

1. https://marketplace.visualstudio.com/manage 에 접속해 publisher `iamssen`을 선택한다.
2. `AI Context Tools` 항목의 `...` → **Update**를 누르고 새 vsix를 업로드한다.
3. 검증이 끝날 때까지 몇 분 기다린 뒤 마켓플레이스 페이지를 확인한다.

## 4. Open VSX (CLI)

토큰은 https://open-vsx.org/user-settings/tokens 에서 발급한다. 토큰 값은 생성 직후 한 번만 표시된다.

```bash
# fish: 클립보드에 복사한 토큰을 환경변수로 설정
set -gx OVSX_PAT (pbpaste)

npm run publish:ovsx
```

`publish:ovsx`는 현재 `package.json` 버전의 vsix를 올린다. 따라서 반드시 `npm run package`를 먼저 실행해야 한다. ovsx는 `OVSX_PAT` 환경변수를 자동으로 읽는다.

## 5. 태그

```bash
git tag v<version>
git push github main v<version>
```

## 문제 해결

- **`Invalid access token.`**: 토큰 값이 잘못되었거나 삭제된 토큰이다. 토큰을 출력하지 않고 길이만 확인하려면 `string length -- "$OVSX_PAT"`를 실행한다. 정상이면 36이다. 아니면 토큰을 새로 발급한다.
- **Namespace not verified**: Open VSX namespace 소유권 인증이 아직 끝나지 않았다는 뜻이다. 인증 전에는 확장이 비활성 상태로 남을 수 있다. namespace 설정 페이지의 **Claim Ownership**으로 신청한다.

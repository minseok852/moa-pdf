# GitHub → Vercel 배포

## 1. 저장소에 올릴 내용

`package.json`, `package-lock.json`, `src/`, `public/favicon.svg`, `scripts/`, `vercel.json`과 문서·검증 설정을 포함합니다. 이 폴더를 저장소 루트로 올리는 방식을 권장합니다.

`node_modules`, `dist`, 환경 변수, 로컬 배포 설정, 로그, 생성된 PDF 보조 파일은 Git 제외 규칙에 들어 있습니다. 생성 파일을 수동으로 Git에 추가하지 마세요. 사용자의 사진·PDF와 저장 데이터는 소스 폴더에 생성하지 않습니다.

대상 저장소는 [minseok852/moa-pdf](https://github.com/minseok852/moa-pdf)이며 기본 브랜치는 `main`입니다. GitHub 업로드와 Vercel 게시는 별도 단계입니다.

## 2. Vercel Import

1. Vercel의 Add New → Project에서 GitHub 저장소를 선택합니다.
2. Framework는 Vite, Root Directory는 `package.json`이 있는 폴더로 지정합니다.
3. Node.js는 24.x를 사용합니다. `vercel.json`의 설치·빌드·출력 설정을 유지합니다.
4. 환경 변수나 서버 기능을 추가할 필요가 없습니다. 배포 미리보기에서 아래 항목을 확인합니다.

## 3. 첫 배포에서 확인

- 첫 화면·새로고침이 정상이고 한국어/English 전환이 유지되는지
- 샘플 파일 불러오기 → 순서 이동 → 회전 → 확대 → 자르기 → PDF 생성 → 미리보기 → 다운로드
- PDF.js 워커, CMap, 표준 글꼴, WASM 파일 요청이 200 응답이고 CSP 오류가 없는지
- 한국어 텍스트 PDF와 JPEG2000/JBIG2 이미지를 사용한 PDF가 정상 표시되는지
- 임시 저장 → 새로고침 → 복구 → 저장본 삭제, 모바일 터치와 좁은 화면
- 개발자 도구 Network에서 사진·PDF 원본 업로드 요청이 없는지. Google Fonts와 같은 정적 파일 요청은 발생합니다.
- 문의 링크가 의도한 메일 앱/주소로 연결되는지

보안 헤더는 `vercel.json`에 있습니다. 워커와 WASM, 이미지 Blob/Data URL, 동적 인라인 스타일, Google Fonts를 허용하고 임의 외부 연결·프레임 삽입은 제한합니다. Vercel에서 헤더를 바꿨다면 PDF 생성과 미리보기를 다시 확인하세요.

## 4. 업데이트

로컬에서 `npm test`와 `npm run build`를 통과시킨 뒤 변경을 push합니다. GitHub Actions의 보안 검사가 실패하면 해당 의존성을 검토하세요. Git 연동 Vercel의 자동 배포와 GitHub 검사 완료 시점은 별개이므로, 검사 통과와 미리보기 확인 후 공개 버전을 정하세요.

## 참고

- [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite)
- [Vercel 프로젝트 설정](https://vercel.com/docs/project-configuration/vercel-json)
- [Vercel Node.js 버전](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
- [PDF.js API](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html)

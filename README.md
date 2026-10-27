# 모아PDF · Moa PDF

사진과 PDF를 모아 원하는 순서와 모양으로 정리하고, 하나의 PDF로 내려받는 브라우저 편집기입니다. 별도 백엔드나 API 키가 필요하지 않습니다.

A browser-based editor for combining photos and PDFs. Arrange, rotate, crop and split pages, then download one PDF. Korean and English are supported.

## 주요 기능

- PNG/JPG/JPEG/PDF 혼합 불러오기와 PDF 낱장 미리보기
- 카드 상단 드래그, 다중 페이지 이동, 정렬, 삽입, 실행 취소/다시 실행
- 회전, 조절점을 이용한 자유 자르기, 실제 이미지 위 분할선 조정
- 돋보기 확대·축소, 너비 맞춤과 화면 이동, 미리보기에서 바로 자르기
- 전체/개별 A4·A3·Letter·원본 크기, 용지 방향·여백·배치·화질·페이지 번호
- Web Worker PDF 생성, 완성된 PDF 확인과 다운로드
- 한국어/영어 전환과 언어 선택 기억
- 사용자가 켠 경우에만 이 기기에 작업 임시 저장·복구·삭제

## 로컬 실행

Node.js **24.x**를 사용합니다. 잠금 파일을 포함해 설치하세요.

```sh
npm ci
npm run dev
```

```sh
npm test
npm run build
npm run preview
```

`dev`와 `build` 전에 PDF.js의 CMap·기본 글꼴·이미지 디코더와 라이선스를 자동으로 준비합니다. 준비된 파일은 Git에 포함하지 않으며, 빌드할 때 설치된 패키지에서 다시 생성합니다.

## Vercel 배포

`package.json`이 저장소 최상위에 오도록 이 폴더의 내용을 GitHub에 올린 뒤 Vercel에서 해당 저장소를 Import합니다.

| 항목 | 설정 |
| --- | --- |
| Framework | Vite |
| Root Directory | `package.json`이 있는 폴더. 이 폴더를 저장소 루트로 올리면 `.` |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Node.js | 24.x |
| 환경 변수·백엔드·DB | 필요 없음 |

설정은 `vercel.json`에 포함되어 있습니다. 현재 `/` 한 화면을 사용하므로 전체 경로를 HTML로 바꾸는 rewrite는 넣지 않았습니다. PDF 보조 파일과 워커가 정상적으로 정적 제공되도록 유지하세요.

[배포 순서와 실제 화면 점검](docs/DEPLOYMENT.md) · [공개 전 점검 결과](docs/RELEASE_CHECKLIST.md)

## 파일과 개인정보

사진·PDF 원본과 편집 내용은 브라우저에서 처리하며 서버로 업로드하지 않습니다. Google Fonts 글꼴을 불러오는 외부 요청은 발생합니다. Vercel은 웹페이지와 정적 파일을 제공하며 호스팅 서비스 자체의 접속 로그 정책은 별도로 적용됩니다. 웹 분석 도구는 앱에 추가하지 않았습니다.

임시 저장을 켜면 원본과 편집 상태를 이 브라우저에 저장합니다. 브라우저 데이터를 지우면 저장본도 삭제됩니다. 임시 저장을 끄면 기존 저장본은 남아 있으며, '저장본 삭제'로 지울 수 있습니다. 임시 저장을 켜지 않으면 창을 닫거나 새로고침할 때 편집 내용이 사라집니다.

## 처리 한도와 지원 범위

- 파일당 40 MiB, 전체 원본 120 MiB, 총 200쪽, 이미지 6천만 화소 이하입니다. 메모리가 적은 기기에서는 한도보다 먼저 처리에 실패할 수 있습니다.
- 삭제한 파일은 실행 취소를 위해 작업을 비우기 전까지 메모리에 남을 수 있습니다.
- 암호화 PDF, OCR, PDF 본문 편집, 목표 파일 크기 보장, 전자서명 유효성 보장은 지원하지 않습니다.
- 기존 PDF는 원본 크기 유지 시 페이지를 복사하며, 크기를 통일할 때도 본문을 벡터로 삽입합니다. 크기 통일 시 링크·주석·양식은 유지되지 않을 수 있습니다.
- 이미지 원본 비율의 물리 크기는 150 DPI 기준입니다. 최상 화질도 회전·자르기 등을 반영할 때 재인코딩할 수 있습니다.
- 최신 Chrome, Edge, Firefox, Safari 등 ES 모듈 워커와 IndexedDB를 지원하는 브라우저가 대상입니다. 모바일 조작과 큰 파일은 별도 실기기 점검이 필요합니다.

## 개발 구조

| 파일 | 역할 |
| --- | --- |
| `src/App.tsx` | 편집 화면과 불러오기·출력 흐름 |
| `src/page-board.tsx` | 드래그, 다중 페이지 이동, 삽입 표시 |
| `src/crop-dialog.tsx`, `src/crop-geometry.ts` | 자유 자르기와 좌표 계산 |
| `src/preview-dialog.tsx`, `src/image-viewport.tsx` | 확대 미리보기와 화면 이동 |
| `src/split-dialog.tsx`, `src/image-edit.ts` | 이미지 분할과 회전 좌표 계산 |
| `src/settings.tsx`, `src/layout.ts` | 출력 설정과 화면/PDF 공통 배치 |
| `src/files.ts`, `src/pdf-export.ts` | 입력 처리와 PDF 출력 |
| `src/workspace-backup.ts`, `src/use-workspace-backup.ts` | 기기 임시 저장 |
| `src/i18n.tsx`, `src/locales/en.json` | 한국어·영어 문구 |
| `scripts/prepare-assets.mjs` | PDF 보조 파일·의존성 라이선스 준비 |

GitHub Actions는 설치·테스트·빌드·의존성 보안 검사를 실행합니다. 현재 자동 테스트는 88개입니다. 실제 브라우저 조작 및 배포 응답 헤더 검증은 [점검표](docs/RELEASE_CHECKLIST.md)를 참고하세요.

문의·피드백: [min85296@gmail.com](mailto:min85296@gmail.com)

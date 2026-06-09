# GitHub Pages 배포 방법

이 웹앱은 GitHub Pages에서 바로 배포할 수 있도록 `docs/` 폴더에 정적 빌드 결과가 들어가 있습니다.

## 현재 구조

- `docs/`: GitHub Pages가 서비스할 완성된 웹사이트
- `web-src/`: React/Vite 원본 소스
- `LaTeXVibeCoder.exe`: Windows 데스크톱 앱
- `src/app.py`: 데스크톱 앱 Python 소스

## 업로드 순서

1. GitHub에서 새 저장소를 만듭니다.
   예: `latex-vibe-coder`

2. 이 폴더에서 아래 명령을 실행합니다.

```powershell
git init
git branch -M main
git add .
git commit -m "Create LaTeX Vibe Coder web app"
git remote add origin https://github.com/YOUR_USERNAME/latex-vibe-coder.git
git push -u origin main
```

3. GitHub 저장소 페이지에서 `Settings > Pages`로 이동합니다.

4. `Build and deployment` 설정을 아래처럼 바꿉니다.

```text
Source: Deploy from a branch
Branch: main
Folder: /docs
```

5. 저장하면 보통 몇 분 뒤 아래 주소로 열립니다.

```text
https://YOUR_USERNAME.github.io/latex-vibe-coder/
```

## 웹앱 수정 후 다시 빌드

`web-src/`에서 수정한 뒤:

```powershell
cd web-src
npm install
npm run build
```

빌드 결과는 `web-src/docs/`에 생기므로, 그 내용을 저장소 루트의 `docs/`로 복사한 뒤 커밋하면 됩니다.


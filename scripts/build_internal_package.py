import shutil
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "release"
STAGE = OUT / "promotion-radar-internal"

def main():
    if not (ROOT / "dist" / "index.html").exists():
        raise SystemExit("Run pnpm build first.")
    shutil.rmtree(STAGE, ignore_errors=True)
    OUT.mkdir(exist_ok=True)
    shutil.copytree(ROOT / "dist", STAGE / "site")
    for name in ("src", "scripts", "config", "tests", "학습용", ".github"):
        shutil.copytree(ROOT / name, STAGE / name)
    for name in ("README.md", "package.json", "pnpm-lock.yaml", "requirements.txt", "vite.config.js"):
        shutil.copy2(ROOT / name, STAGE / name)
    (STAGE / "사내_이전_가이드.md").write_text("""# 사내 GitHub 이전

1. 이 폴더 전체를 사내 GitHub 저장소에 업로드합니다.
2. Node.js 22 설치 후 `pnpm install --frozen-lockfile`, `pnpm build`를 실행합니다.
3. 생성된 `dist/`를 사내 GitHub Pages 또는 정적 웹 서버의 배포 폴더로 지정합니다.
4. 단순 검토는 `site/` 폴더를 사내 정적 서버에 올리면 현재 데이터와 스크린샷까지 표시됩니다.
5. 자동 수집은 GitHub Actions가 허용될 때 `.github/workflows`를 별도로 복사하고 미국 Runner 정책을 확인합니다.
""", encoding="utf-8")
    archive = OUT / "promotion-radar-internal.zip"
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as zf:
        for path in STAGE.rglob("*"):
            if path.is_file(): zf.write(path, path.relative_to(STAGE))
    print(archive)

if __name__ == "__main__": main()

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
    for name in ("src", "scripts", "config", "tests", "학습용", ".github", "public"):
        shutil.copytree(ROOT / name, STAGE / name)
    for name in ("README.md", "index.html", "package.json", "pnpm-lock.yaml", "requirements.txt", "vite.config.js"):
        shutil.copy2(ROOT / name, STAGE / name)
    (STAGE / "사내_이전_가이드.md").write_text("""# 사내 GitHub 이전

## 가장 빠른 게시

`site/` 전체를 사내 정적 웹 서버 또는 사내 GitHub Pages 배포 artifact로 올립니다.
이 방식은 Node/Python 없이 현재 스냅샷을 그대로 조회합니다.

## 사내 GitHub에서 재빌드

1. 압축을 풀고 전체 파일을 사내 저장소에 업로드합니다.
2. Node.js 22와 pnpm을 준비합니다.
3. `pnpm install --frozen-lockfile` 후 `pnpm build`를 실행합니다.
4. 생성된 `dist/`를 사내 Pages 또는 정적 웹 서버에 배포합니다.

## 자동 수집

1. GitHub Actions와 미국 hosted runner 사용 가능 여부를 사내 정책에서 확인합니다.
2. Python 3.12 및 Playwright Chromium 설치가 허용되어야 합니다.
3. `.github/workflows/collect-verizon.yml`은 공개 Verizon URL만 수집하며 사내 데이터는 전송하지 않습니다.
4. 매일 Quick Scan은 headline/가격/hash 변경을 확인하고, Weekly Full Scenario는 PDP의 용량·고객유형·요금제·Trade-in 상태를 검증하는 형태를 권장합니다.
5. 실패 결과는 마지막 verified 결과를 덮어쓰지 않고 `incomplete/failed`로 격리합니다.
6. workflow의 `contents: write`, Pages 배포 권한과 branch protection 예외를 확인합니다.

## Evidence 판정

- `Pending`: 동일 구매조건 검증 전이며 클릭할 수 없습니다.
- `Matched`: 모델·요금제·월 가격·scenarioId가 모두 일치합니다.
- `public/scenario-evidence/`에는 단계별 롱샷이, `public/data/scenario-results.json`에는 requested/observed/verified 상태가 저장됩니다.

## 운영 주의사항

- 로컬 PC가 꺼져도 사내 Pages와 Actions는 계속 작동합니다.
- Verizon DOM 변경 시 `src/vzw_promo_tracker/scenario_runner.py`의 단계별 selector adapter를 수정합니다.
- 스크린샷 증가량이 커지면 사내 Object Storage에 최신 Evidence를 저장하고 Git에는 JSON 경로만 관리하는 방식으로 전환합니다.
""", encoding="utf-8")
    archive = OUT / "promotion-radar-internal.zip"
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as zf:
        for path in STAGE.rglob("*"):
            if path.is_file(): zf.write(path, path.relative_to(STAGE))
    print(archive)

if __name__ == "__main__": main()

import csv
import json
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
DATA = PUBLIC / "data"
DOWNLOADS = PUBLIC / "downloads"

def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))

def flatten_offer(offer, snapshot_date):
    tiers = offer.get("tierLadder") or {}
    return {
        "snapshot_date": snapshot_date, "brand": offer.get("brand"), "model": offer.get("model"),
        "mechanic": offer.get("mechanic"), "retail_usd": offer.get("retail"), "credit_usd": offer.get("credit"),
        "monthly_high_usd": tiers.get("high"), "monthly_mid_usd": tiers.get("mid"), "monthly_low_usd": tiers.get("low"),
        "on_us_high": tiers.get("high") == 0, "on_us_mid": tiers.get("mid") == 0, "on_us_low": tiers.get("low") == 0,
        "plan": offer.get("plan"), "line_action": offer.get("lineAction"), "trade_in_required": offer.get("tradeIn"),
        "any_condition": offer.get("anyCondition"), "tiv": offer.get("tiv"), "term_months": offer.get("term"),
        "headline": offer.get("headline"), "source_url": offer.get("source"), "confidence": offer.get("confidence"),
    }

def main():
    DOWNLOADS.mkdir(parents=True, exist_ok=True)
    snapshot = read_json(DATA / "snapshot.json")
    rows = [flatten_offer(offer, snapshot["meta"]["snapshotDate"]) for offer in snapshot["promotions"]]
    csv_path = DOWNLOADS / "verizon-promotions-latest.csv"
    with csv_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
    guide = """VERIZON PROMOTION EVIDENCE PACK

Live verification from Korea
1. Open source_url on a company-approved US VPN or US VDI/remote browser.
2. Use ZIP 10001 and preserve the same customer and line-action state.
3. Compare the displayed headline and terms with snapshot.json and the normalized CSV.
4. Match collection-status.json by URL, fetched_at, HTTP status and SHA-256.

한국에서 실시간 검증
1. 회사가 승인한 미국 VPN 또는 미국 VDI/원격 브라우저에서 source_url을 엽니다.
2. ZIP 10001 및 신규/기존 고객, 신규회선/업그레이드 상태를 동일하게 유지합니다.
3. 표시된 headline과 terms를 snapshot.json 및 CSV와 비교합니다.
4. collection-status.json의 URL, 수집시각, HTTP 상태, SHA-256을 확인합니다.

This package contains normalized public-page evidence, not a bypass or a full copy of Verizon HTML.
Unknown free proxy extensions are not recommended for a corporate device.
"""
    guide_path = DOWNLOADS / "verification-guide.txt"
    guide_path.write_text(guide, encoding="utf-8")
    pack_path = DOWNLOADS / "vzw-evidence-pack-latest.zip"
    members = [(DATA / "snapshot.json", "snapshot.json"), (DATA / "collection-status.json", "collection-status.json"),
               (DATA / "grid-offers.json", "grid-offers.json"),
               (DATA / "history.json", "history.json"), (ROOT / "config" / "scenarios.json", "scenarios.json"),
               (csv_path, csv_path.name), (guide_path, guide_path.name)]
    with zipfile.ZipFile(pack_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for source, name in members:
            archive.write(source, name)
    print(f"Built {pack_path} with {len(rows)} offers")

if __name__ == "__main__":
    main()

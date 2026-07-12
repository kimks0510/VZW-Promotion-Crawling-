# Verizon US Smartphone Promotions Snapshot

Snapshot date: 2026-06-21  
Scope: Public Verizon US smartphone promotions for Apple, Samsung, and Google.  
Important caveat: local crawler access from the current Korea network still receives Verizon `417` errors for several consumer smartphone pages, so this first snapshot combines official indexed Verizon text, Verizon Business text, Verizon-authorized retailer terms, and media corroboration. Rows needing direct live Verizon validation are flagged in the CSV.

## Executive Readout

| Manufacturer | Most aggressive headline found | Main condition | PM note |
|---|---:|---|---|
| Apple | Up to $1,000 off iPhone 17 Pro/Pro Max; iPhone 17e free | New unlimited line; Ultimate for premium Pro promo; no trade-in indicated by media | Apple has broad “free / bundle” messaging, including watch and iPad bundle language that needs expiry recheck. |
| Samsung | Galaxy S26 Ultra up to $1,300 off; S26+ up to $1,100 off | New line; S26 Ultra requires Unlimited Ultimate and port-in per retailer terms | Samsung appears to have the highest single-device headline credit, but port-in and tier requirements matter. |
| Google | Pixel 10 Pro up to $1,000 off; Pixel 10 Pro Fold up to $1,079.99 off | Many rows allow new or upgrade lines; several no-trade offers | Google is highly competitive because eligibility looks broad across Unlimited tiers for some Pro/Fold offers. |
| Mixed acquisition | Switch and get 4 phones for $0; 4 lines for $25/line | 4 new lines on Unlimited Welcome with Auto Pay; select models | Family switcher offer is likely the key funnel promo, not just device-specific headline credit. |

## CSV Output

Primary table: `exports/current_verizon_promotions_2026-06-21.csv`

## JSON Output

Structured version: `exports/current_verizon_promotions_2026-06-21.json`

## Source Notes

- Verizon indexed smartphone deals page showed “Switch and get 4 phones for $0” and an iPhone 17 + Watch + iPad bundle, but the bundle line showed “Ends 6/17,” so it is tagged as expired/needs recheck.
- Victra, a Verizon-authorized retailer, exposed detailed device-level terms including 36-month promo credits, plan requirements, port-in requirements, and no-trade wording.
- Verizon Business official page exposed B2B trade-in credit ceilings by device family; this is included separately because it should not be blended with consumer offers without an explicit business-market scope.
- TechRadar and Tom’s Guide were used only as corroborating current-market references where direct Verizon consumer pages were blocked locally.


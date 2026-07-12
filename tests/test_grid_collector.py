import unittest

from vzw_promo_tracker.grid_collector import parse_api_offers, parse_card, parse_detail_url


class GridCollectorTests(unittest.TestCase):
    def test_parses_motorola_card(self):
        offer = parse_card(
            "Motorola razr 2026 Starts at $0/mo $22.22/mo Details for 36 months, 0% APR Retail price: $799.99 Save $800."
        )
        self.assertEqual(offer.brand, "Motorola")
        self.assertEqual(offer.advertised_monthly, 0)
        self.assertEqual(offer.regular_monthly, 22.22)
        self.assertEqual(offer.retail_price, 799.99)

    def test_parses_detail_identifiers(self):
        params = parse_detail_url(
            "https://www.verizon.com/us/promotion/details?promoId=p1&deviceId=d1&skuId=s1&flow=NSE&loanTerm=36"
        )
        self.assertEqual(params["promoId"], "p1")
        self.assertEqual(params["loanTerm"], "36")

    def test_parses_official_api_promotion(self):
        payload = {"productListById": {"dev1": {
            "displayName": "Samsung Galaxy S26 Ultra", "brandName": "Samsung", "isSmartPhone": True,
            "canonicalUrl": "/smartphones/samsung-galaxy-s26-ultra/",
            "price": {"FRP": {"originalPrice": "1299.99"}, "DPP": {
                "originalPrice": "36.11", "contractTerm": 36,
                "promotion": {"price": {"allPromotions": [{
                    "promotionId": "promo1", "discountedPrice": 5, "originalPrice": 36.11,
                    "discAmount": 1119.99, "lineRequired": "New line req'd.",
                    "planReqmt": "Unlimited Ultimate plan required.",
                    "promoBadgeMessages": [{"badgeText": "Save $1,119.99.", "badgeToolTipUrl": "/us/promotion/details?promoId=promo1&deviceId=dev1&skuId=sku1&flow=NSE&loanTerm=36"}]
                }]}}
            }}
        }}}
        offer = parse_api_offers(payload)[0]
        self.assertEqual(offer.advertised_monthly, 5)
        self.assertEqual(offer.detail_params["skuId"], "sku1")
        self.assertIn("Unlimited Ultimate", offer.detail_text)


if __name__ == "__main__":
    unittest.main()

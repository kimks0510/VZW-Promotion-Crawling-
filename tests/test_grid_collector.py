import unittest

from vzw_promo_tracker.grid_collector import parse_card, parse_detail_url


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


if __name__ == "__main__":
    unittest.main()

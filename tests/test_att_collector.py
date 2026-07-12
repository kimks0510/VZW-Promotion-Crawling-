import unittest

from vzw_promo_tracker.att_collector import parse_card_text


class AttCollectorTests(unittest.TestCase):
    def test_trade_in_card(self):
        offer = parse_card_text(
            "Apple iPhone 17 Pro Price was $30.56 per month, now As low as $0.00 per month "
            "with eligible trade-in. Req's elig. unlimited & trade-in. Price after 36 mo. credits. See offer details",
            "Apple", "https://www.att.com/buy/phones/browse/apple/",
        )
        self.assertEqual(offer["monthly"], 0)
        self.assertEqual(offer["mechanic"], "Trade-in")
        self.assertEqual(offer["credit"], 1100.16)

    def test_no_trade_card(self):
        offer = parse_card_text(
            "New lines only. No trade-in Samsung Galaxy S26 Price was $25.00 per month, now $4.99 per month "
            "Req's new line and eligible unlimited service. See offer details",
            "Samsung", "https://www.att.com/buy/phones/browse/samsung/",
        )
        self.assertEqual(offer["mechanic"], "EIP")
        self.assertEqual(offer["lineAction"], "New line")


if __name__ == "__main__":
    unittest.main()

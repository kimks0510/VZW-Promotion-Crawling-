import unittest

from vzw_promo_tracker.att_collector import apply_detail_terms, parse_card_text


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

    def test_detail_terms_map_current_att_plan_tiers(self):
        offer = parse_card_text(
            "Google Pixel 10 Pro Price was $29.17 per month, now $0.00 per month "
            "with eligible trade-in. See offer details",
            "Google", "https://www.att.com/buy/phones/browse/google/",
        )
        apply_detail_terms(
            offer,
            "New customers must activate and maintain AT&T Extra 2.0 or higher. "
            "Customers on AT&T Value 2.0 plan are eligible for max credit of up to $500. "
            "Any Pixel smartphone, any year, in any condition, with minimum Trade-In value of $35.",
        )
        self.assertEqual(offer["tierLadder"]["high"], 0)
        self.assertEqual(offer["tierLadder"]["mid"], 0)
        self.assertEqual(offer["tierLadder"]["low"], 15.28)
        self.assertEqual(offer["internalShorthand"], "free / free / $15.28")
        self.assertEqual(offer["tiv"], "$35")
        self.assertTrue(offer["anyCondition"])

    def test_three_distinct_credits_map_to_three_tiers(self):
        offer = parse_card_text(
            "Samsung Galaxy Z Fold8 Ultra Price was $58.33 per month, now $5.55 per month "
            "with eligible trade-in. See offer details",
            "Samsung", "https://www.att.com/buy/phones/browse/samsung/",
        )
        apply_detail_terms(
            offer,
            "Up to $1,900 off Galaxy Z Fold8 Ultra with activation on AT&T Premium 2.0 plan or higher "
            "and trade-in an eligible smartphone. Up to $1,000 off Galaxy Z Fold8 Ultra with activation "
            "on AT&T Extra 2.0 plan or higher and trade-in an eligible smartphone. Up to $500 off Galaxy "
            "Z Fold8 Ultra with activation on AT&T Value 2.0 plan or higher and trade-in an eligible "
            "smartphone.",
        )
        # Each tier keeps its own stated credit rather than all collapsing to
        # the card's advertised (Premium-tier) price.
        self.assertEqual(offer["tierLadder"]["high"], round((offer["retail"] - 1900) / 36, 2))
        self.assertEqual(offer["tierLadder"]["mid"], round((offer["retail"] - 1000) / 36, 2))
        self.assertEqual(offer["tierLadder"]["low"], round((offer["retail"] - 500) / 36, 2))

    def test_explicit_any_condition_exclusion_is_not_ac(self):
        offer = parse_card_text(
            "Google Pixel 10 Pro XL Price was $34.72 per month, now $0.00 per month "
            "with eligible trade-in. See offer details",
            "Google", "https://www.att.com/buy/phones/browse/google/",
        )
        offer["credit"] = 1250
        apply_detail_terms(
            offer,
            "Any year, in any condition does not apply to this $1,250 credit. "
            "A minimum trade-in value of $200 is required.",
        )
        self.assertFalse(offer["anyCondition"])
        self.assertEqual(offer["tiv"], "$200")


if __name__ == "__main__":
    unittest.main()

import unittest

from vzw_promo_tracker.tmobile_collector import parse_offer_detail, qualifying_tiers


class TmobileCollectorTests(unittest.TestCase):
    def test_qualifying_tiers_named_explicitly(self):
        text = (
            "Other qualifying plans: The following plans also qualify: "
            "Most voice plans, e.g., Essentials, Experience More, Experience Beyond: At least 1 new line. "
            "Better Value: - New members: 3+ new lines with 2 eligible port-ins. "
            "Go5G Next and Go5G Plus plans (Existing members only): At least 1 new line."
        )
        self.assertEqual(qualifying_tiers(text), {"low", "mid", "high"})

    def test_qualifying_tiers_defaults_to_none_named(self):
        text = "Qualifying credit, service ($85+/mo. plan w/AutoPay; plus taxes/fees) required."
        self.assertEqual(qualifying_tiers(text), set())

    def test_parse_offer_detail_builds_tier_ladder_from_named_plans(self):
        headline = "Pixel 10 On Us."
        detail_text = (
            "Pixel 10 On Us. No trade-in needed. Qualifying Plans: Essentials, Experience More or "
            "Experience Beyond (New & Existing members): 1 new line. Better Value: 3+ new lines with "
            "2 eligible port-ins. Go5G Plus and Go5G Next (Existing members only): 1 new line. "
            "Contact us before cancelling entire account to continue remaining bill credits, or credits "
            "stop & balance on required finance agreement is due (e.g., $799.99 - Google Pixel 10 128GB). "
            "Qualifying credit, add a new line, & service ($60+/mo. plan w/AutoPay; plus taxes/fees) "
            "required. Up to $800 via bill credits; allow 2 bill cycles."
        )
        offer = parse_offer_detail(headline, detail_text, "Google", "https://www.t-mobile.com/offers/google-phone-deals")
        self.assertIsNotNone(offer)
        self.assertEqual(offer["model"], "Pixel 10")
        # All three named tiers share the one advertised price in this offer.
        self.assertEqual(offer["tierLadder"]["high"], offer["tierLadder"]["mid"])
        self.assertEqual(offer["tierLadder"]["high"], offer["tierLadder"]["low"])
        self.assertIsNotNone(offer["tierLadder"]["low"])

    def test_parse_offer_detail_leaves_unnamed_tiers_unverified(self):
        headline = "iPhone 17 Pro On Us."
        detail_text = (
            "iPhone 17 Pro On Us. No trade-in needed. Contact us before cancelling entire account to "
            "continue remaining bill credits, or credits stop & balance on required finance agreement "
            "is due (e.g. $829.99 - iPhone 17 256GB). Qualifying credit, service ($85+/mo. plan "
            "w/AutoPay; plus taxes & fees) required. Up to $830 via bill credits; allow 2 bill cycles."
        )
        offer = parse_offer_detail(headline, detail_text, "Apple", "https://www.t-mobile.com/offers/apple-iphone-deals")
        self.assertIsNotNone(offer)
        self.assertIsNotNone(offer["tierLadder"]["high"])
        self.assertIsNone(offer["tierLadder"]["mid"])
        self.assertIsNone(offer["tierLadder"]["low"])


if __name__ == "__main__":
    unittest.main()

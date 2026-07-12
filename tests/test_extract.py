import unittest

from vzw_promo_tracker.extract import extract_candidates


class PromotionExtractionTests(unittest.TestCase):
    def test_trade_in_context_window_captures_ac_and_tiv(self):
        text = (
            "iPhone 17 Pro on us with eligible trade-in. "
            "Any condition guaranteed. Unlimited Ultimate. "
            "Trade-in value of $100."
        )

        candidate = extract_candidates(text)[0]

        self.assertEqual(candidate.promotion_mechanic, "Trade-in")
        self.assertTrue(candidate.any_condition)
        self.assertEqual(candidate.tiv_usd, 100)

    def test_byod_is_a_separate_mechanic(self):
        candidate = extract_candidates(
            "Bring your own phone and save $10 per month on Unlimited Plus."
        )[0]

        self.assertEqual(candidate.promotion_mechanic, "BYOD+")
        self.assertFalse(candidate.any_condition)


if __name__ == "__main__":
    unittest.main()

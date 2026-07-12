import unittest
from vzw_promo_tracker.scenario_runner import scenario_id

class ScenarioTests(unittest.TestCase):
    def test_id_changes_when_plan_changes(self):
        product = {"url":"https://example.com/pdp"}
        high = scenario_id(product, {"plan":"Unlimited Ultimate","storage":"256 GB"})
        low = scenario_id(product, {"plan":"Unlimited Welcome","storage":"256 GB"})
        self.assertNotEqual(high, low)

    def test_id_is_stable_for_key_order(self):
        product = {"url":"https://example.com/pdp"}
        self.assertEqual(scenario_id(product, {"plan":"A","storage":"B"}), scenario_id(product, {"storage":"B","plan":"A"}))

if __name__ == "__main__": unittest.main()

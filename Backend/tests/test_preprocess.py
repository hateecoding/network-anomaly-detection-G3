import sys
from pathlib import Path
import unittest

import pandas as pd

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from services.classification import get_display_category
from services.preprocess import prepare_batch_input


class ClassificationTests(unittest.TestCase):
    def test_review_is_display_category_not_model_class(self):
        self.assertEqual(get_display_category("normal", 0.1), "normal")
        self.assertEqual(
            get_display_category("normal", 0.45),
            "review_recommended",
        )
        self.assertEqual(get_display_category("attack", 0.9), "attack")


class PreprocessValidationTests(unittest.TestCase):
    def test_supported_aliases_align_to_feature_columns(self):
        frame = pd.DataFrame(
            [
                {
                    "duration": 1,
                    "src_bytes": 10,
                    "dst_bytes": 20,
                    "count": 4,
                    "srv_count": 2,
                    "dst_host_count": 4,
                    "dst_host_srv_count": 2,
                    "protocol_type": "tcp",
                    "service": "http",
                    "flag": "sf",
                }
            ]
        )

        processed, context = prepare_batch_input(frame)

        self.assertEqual(processed.shape, (1, 67))
        self.assertEqual(context.iloc[0]["total_bytes"], 30)

    def test_missing_required_fields_are_rejected(self):
        with self.assertRaisesRegex(ValueError, "missing required traffic fields"):
            prepare_batch_input(pd.DataFrame([{"duration": 1, "src_bytes": 10}]))

    def test_invalid_numeric_rows_are_rejected(self):
        frame = pd.DataFrame(
            [
                {
                    "duration": "invalid",
                    "src_bytes": 10,
                    "dst_bytes": 20,
                    "count": 4,
                    "srv_count": 2,
                    "dst_host_count": 4,
                    "dst_host_srv_count": 2,
                    "protocol_type": "tcp",
                    "service": "http",
                    "flag": "sf",
                }
            ]
        )

        with self.assertRaisesRegex(ValueError, "duration must be numeric"):
            prepare_batch_input(frame)


if __name__ == "__main__":
    unittest.main()

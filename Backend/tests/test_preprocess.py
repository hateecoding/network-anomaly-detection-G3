import re
import sys
from pathlib import Path
import unittest

import pandas as pd

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from services.classification import get_display_category
from services.preprocess import (
    LABEL_MAPPING_FILE_ERROR,
    get_preprocessing_status,
    prepare_batch_input,
)


class ClassificationTests(unittest.TestCase):
    def test_review_is_display_category_not_model_class(self):
        self.assertEqual(get_display_category("normal", 0.1), "normal")
        self.assertEqual(
            get_display_category("normal", 0.45),
            "review_recommended",
        )
        self.assertEqual(get_display_category("attack", 0.9), "attack")


class PreprocessValidationTests(unittest.TestCase):
    def test_fitted_preprocessing_artifact_is_active(self):
        status = get_preprocessing_status()

        self.assertEqual(status.mode, "fitted_pipeline")
        self.assertEqual(status.artifact, "preprocessing_pipeline.json")
        self.assertIsNone(status.warning)

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

    def test_simple_kdd_schema_derives_destination_host_fields(self):
        frame = pd.DataFrame(
            [
                {
                    "duration": 0,
                    "protocol_type": "tcp",
                    "service": "http",
                    "flag": "SF",
                    "src_bytes": 232,
                    "dst_bytes": 8153,
                    "count": 5,
                    "srv_count": 5,
                    "serror_rate": 0.2,
                    "label": "normal",
                }
            ]
        )

        processed, context = prepare_batch_input(frame)

        self.assertEqual(processed.shape, (1, 67))
        self.assertEqual(context.iloc[0]["activity_count"], 5)
        self.assertEqual(context.iloc[0]["service_count"], 5)
        self.assertEqual(context.iloc[0]["destination_host_count"], 5)
        self.assertEqual(context.iloc[0]["destination_host_service_count"], 5)
        self.assertEqual(context.iloc[0]["same_service_rate"], 1.0)

    def test_simple_kdd_schema_allows_blank_numeric_cells(self):
        frame = pd.DataFrame(
            [
                {
                    "duration": "",
                    "protocol_type": "tcp",
                    "service": "private",
                    "flag": "S0",
                    "src_bytes": "",
                    "dst_bytes": 0,
                    "count": "",
                    "srv_count": 6,
                    "serror_rate": 1.0,
                    "label": "neptune",
                }
            ]
        )

        processed, context = prepare_batch_input(frame)

        self.assertEqual(processed.shape, (1, 67))
        self.assertEqual(context.iloc[0]["duration"], 0)
        self.assertEqual(context.iloc[0]["src_bytes"], 0)
        self.assertEqual(context.iloc[0]["activity_count"], 0)

    def test_missing_required_fields_are_rejected(self):
        with self.assertRaisesRegex(ValueError, "missing required traffic fields"):
            prepare_batch_input(pd.DataFrame([{"duration": 1, "src_bytes": 10}]))

    def test_label_category_mapping_file_is_rejected_with_specific_message(self):
        frame = pd.DataFrame(
            [
                {"label": "back", "category": "DoS"},
                {"label": "normal", "category": "Normal"},
            ]
        )

        with self.assertRaisesRegex(ValueError, re.escape(LABEL_MAPPING_FILE_ERROR)):
            prepare_batch_input(frame)

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

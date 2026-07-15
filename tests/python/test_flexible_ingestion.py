from __future__ import annotations

import json
import random
import tempfile
import unittest
from pathlib import Path

import pandas as pd

from src.elt.pipeline import run_pipeline
from src.elt.transform import clean_numeric_value, resolve_canonical_field


CORE = {
    "total_assets": 10_000_000,
    "current_assets": 4_000_000,
    "cash": 1_000_000,
    "inventory": 800_000,
    "accounts_receivable": 1_200_000,
    "total_liabilities": 6_000_000,
    "current_liabilities": 2_000_000,
    "short_term_debt": 1_000_000,
    "long_term_debt": 3_000_000,
    "equity": 4_000_000,
    "revenue": 12_000_000,
    "cost_of_goods_sold": 7_000_000,
    "gross_profit": 5_000_000,
    "operating_expenses": 3_000_000,
    "operating_income": 2_000_000,
    "net_income": 1_400_000,
    "interest_expense": 300_000,
    "zakat_tax": 300_000,
    "operating_cash_flow": 2_000_000,
    "investing_cash_flow": -800_000,
    "financing_cash_flow": -500_000,
    "net_cash_flow": 700_000,
    "ending_cash_balance": 1_000_000,
}

ARABIC = {
    "total_assets": "إجمالي الموجودات",
    "current_assets": "الأصول المتداولة",
    "cash": "النقد وما في حكمه",
    "inventory": "المخزون",
    "accounts_receivable": "الذمم التجارية المدينة",
    "total_liabilities": "إجمالي الالتزامات",
    "current_liabilities": "الالتزامات المتداولة",
    "short_term_debt": "القروض قصيرة الأجل",
    "long_term_debt": "القروض طويلة الأجل",
    "equity": "حقوق المساهمين",
    "revenue": "صافي المبيعات",
    "cost_of_goods_sold": "تكلفة البضاعة المباعة",
    "gross_profit": "مجمل الربح",
    "operating_expenses": "المصروفات التشغيلية",
    "operating_income": "الربح التشغيلي",
    "net_income": "صافي الدخل",
    "interest_expense": "تكاليف التمويل",
    "zakat_tax": "الزكاة والضريبة",
    "operating_cash_flow": "صافي النقد من الأنشطة التشغيلية",
    "investing_cash_flow": "صافي النقد من الأنشطة الاستثمارية",
    "financing_cash_flow": "صافي النقد من الأنشطة التمويلية",
    "net_cash_flow": "صافي التغير في النقد",
    "ending_cash_balance": "النقد في نهاية الفترة",
}


def arabic_digits(value: int) -> str:
    text = f"{abs(value):,}".translate(str.maketrans("0123456789,", "٠١٢٣٤٥٦٧٨٩٬"))
    return f"({text})" if value < 0 else f"ر.س {text}"


class FlexibleIngestionTests(unittest.TestCase):
    def test_alias_and_arabic_numeric_normalization(self):
        self.assertEqual(resolve_canonical_field("إجمالي الأصول (ريال سعودي) 2025"), "total_assets")
        self.assertEqual(resolve_canonical_field("TOTAL ASSETS - SAR"), "total_assets")
        self.assertEqual(clean_numeric_value("ر.س ١٬٢٣٤٫٥"), 1234.5)
        self.assertEqual(clean_numeric_value("(٥٠٠٬٠٠٠)"), -500000)
        self.assertEqual(clean_numeric_value("1.2M"), 1_200_000)

    def test_shuffled_horizontal_csv_with_header_not_first_row(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "shuffled.csv"
            keys = list(CORE)
            random.Random(7).shuffle(keys)
            rows = [
                ["Financial statement upload"],
                ["Amounts in SAR"],
                keys,
                [CORE[key] for key in keys],
            ]
            width = len(keys)
            padded = [row + [None] * (width - len(row)) for row in rows]
            pd.DataFrame(padded).to_csv(path, index=False, header=False)

            result = run_pipeline(str(path))
            self.assertIn(result["status"], {"valid", "valid_with_warnings"})
            self.assertEqual(result["validation"]["present_fields"], 23)
            self.assertEqual(result["cleaned_data"]["total_assets"], 10_000_000)
            self.assertAlmostEqual(result["metrics"]["current_ratio"], 2.0)
            self.assertAlmostEqual(result["metrics"]["debt_ratio"], 0.6)
            self.assertAlmostEqual(result["metrics"]["net_profit_margin"], 1_400_000 / 12_000_000, places=4)

    def test_arabic_vertical_excel_arbitrary_sheet_names_and_columns(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "arabic.xlsx"
            groups = [
                list(CORE.items())[:10],
                list(CORE.items())[10:18],
                list(CORE.items())[18:],
            ]
            with pd.ExcelWriter(path, engine="openpyxl") as writer:
                for index, group in enumerate(groups):
                    rows = [["تقرير مالي", None, None], ["ملاحظات", "القيمة", "اسم الحساب"]]
                    shuffled = list(group)
                    random.Random(index + 11).shuffle(shuffled)
                    for key, value in shuffled:
                        rows.append(["مدقق", arabic_digits(value), ARABIC[key]])
                    pd.DataFrame(rows).to_excel(
                        writer,
                        sheet_name=["بيانات أ", "كشف ب", "التدفقات النهائية"][index],
                        index=False,
                        header=False,
                    )

            result = run_pipeline(str(path))
            self.assertIn(result["status"], {"valid", "valid_with_warnings"})
            self.assertEqual(result["validation"]["coverage"], 1.0)
            self.assertEqual(result["cleaned_data"]["investing_cash_flow"], -800_000)
            self.assertIn("label_value", result["extraction"]["methods"])
            self.assertEqual(set(result["extraction"]["used_sheets"]), {"بيانات أ", "كشف ب", "التدفقات النهائية"})

    def test_vertical_multi_period_uses_latest_complete_period(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "periods.xlsx"
            rows = [["البند", "2024", "2025"]]
            for key, value in CORE.items():
                rows.append([key, value * 0.8, value])
            pd.DataFrame(rows).to_excel(path, index=False, header=False, sheet_name="أي اسم")

            result = run_pipeline(str(path))
            self.assertIn(result["status"], {"valid", "valid_with_warnings"})
            self.assertEqual(result["cleaned_data"]["revenue"], 12_000_000)
            self.assertEqual(result["cleaned_data"]["total_assets"], 10_000_000)

    def test_horizontal_multi_period_uses_latest_row(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "period_rows.xlsx"
            keys = list(CORE)
            rows = [["year", *keys], [2024, *[CORE[k] * 0.8 for k in keys]], [2025, *[CORE[k] for k in keys]]]
            pd.DataFrame(rows).to_excel(path, index=False, header=False)

            result = run_pipeline(str(path))
            self.assertIn(result["status"], {"valid", "valid_with_warnings"})
            self.assertEqual(result["cleaned_data"]["revenue"], 12_000_000)

    def test_missing_required_field_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "missing.csv"
            incomplete = dict(CORE)
            incomplete.pop("revenue")
            pd.DataFrame([incomplete]).to_csv(path, index=False)

            result = run_pipeline(str(path))
            self.assertEqual(result["status"], "invalid")
            self.assertIn("revenue", result["validation"]["missing_fields"])
            self.assertEqual(result["metrics"], {})

    def test_non_numeric_required_value_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "invalid_value.csv"
            values = dict(CORE)
            values["revenue"] = "غير معروف"
            pd.DataFrame([values]).to_csv(path, index=False)

            result = run_pipeline(str(path))
            self.assertEqual(result["status"], "invalid")
            self.assertIn("revenue", result["validation"]["missing_fields"])

    def test_supplemental_fields_enable_dscr_and_altman(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "banking.csv"
            values = {
                **CORE,
                "retained_earnings": 1_000_000,
                "cfads": 1_800_000,
                "maintenance_capex": 100_000,
                "scheduled_principal": 700_000,
                "scheduled_interest": 200_000,
                "mandatory_debt_fees": 50_000,
                "finance_lease_payments": 50_000,
            }
            keys = list(values)
            random.Random(21).shuffle(keys)
            pd.DataFrame([[values[key] for key in keys]], columns=keys).to_csv(path, index=False)

            result = run_pipeline(str(path))
            self.assertIn(result["status"], {"valid", "valid_with_warnings"})
            self.assertAlmostEqual(result["metrics"]["dscr"], 1.8)
            self.assertEqual(result["metrics"]["altman_model"], "private_full")
            self.assertIsNotNone(result["metrics"]["altman_z_score"])


if __name__ == "__main__":
    unittest.main()

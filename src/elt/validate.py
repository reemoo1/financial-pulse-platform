# src/elt/validate.py
from __future__ import annotations
import pandas as pd

# =========================
# الحقول المطلوبة
# =========================

BALANCE_FIELDS = {
    "total_assets",
    "current_assets",
    "cash",
    "inventory",
    "accounts_receivable",
    "total_liabilities",
    "current_liabilities",
    "short_term_debt",
    "long_term_debt",
    "equity",
}

INCOME_FIELDS = {
    "revenue",
    "cost_of_goods_sold",
    "gross_profit",
    "operating_expenses",
    "operating_income",
    "net_income",
    "interest_expense",
    "zakat_tax",
}

CASHFLOW_FIELDS = {
    "operating_cash_flow",
    "investing_cash_flow",
    "financing_cash_flow",
    "net_cash_flow",
    "ending_cash_balance",
}

REQUIRED_FIELDS = BALANCE_FIELDS | INCOME_FIELDS | CASHFLOW_FIELDS


# =========================
# Helpers
# =========================

def _non_null_count(df: pd.DataFrame, cols: set[str]) -> int:
    """كم حقل من هذي المجموعة موجود وله قيمة؟"""
    available = [c for c in cols if c in df.columns]
    if not available:
        return 0
    return int(df[available].notna().any().sum())


def _get_value(row: pd.Series, col: str):
    """يرجع قيمة العمود إذا موجودة وغير فارغة"""
    if col not in row.index:
        return None
    value = row[col]
    if pd.isna(value):
        return None
    try:
        return float(value)
    except Exception:
        return None


def _approx_equal(a, b, tolerance_ratio: float = 0.05) -> bool:
    """
    يتحقق من تقارب رقمين بهامش نسبي.
    مثال tolerance_ratio=0.05 يعني 5%
    """
    if a is None or b is None:
        return True  # إذا ناقصة البيانات، ما نعتبرها مخالفة منطقية هنا
    if a == 0 and b == 0:
        return True

    denominator = max(abs(a), abs(b), 1)
    return abs(a - b) / denominator <= tolerance_ratio


# =========================
# 1) التحقق من اكتمال البيانات
# =========================

def validate_required_fields(
    df: pd.DataFrame,
    min_coverage: float = 0.70,
    require_all_statements: bool = True,
) -> dict:
    """
    يتحقق هل الملف يغطي الحد الأدنى المطلوب:
    1) وجود تمثيل للقوائم الثلاث إذا require_all_statements=True
    2) تغطية إجمالية >= min_coverage
    """

    balance_count = _non_null_count(df, BALANCE_FIELDS)
    income_count = _non_null_count(df, INCOME_FIELDS)
    cashflow_count = _non_null_count(df, CASHFLOW_FIELDS)

    balance_ok = balance_count > 0
    income_ok = income_count > 0
    cashflow_ok = cashflow_count > 0

    total_present = _non_null_count(df, REQUIRED_FIELDS)
    total_required = len(REQUIRED_FIELDS)
    coverage = total_present / total_required if total_required else 0.0

    missing_fields = [
        field for field in REQUIRED_FIELDS
        if field not in df.columns or df[field].isna().all()
    ]

    reasons = []

    if require_all_statements:
        if not balance_ok:
            reasons.append("القائمة المالية لا تحتوي على بيانات كافية من قائمة المركز المالي")
        if not income_ok:
            reasons.append("القائمة المالية لا تحتوي على بيانات كافية من قائمة الدخل")
        if not cashflow_ok:
            reasons.append("القائمة المالية لا تحتوي على بيانات كافية من قائمة التدفقات النقدية")

    if coverage < min_coverage:
        reasons.append(
            f"نسبة تغطية البيانات غير كافية ({coverage:.0%}) والحد الأدنى المطلوب هو {min_coverage:.0%}"
        )

    is_valid = len(reasons) == 0

    return {
        "is_valid": is_valid,
        "coverage": round(coverage, 2),
        "present_fields": total_present,
        "required_fields": total_required,
        "balance_present": balance_count,
        "income_present": income_count,
        "cashflow_present": cashflow_count,
        "missing_fields": missing_fields,
        "reasons": reasons,
    }


# =========================
# 2) التحقق المنطقي للقوائم المالية
# =========================

def validate_financial_logic(df: pd.DataFrame) -> dict:
    """
    يتحقق من منطقية البيانات المالية في أول صف من البيانات المعالجة.
    لا يرفض الملف تلقائيًا في كل الحالات، لكنه يرجع warnings / issues.
    """

    if df.empty:
        return {
            "logic_valid": False,
            "issues": ["الملف لا يحتوي على بيانات بعد المعالجة"],
            "warnings": []
        }

    row = df.iloc[0]

    issues = []
    warnings = []

    # -------------------------
    # Balance Sheet checks
    # -------------------------
    total_assets = _get_value(row, "total_assets")
    current_assets = _get_value(row, "current_assets")
    total_liabilities = _get_value(row, "total_liabilities")
    current_liabilities = _get_value(row, "current_liabilities")
    equity = _get_value(row, "equity")
    cash = _get_value(row, "cash")
    inventory = _get_value(row, "inventory")
    receivables = _get_value(row, "accounts_receivable")

    # current_assets <= total_assets
    if current_assets is not None and total_assets is not None:
        if current_assets > total_assets:
            issues.append("الأصول المتداولة أكبر من إجمالي الأصول، وهذا غير منطقي محاسبيًا")

    # current_liabilities <= total_liabilities
    if current_liabilities is not None and total_liabilities is not None:
        if current_liabilities > total_liabilities:
            issues.append("الخصوم المتداولة أكبر من إجمالي الخصوم، وهذا غير منطقي محاسبيًا")

    # cash <= current_assets
    if cash is not None and current_assets is not None:
        if cash > current_assets:
            issues.append("النقد أكبر من الأصول المتداولة، يرجى مراجعة البيانات")

    # inventory <= current_assets
    if inventory is not None and current_assets is not None:
        if inventory > current_assets:
            issues.append("المخزون أكبر من الأصول المتداولة، يرجى مراجعة البيانات")

    # receivables <= current_assets
    if receivables is not None and current_assets is not None:
        if receivables > current_assets:
            issues.append("الحسابات المدينة أكبر من الأصول المتداولة، يرجى مراجعة البيانات")

    # accounting equation: Assets ≈ Liabilities + Equity
    if total_assets is not None and total_liabilities is not None and equity is not None:
        expected_assets = total_liabilities + equity
        if not _approx_equal(total_assets, expected_assets, tolerance_ratio=0.05):
            issues.append(
                "المعادلة المحاسبية غير متوازنة تقريبًا: إجمالي الأصول لا يساوي إجمالي الخصوم + حقوق الملكية"
            )

    # -------------------------
    # Income Statement checks
    # -------------------------
    revenue = _get_value(row, "revenue")
    cogs = _get_value(row, "cost_of_goods_sold")
    gross_profit = _get_value(row, "gross_profit")
    operating_income = _get_value(row, "operating_income")
    net_income = _get_value(row, "net_income")
    operating_expenses = _get_value(row, "operating_expenses")
    interest_expense = _get_value(row, "interest_expense")

    # gross_profit ≈ revenue - cogs
    if revenue is not None and cogs is not None and gross_profit is not None:
        expected_gp = revenue - cogs
        if not _approx_equal(gross_profit, expected_gp, tolerance_ratio=0.05):
            warnings.append(
                "مجمل الربح لا يتطابق تقريبًا مع الإيرادات - تكلفة المبيعات"
            )

    # operating_income should generally be <= gross_profit (not strict universally, but good warning)
    if gross_profit is not None and operating_income is not None:
        if operating_income > gross_profit * 1.05:
            warnings.append(
                "الربح التشغيلي أكبر من مجمل الربح بشكل غير معتاد، يرجى مراجعة البيانات"
            )

    # net_income unusually greater than operating_income
    if operating_income is not None and net_income is not None:
        if net_income > operating_income * 1.20:
            warnings.append(
                "صافي الربح أعلى من الربح التشغيلي بشكل غير معتاد، قد يكون ذلك صحيحًا بسبب إيرادات أخرى لكن يفضّل التحقق"
            )

    # interest expense negative
    if interest_expense is not None and interest_expense < 0:
        warnings.append("مصروف الفوائد سالب، يرجى التأكد من طريقة تسجيله")

    # -------------------------
    # Cash Flow checks
    # -------------------------
    operating_cf = _get_value(row, "operating_cash_flow")
    investing_cf = _get_value(row, "investing_cash_flow")
    financing_cf = _get_value(row, "financing_cash_flow")
    net_cf = _get_value(row, "net_cash_flow")
    ending_cash = _get_value(row, "ending_cash_balance")

    # net_cash_flow ≈ operating + investing + financing
    if (
        operating_cf is not None
        and investing_cf is not None
        and financing_cf is not None
        and net_cf is not None
    ):
        expected_net_cf = operating_cf + investing_cf + financing_cf
        if not _approx_equal(net_cf, expected_net_cf, tolerance_ratio=0.05):
            warnings.append(
                "صافي التدفق النقدي لا يتطابق تقريبًا مع مجموع التدفقات التشغيلية والاستثمارية والتمويلية"
            )

    # ending cash should not be negative عادةً (تحذير فقط)
    if ending_cash is not None and ending_cash < 0:
        warnings.append("الرصيد النقدي النهائي سالب، يرجى التحقق من البيانات")

    # -------------------------
    # General sanity checks
    # -------------------------
    # أصول أو إيرادات سالبة تعتبر مشكلة واضحة غالبًا
    if total_assets is not None and total_assets < 0:
        issues.append("إجمالي الأصول سالب، وهذا غير منطقي في أغلب الحالات")
    if revenue is not None and revenue < 0:
        issues.append("الإيرادات سالبة، يرجى مراجعة البيانات")

    logic_valid = len(issues) == 0

    return {
        "logic_valid": logic_valid,
        "issues": issues,
        "warnings": warnings
    }
# src/elt/transform.py
from __future__ import annotations

import re
import unicodedata
from typing import Any

import pandas as pd


# ============================================================
# 1) Standard field names used by the financial engine
# ============================================================

STANDARD_NUMERIC_FIELDS = {
    # Balance Sheet
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
    "retained_earnings",

    # Income Statement
    "revenue",
    "cost_of_goods_sold",
    "gross_profit",
    "operating_expenses",
    "operating_income",
    "net_income",
    "interest_expense",
    "zakat_tax",
    "depreciation",
    "amortization",

    # Cash Flow
    "operating_cash_flow",
    "investing_cash_flow",
    "financing_cash_flow",
    "net_cash_flow",
    "ending_cash_balance",

    # Bank-grade supplemental inputs
    "cfads",
    "maintenance_capex",
    "scheduled_principal",
    "scheduled_interest",
    "mandatory_debt_fees",
    "finance_lease_payments",
}


# ============================================================
# 2) Field aliases: English + Arabic + common accounting labels
# ============================================================

COLUMN_ALIASES = {
    # Balance Sheet
    "total assets": "total_assets",
    "assets total": "total_assets",
    "assets": "total_assets",
    "total_assets": "total_assets",
    "total asset": "total_assets",
    "اجمالي الاصول": "total_assets",
    "إجمالي الأصول": "total_assets",
    "مجموع الاصول": "total_assets",
    "مجموع الأصول": "total_assets",
    "اجمالي الموجودات": "total_assets",
    "إجمالي الموجودات": "total_assets",
    "الاصول": "total_assets",
    "الأصول": "total_assets",
    "الموجودات": "total_assets",

    "current assets": "current_assets",
    "current asset": "current_assets",
    "total current assets": "current_assets",
    "current_assets": "current_assets",
    "اجمالي الاصول المتداولة": "current_assets",
    "إجمالي الأصول المتداولة": "current_assets",
    "مجموع الاصول المتداولة": "current_assets",
    "الأصول المتداولة": "current_assets",
    "الاصول المتداولة": "current_assets",
    "الموجودات المتداولة": "current_assets",

    "cash": "cash",
    "cash equivalents": "cash",
    "cash and cash equivalents": "cash",
    "cash & cash equivalents": "cash",
    "cash_cash_equivalents": "cash",
    "cash at bank and in hand": "cash",
    "cash in hand and at bank": "cash",
    "النقد": "cash",
    "النقد وما يعادله": "cash",
    "النقد وما في حكمه": "cash",
    "النقدية وما يعادلها": "cash",
    "النقد لدى البنوك وفي الصندوق": "cash",

    "inventory": "inventory",
    "inventories": "inventory",
    "stock": "inventory",
    "المخزون": "inventory",
    "المخزونات": "inventory",

    "accounts receivable": "accounts_receivable",
    "account receivable": "accounts_receivable",
    "receivables": "accounts_receivable",
    "trade receivables": "accounts_receivable",
    "trade and other receivables": "accounts_receivable",
    "accounts_receivable": "accounts_receivable",
    "الحسابات المدينة": "accounts_receivable",
    "الذمم المدينة": "accounts_receivable",
    "الذمم التجارية المدينة": "accounts_receivable",
    "المدينون": "accounts_receivable",
    "العملاء": "accounts_receivable",

    "total liabilities": "total_liabilities",
    "total liability": "total_liabilities",
    "liabilities": "total_liabilities",
    "total_liabilities": "total_liabilities",
    "اجمالي الخصوم": "total_liabilities",
    "إجمالي الخصوم": "total_liabilities",
    "مجموع الخصوم": "total_liabilities",
    "اجمالي الالتزامات": "total_liabilities",
    "إجمالي الالتزامات": "total_liabilities",
    "مجموع الالتزامات": "total_liabilities",
    "الخصوم": "total_liabilities",
    "الالتزامات": "total_liabilities",
    "المطلوبات": "total_liabilities",

    "current liabilities": "current_liabilities",
    "current liability": "current_liabilities",
    "total current liabilities": "current_liabilities",
    "current_liabilities": "current_liabilities",
    "الخصوم المتداولة": "current_liabilities",
    "الالتزامات المتداولة": "current_liabilities",
    "المطلوبات المتداولة": "current_liabilities",
    "اجمالي الخصوم المتداولة": "current_liabilities",
    "إجمالي الالتزامات المتداولة": "current_liabilities",

    "short term debt": "short_term_debt",
    "short-term debt": "short_term_debt",
    "short term borrowings": "short_term_debt",
    "short-term borrowings": "short_term_debt",
    "current borrowings": "short_term_debt",
    "current debt": "short_term_debt",
    "short_term_debt": "short_term_debt",
    "current portion of debt": "short_term_debt",
    "current portion of long term debt": "short_term_debt",
    "القروض قصيرة الاجل": "short_term_debt",
    "القروض قصيرة الأجل": "short_term_debt",
    "الديون قصيرة الاجل": "short_term_debt",
    "الديون قصيرة الأجل": "short_term_debt",
    "تسهيلات قصيرة الاجل": "short_term_debt",
    "تسهيلات قصيرة الأجل": "short_term_debt",
    "الجزء المتداول من القروض": "short_term_debt",

    "long term debt": "long_term_debt",
    "long-term debt": "long_term_debt",
    "long term borrowings": "long_term_debt",
    "long-term borrowings": "long_term_debt",
    "non current borrowings": "long_term_debt",
    "non-current borrowings": "long_term_debt",
    "non current debt": "long_term_debt",
    "long_term_debt": "long_term_debt",
    "القروض طويلة الاجل": "long_term_debt",
    "القروض طويلة الأجل": "long_term_debt",
    "الديون طويلة الاجل": "long_term_debt",
    "الديون طويلة الأجل": "long_term_debt",
    "تسهيلات طويلة الاجل": "long_term_debt",
    "تسهيلات طويلة الأجل": "long_term_debt",
    "القروض غير المتداولة": "long_term_debt",

    "equity": "equity",
    "shareholders equity": "equity",
    "shareholder equity": "equity",
    "owners equity": "equity",
    "owner equity": "equity",
    "total equity": "equity",
    "net assets": "equity",
    "حقوق الملكية": "equity",
    "اجمالي حقوق الملكية": "equity",
    "إجمالي حقوق الملكية": "equity",
    "حقوق المساهمين": "equity",
    "صافي الاصول": "equity",
    "صافي الأصول": "equity",

    "retained earnings": "retained_earnings",
    "retained_earnings": "retained_earnings",
    "accumulated earnings": "retained_earnings",
    "accumulated profits": "retained_earnings",
    "الأرباح المبقاة": "retained_earnings",
    "الارباح المبقاة": "retained_earnings",
    "الأرباح المحتجزة": "retained_earnings",
    "الارباح المحتجزة": "retained_earnings",

    # Income Statement
    "revenue": "revenue",
    "revenues": "revenue",
    "sales": "revenue",
    "net sales": "revenue",
    "turnover": "revenue",
    "operating revenue": "revenue",
    "الايرادات": "revenue",
    "الإيرادات": "revenue",
    "اجمالي الايرادات": "revenue",
    "إجمالي الإيرادات": "revenue",
    "المبيعات": "revenue",
    "صافي المبيعات": "revenue",

    "cost of goods sold": "cost_of_goods_sold",
    "cost_of_goods_sold": "cost_of_goods_sold",
    "cogs": "cost_of_goods_sold",
    "cost of sales": "cost_of_goods_sold",
    "sales cost": "cost_of_goods_sold",
    "تكلفة المبيعات": "cost_of_goods_sold",
    "تكلفة البضاعة المباعة": "cost_of_goods_sold",
    "تكلفة الايرادات": "cost_of_goods_sold",
    "تكلفة الإيرادات": "cost_of_goods_sold",

    "gross profit": "gross_profit",
    "gross income": "gross_profit",
    "gross_profit": "gross_profit",
    "مجمل الربح": "gross_profit",
    "اجمالي الربح": "gross_profit",
    "إجمالي الربح": "gross_profit",

    "operating expenses": "operating_expenses",
    "operating expense": "operating_expenses",
    "operating_expenses": "operating_expenses",
    "opex": "operating_expenses",
    "selling general and administrative expenses": "operating_expenses",
    "selling and administrative expenses": "operating_expenses",
    "مصاريف تشغيلية": "operating_expenses",
    "المصاريف التشغيلية": "operating_expenses",
    "المصروفات التشغيلية": "operating_expenses",
    "مصاريف البيع والادارة": "operating_expenses",
    "مصاريف البيع والإدارة": "operating_expenses",

    "operating income": "operating_income",
    "operating profit": "operating_income",
    "profit from operations": "operating_income",
    "ebit": "operating_income",
    "income from operations": "operating_income",
    "دخل التشغيل": "operating_income",
    "الربح التشغيلي": "operating_income",
    "صافي الربح التشغيلي": "operating_income",
    "الربح من العمليات": "operating_income",

    "net income": "net_income",
    "net profit": "net_income",
    "profit after tax": "net_income",
    "profit for the year": "net_income",
    "profit for the period": "net_income",
    "صافي الربح": "net_income",
    "صافي الدخل": "net_income",
    "ربح السنة": "net_income",
    "ربح الفترة": "net_income",

    "interest expense": "interest_expense",
    "interest expenses": "interest_expense",
    "finance cost": "interest_expense",
    "finance costs": "interest_expense",
    "financing cost": "interest_expense",
    "مصروف الفوائد": "interest_expense",
    "مصاريف الفوائد": "interest_expense",
    "تكلفة التمويل": "interest_expense",
    "تكاليف التمويل": "interest_expense",
    "اعباء التمويل": "interest_expense",
    "أعباء التمويل": "interest_expense",

    "zakat tax": "zakat_tax",
    "zakat and tax": "zakat_tax",
    "zakat and income tax": "zakat_tax",
    "income tax": "zakat_tax",
    "tax": "zakat_tax",
    "tax expense": "zakat_tax",
    "الزكاة والضريبة": "zakat_tax",
    "الزكاة والضرائب": "zakat_tax",
    "مصروف الزكاة والضريبة": "zakat_tax",
    "ضريبة الدخل": "zakat_tax",

    "depreciation": "depreciation",
    "depreciation expense": "depreciation",
    "depreciation and impairment": "depreciation",
    "الإهلاك": "depreciation",
    "الاهلاك": "depreciation",
    "مصروف الاهلاك": "depreciation",
    "مصروف الإهلاك": "depreciation",

    "amortization": "amortization",
    "amortisation": "amortization",
    "amortization expense": "amortization",
    "الاستهلاك": "amortization",
    "الاطفاء": "amortization",
    "الإطفاء": "amortization",

    # Cash Flow
    "operating cash flow": "operating_cash_flow",
    "cash flow from operations": "operating_cash_flow",
    "cash flows from operating activities": "operating_cash_flow",
    "net cash from operating activities": "operating_cash_flow",
    "net cash generated from operating activities": "operating_cash_flow",
    "cash generated from operations": "operating_cash_flow",
    "cash from operations": "operating_cash_flow",
    "operating_cash_flow": "operating_cash_flow",
    "التدفق النقدي التشغيلي": "operating_cash_flow",
    "صافي النقد من الانشطة التشغيلية": "operating_cash_flow",
    "صافي النقد من الأنشطة التشغيلية": "operating_cash_flow",
    "صافي التدفقات النقدية من الانشطة التشغيلية": "operating_cash_flow",
    "صافي التدفقات النقدية من الأنشطة التشغيلية": "operating_cash_flow",

    "investing cash flow": "investing_cash_flow",
    "cash flow from investing": "investing_cash_flow",
    "cash flows from investing activities": "investing_cash_flow",
    "net cash from investing activities": "investing_cash_flow",
    "net cash used in investing activities": "investing_cash_flow",
    "cash from investing": "investing_cash_flow",
    "investing_cash_flow": "investing_cash_flow",
    "التدفق النقدي الاستثماري": "investing_cash_flow",
    "صافي النقد من الانشطة الاستثمارية": "investing_cash_flow",
    "صافي النقد من الأنشطة الاستثمارية": "investing_cash_flow",
    "صافي التدفقات النقدية من الانشطة الاستثمارية": "investing_cash_flow",
    "صافي التدفقات النقدية من الأنشطة الاستثمارية": "investing_cash_flow",

    "financing cash flow": "financing_cash_flow",
    "cash flow from financing": "financing_cash_flow",
    "cash flows from financing activities": "financing_cash_flow",
    "net cash from financing activities": "financing_cash_flow",
    "net cash used in financing activities": "financing_cash_flow",
    "cash from financing": "financing_cash_flow",
    "financing_cash_flow": "financing_cash_flow",
    "التدفق النقدي التمويلي": "financing_cash_flow",
    "صافي النقد من الانشطة التمويلية": "financing_cash_flow",
    "صافي النقد من الأنشطة التمويلية": "financing_cash_flow",
    "صافي التدفقات النقدية من الانشطة التمويلية": "financing_cash_flow",
    "صافي التدفقات النقدية من الأنشطة التمويلية": "financing_cash_flow",

    "net cash flow": "net_cash_flow",
    "net change in cash": "net_cash_flow",
    "net increase decrease in cash": "net_cash_flow",
    "net increase in cash": "net_cash_flow",
    "net decrease in cash": "net_cash_flow",
    "net_cash_flow": "net_cash_flow",
    "صافي التدفق النقدي": "net_cash_flow",
    "صافي التغير في النقد": "net_cash_flow",
    "صافي الزيادة النقص في النقد": "net_cash_flow",
    "صافي الزيادة في النقد": "net_cash_flow",

    "ending cash balance": "ending_cash_balance",
    "cash at end of period": "ending_cash_balance",
    "cash and cash equivalents at end of period": "ending_cash_balance",
    "closing cash balance": "ending_cash_balance",
    "ending_cash_balance": "ending_cash_balance",
    "الرصيد النقدي النهائي": "ending_cash_balance",
    "النقد في نهاية الفترة": "ending_cash_balance",
    "النقد وما يعادله في نهاية الفترة": "ending_cash_balance",
    "رصيد النقد في نهاية الفترة": "ending_cash_balance",

    # Banking supplemental fields
    "cfads": "cfads",
    "cash flow available for debt service": "cfads",
    "cash available for debt service": "cfads",
    "النقد المتاح لخدمة الدين": "cfads",
    "التدفق النقدي المتاح لخدمة الدين": "cfads",

    "maintenance capex": "maintenance_capex",
    "maintenance capital expenditure": "maintenance_capex",
    "maintenance_capex": "maintenance_capex",
    "الإنفاق الرأسمالي الضروري": "maintenance_capex",
    "الانفاق الرأسمالي الضروري": "maintenance_capex",
    "النفقات الرأسمالية الضرورية": "maintenance_capex",

    "scheduled principal": "scheduled_principal",
    "scheduled principal repayment": "scheduled_principal",
    "principal due": "scheduled_principal",
    "scheduled_principal": "scheduled_principal",
    "أصل الدين المجدول": "scheduled_principal",
    "اصل الدين المجدول": "scheduled_principal",
    "سداد اصل الدين": "scheduled_principal",
    "سداد أصل الدين": "scheduled_principal",

    "scheduled interest": "scheduled_interest",
    "scheduled interest payment": "scheduled_interest",
    "interest due": "scheduled_interest",
    "scheduled_interest": "scheduled_interest",
    "الفوائد المجدولة": "scheduled_interest",
    "أرباح التمويل المجدولة": "scheduled_interest",
    "ارباح التمويل المجدولة": "scheduled_interest",

    "mandatory debt fees": "mandatory_debt_fees",
    "debt service fees": "mandatory_debt_fees",
    "mandatory_debt_fees": "mandatory_debt_fees",
    "رسوم خدمة الدين الإلزامية": "mandatory_debt_fees",
    "رسوم خدمة الدين الالزامية": "mandatory_debt_fees",

    "finance lease payments": "finance_lease_payments",
    "finance lease payment": "finance_lease_payments",
    "lease payments": "finance_lease_payments",
    "finance_lease_payments": "finance_lease_payments",
    "دفعات الإيجار التمويلي": "finance_lease_payments",
    "دفعات الايجار التمويلي": "finance_lease_payments",
}


_ARABIC_DIACRITICS = re.compile(r"[\u0617-\u061A\u064B-\u0652\u0670\u06D6-\u06ED]")
_ARABIC_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "01234567890123456789")


def normalize_field_label(value: Any) -> str:
    """Normalize a possible accounting label before alias matching."""
    if value is None:
        return ""

    text = unicodedata.normalize("NFKC", str(value)).strip().lower()
    text = text.replace("\ufeff", "").replace("ـ", "")
    text = _ARABIC_DIACRITICS.sub("", text)
    text = text.translate(_ARABIC_DIGITS)

    # Normalize common Arabic letter variants to improve matching.
    text = re.sub(r"[أإآٱ]", "ا", text)
    text = text.replace("ى", "ي").replace("ؤ", "و").replace("ئ", "ي")

    # Separators and common accounting punctuation.
    text = text.replace("&", " and ")
    text = re.sub(r"[_/\\|:;\-–—]+", " ", text)
    text = re.sub(r"[\[\]{}()]", " ", text)
    text = re.sub(r"[^\w\s]", " ", text, flags=re.UNICODE)

    # Remove units and period decorations that are commonly appended to labels.
    removable_phrases = [
        "saudi riyal", "riyals", "riyal", "sar", "rs", "ر س", "ريال سعودي", "ريال",
        "in thousands", "in millions", "000s", "000", "بالالاف", "بالآلاف", "بالملايين",
        "as at", "as of", "for the year ended", "for year ended", "year ended",
        "للسنه المنتهيه", "للسنة المنتهية", "كما في", "في نهايه السنه", "في نهاية السنة",
    ]
    for phrase in removable_phrases:
        text = text.replace(phrase, " ")

    # Dates/years are metadata, not part of the accounting field label.
    text = re.sub(r"\b(?:19|20)\d{2}\b", " ", text)
    text = re.sub(r"\b\d{1,2}\s+\d{1,2}\s+(?:19|20)\d{2}\b", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


_NORMALIZED_ALIASES = {
    normalize_field_label(alias): canonical
    for alias, canonical in COLUMN_ALIASES.items()
}
for _canonical in STANDARD_NUMERIC_FIELDS:
    _NORMALIZED_ALIASES[normalize_field_label(_canonical)] = _canonical


def resolve_canonical_field(value: Any) -> str | None:
    """Return the canonical field name for an exact normalized alias."""
    normalized = normalize_field_label(value)
    if not normalized:
        return None
    return _NORMALIZED_ALIASES.get(normalized)


def _safe_unknown_column_name(value: Any) -> str:
    normalized = normalize_field_label(value)
    if not normalized:
        return "unnamed"
    return normalized.replace(" ", "_")


def standardize_column_names(df: pd.DataFrame) -> pd.DataFrame:
    """Standardize known columns and coalesce duplicate aliases safely."""
    renamed: list[str] = []
    for original_col in df.columns:
        renamed.append(resolve_canonical_field(original_col) or _safe_unknown_column_name(original_col))

    result = df.copy()
    result.columns = renamed

    # Coalesce duplicate columns from left to right. This avoids losing a valid
    # value when two aliases map to the same canonical field.
    if result.columns.duplicated().any():
        merged: dict[str, pd.Series] = {}
        for name in dict.fromkeys(result.columns):
            same = result.loc[:, result.columns == name]
            if same.shape[1] == 1:
                merged[name] = same.iloc[:, 0]
            else:
                merged[name] = same.bfill(axis=1).iloc[:, 0]
        result = pd.DataFrame(merged, index=result.index)

    return result


# ============================================================
# 3) Numeric cleaning
# ============================================================

_EMPTY_VALUES = {"", "na", "n/a", "n.a", "null", "none", "nil", "-", "—", "–", "غير متوفر"}


def clean_numeric_value(value: Any):
    """Convert common Arabic/English financial number formats to float."""
    if value is None or (not isinstance(value, str) and pd.isna(value)):
        return pd.NA

    if isinstance(value, bool):
        return pd.NA
    if isinstance(value, (int, float)):
        return value

    text = unicodedata.normalize("NFKC", str(value)).strip()
    text = text.translate(_ARABIC_DIGITS)
    text = text.replace("\u00a0", " ").replace("−", "-").replace("–", "-").replace("—", "-")
    if text.lower().strip() in _EMPTY_VALUES:
        return pd.NA

    negative = False
    if text.startswith("(") and text.endswith(")"):
        negative = True
        text = text[1:-1]
    if text.endswith("-"):
        negative = True
        text = text[:-1]
    if text.startswith("-"):
        negative = True
        text = text[1:]

    lower = text.lower().strip()
    multiplier = 1.0
    suffixes = [
        (r"(?:b|bn|billion|مليار)$", 1_000_000_000),
        (r"(?:m|mn|million|مليون)$", 1_000_000),
        (r"(?:k|thousand|الف|ألف)$", 1_000),
    ]
    for pattern, factor in suffixes:
        if re.search(pattern, lower):
            multiplier = factor
            lower = re.sub(pattern, "", lower).strip()
            break

    # Remove currency, spacing and thousands separators. Arabic decimal/thousands
    # marks are handled separately so ١٬٢٣٤٫٥ becomes 1234.5.
    lower = re.sub(r"sar|saudi riyals?|riyals?|ر\.?\s?س|ريال(?:\s+سعودي)?|usd|\$", "", lower)
    lower = lower.replace("٬", "").replace("،", "").replace(",", "")
    lower = lower.replace("٫", ".").replace(" ", "")
    lower = lower.rstrip("%")

    # Accounting exports sometimes prefix values with CR/DR. Keep the numeric
    # sign only when it is explicit; otherwise treat the tag as metadata.
    lower = re.sub(r"^(?:cr|dr)", "", lower)
    lower = re.sub(r"(?:cr|dr)$", "", lower)

    if not re.fullmatch(r"\d*(?:\.\d+)?", lower) or lower in {"", "."}:
        return pd.NA

    numeric = float(lower) * multiplier
    return -numeric if negative else numeric


def clean_numeric_columns(df: pd.DataFrame) -> pd.DataFrame:
    for col in STANDARD_NUMERIC_FIELDS:
        if col in df.columns:
            df[col] = df[col].apply(clean_numeric_value)
    return df


def coerce_numeric_types(df: pd.DataFrame) -> pd.DataFrame:
    for col in STANDARD_NUMERIC_FIELDS:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    return df


def transform_financial_data(df: pd.DataFrame) -> pd.DataFrame:
    """Standardize labels and numeric values without depending on column order."""
    attrs = dict(getattr(df, "attrs", {}))
    result = standardize_column_names(df.copy())
    result = clean_numeric_columns(result)
    result = coerce_numeric_types(result)
    result.attrs.update(attrs)
    return result

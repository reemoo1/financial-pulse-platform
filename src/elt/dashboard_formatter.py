# src/elt/dashboard_formatter.py

def _times(value):
    return f"{value:.2f} مرة" if value is not None else "غير متوفر"

def _percent(value):
    return f"{value * 100:.2f}%" if value is not None else "غير متوفر"

def format_dashboard_metrics(metrics: dict) -> dict:
    return {
        "cards": {
            "liquidity_ratio": {
                "label_ar": "نسبة السيولة",
                "value": metrics.get("current_ratio"),
                "display_value": _times(metrics.get("current_ratio")),
                "source_metric": "current_ratio"
            },
            "debt_ratio": {
                "label_ar": "نسبة المديونية",
                "value": metrics.get("debt_ratio"),
                "display_value": _percent(metrics.get("debt_ratio")),
                "source_metric": "debt_ratio"
            },
            "profit_margin": {
                "label_ar": "هامش الربح",
                "value": metrics.get("net_profit_margin"),
                "display_value": _percent(metrics.get("net_profit_margin")),
                "source_metric": "net_profit_margin"
            },
            "cash_flow": {
                "label_ar": "التدفق النقدي",
                "value": metrics.get("operating_cash_flow_ratio"),
                "display_value": _times(metrics.get("operating_cash_flow_ratio")),
                "source_metric": "operating_cash_flow_ratio"
            }
        },
        "sections": {
            "liquidity": {
                "title_ar": "السيولة",
                "metrics": [
                    {
                        "label_ar": "نسبة السيولة الحالية",
                        "value": metrics.get("current_ratio"),
                        "unit": "مرة"
                    },
                    {
                        "label_ar": "نسبة السيولة السريعة",
                        "value": metrics.get("quick_ratio"),
                        "unit": "مرة"
                    },
                    {
                        "label_ar": "نسبة النقد",
                        "value": metrics.get("cash_ratio"),
                        "unit": "مرة"
                    }
                ]
            },
            "leverage": {
                "title_ar": "المديونية",
                "metrics": [
                    {
                        "label_ar": "نسبة المديونية",
                        "value": metrics.get("debt_ratio"),
                        "unit": "%"
                    },
                    {
                        "label_ar": "الدين إلى حقوق الملكية",
                        "value": metrics.get("debt_to_equity"),
                        "unit": "مرة"
                    }
                ]
            },
            "profitability": {
                "title_ar": "الربحية",
                "metrics": [
                    {
                        "label_ar": "هامش الربح",
                        "value": metrics.get("net_profit_margin"),
                        "unit": "%"
                    },
                    {
                        "label_ar": "العائد على الأصول",
                        "value": metrics.get("roa"),
                        "unit": "%"
                    },
                    {
                        "label_ar": "العائد على حقوق الملكية",
                        "value": metrics.get("roe"),
                        "unit": "%"
                    }
                ]
            },
            "cash_flow": {
                "title_ar": "التدفقات النقدية",
                "metrics": [
                    {
                        "label_ar": "نسبة التدفق النقدي التشغيلي",
                        "value": metrics.get("operating_cash_flow_ratio"),
                        "unit": "مرة"
                    },
                    {
                        "label_ar": "التدفق النقدي الحر",
                        "value": metrics.get("free_cash_flow"),
                        "unit": "SAR"
                    }
                ]
            },
            "risk_indicators": {
                "title_ar": "مؤشرات المخاطر",
                "metrics": [
                    {
                        "label_ar": "تغطية الفوائد",
                        "value": metrics.get("interest_coverage"),
                        "unit": "مرة"
                    },
                    {
                        "label_ar": "DSCR",
                        "value": metrics.get("dscr"),
                        "unit": "مرة"
                    },
                    {
                        "label_ar": "Altman Z'-Score (نموذج الشركات الخاصة)",
                        "value": metrics.get("altman_z_score"),
                        "unit": "درجة"
                    }
                ]
            }
        }
    }
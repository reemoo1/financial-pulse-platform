import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function AuthLogo({ variant = "light" }: { variant?: "light" | "dark" }) {
  const fill = variant === "light" ? "#13294B" : "#0B1F3A";
  return (
    <span className="fp-logo-mark">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="4" fill={fill} />
        <path
          d="M6 14h2.5l1.5-5 2.5 8 2-6 1.5 3H18"
          stroke="#C9793B"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

type AuthStep = {
  label: string;
  state: "done" | "current" | "upcoming";
};

export default function AuthShell({
  portalLabel,
  headline,
  features,
  steps,
  panelTitle,
  panelSubtitle,
  children,
  footer,
}: {
  portalLabel: string;
  headline: string;
  features: string[];
  steps?: AuthStep[];
  panelTitle: string;
  panelSubtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="auth-shell" dir="rtl">
      <div className="auth-shell-top">
        <Link href="/" className="auth-shell-brand">
          <AuthLogo />
          <span>{portalLabel}</span>
        </Link>
        <Link href="/" className="auth-shell-back">
          <ArrowRight className="h-4 w-4" />
          العودة للرئيسية
        </Link>
      </div>

      <div className="auth-shell-grid">
        <section className="auth-shell-intro">
          <span className="portal-kicker auth-shell-kicker">دخول آمن</span>
          <h1 className="auth-shell-headline">{headline}</h1>
          <ul className="auth-shell-features">
            {features.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
        </section>

        <section className="auth-panel">
          {steps && steps.length > 0 && (
            <div className="auth-stepper" aria-label="خطوات التحقق">
              {steps.map((step, index) => (
                <div key={step.label} className="auth-stepper-item">
                  <div className={`auth-stepper-dot is-${step.state}`}>
                    {step.state === "done" ? "✓" : index + 1}
                  </div>
                  <span className={`auth-stepper-label is-${step.state}`}>{step.label}</span>
                  {index < steps.length - 1 && (
                    <div className={`auth-stepper-line is-${step.state === "done" ? "done" : "upcoming"}`} />
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="auth-panel-header">
            <h2>{panelTitle}</h2>
            {panelSubtitle && <p>{panelSubtitle}</p>}
          </div>

          <div className="auth-panel-body">{children}</div>
          {footer && <div className="auth-panel-footer">{footer}</div>}
        </section>
      </div>
    </main>
  );
}

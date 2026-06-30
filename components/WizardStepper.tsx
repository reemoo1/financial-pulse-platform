import { Check } from "lucide-react";

interface Props {
  steps: string[];
  current: number; // 0-indexed
}

export default function WizardStepper({ steps, current }: Props) {
  return (
    <div className="flex items-center justify-between mb-10">
      {steps.map((label, i) => (
        <div key={label} className="flex-1 flex items-center">
          <div className="flex flex-col items-center gap-2 flex-shrink-0">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                i < current
                  ? "bg-fp-green text-white"
                  : i === current
                  ? "bg-fp-gold text-fp-ink"
                  : "bg-black/5 text-fp-slate"
              }`}
            >
              {i < current ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            <span className="text-xs text-fp-slate hidden sm:block whitespace-nowrap">
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`flex-1 h-0.5 mx-2 ${
                i < current ? "bg-fp-green" : "bg-black/10"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

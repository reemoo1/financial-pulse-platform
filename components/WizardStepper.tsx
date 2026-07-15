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
              className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-colors duration-150 ${
                i < current
                  ? "bg-[#0B1F3A] text-white"
                  : i === current
                  ? "bg-[#C9793B] text-white"
                  : "bg-[#F8FAFC] text-[#64748B] border border-[#D9E2EC]"
              }`}
            >
              {i < current ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            <span className="text-xs text-[#64748B] hidden sm:block whitespace-nowrap">
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`flex-1 h-0.5 mx-2 transition-colors duration-150 ${
                i < current ? "bg-[#0B1F3A]" : "bg-[#E8EDF4]"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

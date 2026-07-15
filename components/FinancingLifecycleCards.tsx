import { AlertTriangle, CheckCircle2, Circle } from "lucide-react";
import { FinancingLifecyclePlan } from "@/lib/types";

export default function FinancingLifecycleCards({
  lifecycle,
  title = "رحلة التمويل",
}: {
  lifecycle: FinancingLifecyclePlan;
  title?: string;
}) {
  const stages = lifecycle.stages.slice(0, 4);

  return (
    <section className="portal-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="portal-section-label">أربع مراحل أساسية</p>
          <h3 className="mt-1 font-semibold text-[#0F172A]">{title}</h3>
        </div>
        <span className="rounded-full bg-[#0B1F3A]/8 px-3 py-1 text-xs font-bold text-[#0B1F3A]">
          {lifecycle.statusLabel}
        </span>
      </div>

      <div className="relative mt-8 grid gap-6 md:grid-cols-4" dir="rtl">
        <div className="absolute right-[8%] left-[8%] top-5 hidden h-px bg-[#E8EDF4] md:block" />
        {stages.map((stage, index) => (
          <div key={stage.key} className="relative text-center">
            <div className={`relative z-10 mx-auto flex h-10 w-10 items-center justify-center rounded-full border-2 ${stageClass(stage.state)}`}>
              {stage.state === "completed" ? <CheckCircle2 className="h-5 w-5" /> : stage.state === "blocked" ? <AlertTriangle className="h-5 w-5" /> : <Circle className="h-4 w-4 fill-current/10" />}
            </div>
            <span className="mt-3 block text-[10px] font-bold text-[#64748B]">المرحلة {index + 1}</span>
            <h4 className="mt-1 text-sm font-bold text-[#0F172A]">{stage.label}</h4>
            <p className="mt-2 text-xs leading-6 text-[#64748B]">{stage.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function stageClass(state: FinancingLifecyclePlan["stages"][number]["state"]) {
  if (state === "completed") return "border-[#1F8A5B] bg-[#ECFDF5] text-[#1F8A5B]";
  if (state === "current") return "border-[#0B1F3A] bg-[#0B1F3A] text-white";
  if (state === "blocked") return "border-[#C23A3A] bg-[#FEF2F2] text-[#C23A3A]";
  return "border-[#D9E2EC] bg-white text-[#94A3B8]";
}

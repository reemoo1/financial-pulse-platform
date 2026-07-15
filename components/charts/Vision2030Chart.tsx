"use client";

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface Props {
  breakdown: {
    localization: number;
    nonOilContribution: number;
    sustainability: number;
    jobCreation: number;
  };
}

export default function Vision2030Chart({ breakdown }: Props) {
  const data = [
    { subject: "التوطين", value: breakdown.localization },
    { subject: "المساهمة غير النفطية", value: breakdown.nonOilContribution },
    { subject: "الاستدامة", value: breakdown.sustainability },
    { subject: "خلق الوظائف", value: breakdown.jobCreation },
  ];

  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={data}>
        <PolarGrid stroke="rgba(11, 31, 58, 0.1)" />
        <PolarAngleAxis dataKey="subject" fontSize={11} />
        <PolarRadiusAxis angle={30} domain={[0, 100]} fontSize={10} />
        <Radar
          name="التوافق"
          dataKey="value"
          stroke="#0B1F3A"
          fill="#C9793B"
          fillOpacity={0.35}
        />
        <Tooltip />
      </RadarChart>
    </ResponsiveContainer>
  );
}

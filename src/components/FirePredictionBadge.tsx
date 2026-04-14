import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldAlert, ShieldX, Loader2 } from "lucide-react";

export type PredictionResult = "true_fire" | "false_alarm" | "no_fire" | null;

interface FirePredictionBadgeProps {
  prediction: PredictionResult;
  isLoading?: boolean;
}

const predictionConfig = {
  true_fire: {
    label: "🔥 TRUE FIRE",
    icon: ShieldX,
    className: "bg-red-600 hover:bg-red-700 text-white border-red-800 animate-pulse",
  },
  false_alarm: {
    label: "⚠️ FALSE ALARM",
    icon: ShieldAlert,
    className: "bg-yellow-500 hover:bg-yellow-600 text-black border-yellow-700",
  },
  no_fire: {
    label: "✅ NO FIRE",
    icon: ShieldCheck,
    className: "bg-green-600 hover:bg-green-700 text-white border-green-800",
  },
};

export const FirePredictionBadge = ({ prediction, isLoading }: FirePredictionBadgeProps) => {
  if (isLoading) {
    return (
      <Badge variant="secondary" className="gap-1 animate-pulse">
        <Loader2 className="h-3 w-3 animate-spin" />
        Analyzing...
      </Badge>
    );
  }

  if (!prediction) return null;

  const config = predictionConfig[prediction];
  const Icon = config.icon;

  return (
    <Badge className={`gap-1 text-sm px-3 py-1 ${config.className}`}>
      <Icon className="h-4 w-4" />
      {config.label}
    </Badge>
  );
};

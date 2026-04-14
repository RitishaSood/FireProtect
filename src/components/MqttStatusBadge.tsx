import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff, Loader2 } from "lucide-react";

interface MqttStatusBadgeProps {
  status: "connecting" | "connected" | "disconnected" | "error";
}

export const MqttStatusBadge = ({ status }: MqttStatusBadgeProps) => {
  const config = {
    connected: {
      label: "MQTT Connected",
      variant: "default" as const,
      icon: Wifi,
      className: "bg-green-600 hover:bg-green-700 text-white",
    },
    connecting: {
      label: "Connecting...",
      variant: "secondary" as const,
      icon: Loader2,
      className: "animate-pulse",
    },
    disconnected: {
      label: "MQTT Disconnected",
      variant: "destructive" as const,
      icon: WifiOff,
      className: "",
    },
    error: {
      label: "MQTT Error",
      variant: "destructive" as const,
      icon: WifiOff,
      className: "",
    },
  };

  const { label, variant, icon: Icon, className } = config[status];

  return (
    <Badge variant={variant} className={`gap-1 ${className}`}>
      <Icon className={`h-3 w-3 ${status === "connecting" ? "animate-spin" : ""}`} />
      {label}
    </Badge>
  );
};

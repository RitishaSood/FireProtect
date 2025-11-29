import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Flame, Wind, Gauge, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const GlobalAlertListener = () => {
  const navigate = useNavigate();
  const shownAlerts = useRef<Set<string>>(new Set());
  const alertToasts = useRef<Map<string, { dismiss: () => void; update: (props: any) => void }>>(new Map());

  useEffect(() => {
    const handleAlert = async (payload: any, isUpdate: boolean = false) => {
      const alert = payload.new;
      const alertId = alert.id as string;
      const status = alert.status as string | null;
      const eventType = (payload.eventType || payload.type || (isUpdate ? "UPDATE" : "INSERT")) as string;

      console.log("Alert received:", { alertId, eventType, status, type: alert.alert_type });

      // If alert is solved/unsolved, dismiss any existing toast and stop
      if (status === "solved" || status === "unsolved") {
        const existing = alertToasts.current.get(alertId);
        if (existing) {
          console.log("Dismissing toast for resolved alert:", alertId);
          existing.dismiss();
          alertToasts.current.delete(alertId);
        }
        shownAlerts.current.delete(alertId);
        return;
      }

      // From here on, we handle active / in-queue alerts and keep a single toast per alert
      shownAlerts.current.add(alertId);
      
      // Fetch location name
      const { data: location } = await supabase
        .from("locations")
        .select("name")
        .eq("id", alert.location_id)
        .single();

      const locationName = location?.name || "Unknown Location";

      // Determine title based on alert type
      let title = "";

      switch (alert.alert_type) {
        case "fire":
          title = "🔥 FIRE DETECTED";
          break;
        case "gas_leak":
          title = "💨 GAS LEAK DETECTED";
          break;
        case "temperature":
          title = "🌡️ HIGH TEMPERATURE";
          break;
        default:
          title = "⚠️ ALERT";
      }

      const description = `Location: ${locationName}\nSeverity: ${alert.severity?.toString().toUpperCase()}`;

      const existing = alertToasts.current.get(alertId);

      if (existing) {
        console.log("Updating existing alert toast:", alertId);
        existing.update({
          title,
          description,
          variant: "destructive",
          open: true,
        });
        return;
      }

      console.log("Creating new alert toast:", alertId);
      const newToast = toast({
        title,
        description,
        variant: "destructive",
        action: (
          <button
            onClick={() => navigate(`/alert/${alert.id}`)}
            className="px-3 py-2 text-sm font-medium bg-white text-destructive rounded-md hover:bg-white/90 transition-colors"
          >
            View Details
          </button>
        ),
      });

      alertToasts.current.set(alertId, newToast);

      // Play alert sound only when toast is first created
      try {
        const audio = new Audio("/alert-sound.mp3");
        audio.play().catch(() => {
          // Silently fail if audio cannot be played
        });
      } catch (error) {
        // Silently fail if audio cannot be played
      }
    };

    const channel = supabase
      .channel('global-alerts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'alerts'
        },
        (payload) => handleAlert(payload, false)
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'alerts'
        },
        (payload) => handleAlert(payload, true)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [navigate]);

  return null;
};

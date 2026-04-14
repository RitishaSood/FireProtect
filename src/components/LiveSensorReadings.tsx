import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SensorCard } from "@/components/SensorCard";
import { MqttStatusBadge } from "@/components/MqttStatusBadge";
import { FirePredictionBadge, PredictionResult } from "@/components/FirePredictionBadge";
import { useMqtt } from "@/hooks/useMqtt";
import { Thermometer, Wind, Flame, Droplets, Activity, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

interface Location {
  id: string;
  name: string;
  region: string;
  thingspeak_channel_id: string | null;
  thingspeak_read_key: string | null;
}

export const LiveSensorReadings = () => {
  const { toast } = useToast();
  const [location, setLocation] = useState<Location | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [prediction, setPrediction] = useState<PredictionResult>(null);
  const [isPredicting, setIsPredicting] = useState(false);

  // MQTT hook for real-time data
  const { sensorData: mqttData, connectionStatus, lastUpdated: mqttLastUpdated } = useMqtt();

  // Fallback: ThingSpeak data for when MQTT is not connected
  const [thingspeakData, setThingspeakData] = useState<any>(null);
  const [thingspeakTimestamp, setThingspeakTimestamp] = useState<string | null>(null);

  // Use MQTT data if available, otherwise ThingSpeak
  const isUsingMqtt = connectionStatus === "connected" && mqttData !== null;
  const displayData = isUsingMqtt
    ? {
        temperature: mqttData.temperature,
        gas: mqttData.gas,
        flame: mqttData.flame,
        humidity: mqttData.humidity ?? 0,
        pir: mqttData.pir,
      }
    : thingspeakData;

  const lastUpdatedDisplay = isUsingMqtt
    ? mqttLastUpdated
      ? formatDistanceToNow(mqttLastUpdated, { addSuffix: true })
      : null
    : thingspeakTimestamp
    ? formatDistanceToNow(new Date(thingspeakTimestamp), { addSuffix: true })
    : null;

  useEffect(() => {
    fetchLocation();
  }, []);

  // Fallback polling when MQTT is not connected
  useEffect(() => {
    if (connectionStatus !== "connected" && location) {
      fetchThingspeakData();
      const interval = setInterval(fetchThingspeakData, 30000);
      return () => clearInterval(interval);
    }
  }, [connectionStatus, location]);

  // Run prediction whenever sensor data changes
  useEffect(() => {
    if (displayData) {
      runPrediction(displayData);
    }
  }, [mqttData, thingspeakData]);

  const fetchLocation = async () => {
    try {
      const { data: locations, error } = await supabase
        .from("locations")
        .select("id, name, region, thingspeak_channel_id, thingspeak_read_key")
        .not("thingspeak_channel_id", "is", null)
        .limit(1)
        .single();

      if (error) throw error;
      if (!locations) { setIsLoading(false); return; }
      setLocation(locations);
    } catch (error) {
      console.error("Error fetching location:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchThingspeakData = async () => {
    if (!location) return;
    try {
      const { data, error } = await supabase.functions.invoke("thingspeak-service", {
        body: { action: "latest", location },
      });
      if (error) throw error;
      if (data?.success && data?.data) {
        setThingspeakData(data.data);
        setThingspeakTimestamp(data.data.timestamp);
      }
    } catch (error) {
      console.error("Error fetching ThingSpeak data:", error);
    }
  };

  const runPrediction = async (sensors: any) => {
    setIsPredicting(true);
    try {
      const { data, error } = await supabase.functions.invoke("fire-predictor", {
        body: {
          gas: sensors.gas,
          flame: sensors.flame,
          temperature: sensors.temperature,
          humidity: sensors.humidity,
          pir: sensors.pir,
        },
      });
      if (error) throw error;
      if (data?.success) {
        setPrediction(data.prediction);
      }
    } catch (error) {
      console.error("Error running prediction:", error);
    } finally {
      setIsPredicting(false);
    }
  };

  const handleRefresh = async () => {
    await fetchThingspeakData();
    toast({ title: "Sensors Updated", description: "Latest sensor readings fetched." });
  };

  const getSensorStatus = (type: string, value: number | string): "normal" | "warning" | "danger" => {
    if (type === "temperature") {
      const temp = typeof value === "number" ? value : parseFloat(String(value));
      if (temp > 45) return "danger";
      if (temp > 35) return "warning";
      return "normal";
    }
    if (type === "gas") {
      const gas = typeof value === "number" ? value : parseFloat(String(value));
      if (gas > 1000) return "danger";
      if (gas > 400) return "warning";
      return "normal";
    }
    if (type === "flame") {
      return value === "1" || value === 1 || value === "FLAME" ? "danger" : "normal";
    }
    if (type === "humidity") {
      const hum = typeof value === "number" ? value : parseFloat(String(value));
      if (hum < 20 || hum > 80) return "warning";
      return "normal";
    }
    return "normal";
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">Loading sensor data...</CardContent>
      </Card>
    );
  }

  if (!location) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No location with ThingSpeak integration found.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle className="text-lg">Live Sensor Readings</CardTitle>
            <MqttStatusBadge status={connectionStatus} />
            <FirePredictionBadge prediction={prediction} isLoading={isPredicting} />
          </div>
          <p className="text-sm text-muted-foreground">
            {location.name} - {location.region}
            {isUsingMqtt && <span className="ml-2 text-xs">(via MQTT)</span>}
            {!isUsingMqtt && <span className="ml-2 text-xs">(via ThingSpeak)</span>}
          </p>
          {lastUpdatedDisplay && (
            <p className="text-xs text-muted-foreground mt-1">Last updated: {lastUpdatedDisplay}</p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isUsingMqtt}>
          <RefreshCw className="h-4 w-4 mr-2" />
          {isUsingMqtt ? "Live" : "Refresh"}
        </Button>
      </CardHeader>
      <CardContent>
        {displayData ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <SensorCard
              title="Temperature"
              value={Number(displayData.temperature)?.toFixed(1) ?? "--"}
              unit="°C"
              icon={Thermometer}
              status={getSensorStatus("temperature", displayData.temperature)}
            />
            <SensorCard
              title="Gas Level"
              value={Number(displayData.gas)?.toFixed(0) ?? "--"}
              unit="ppm"
              icon={Wind}
              status={getSensorStatus("gas", displayData.gas)}
            />
            <SensorCard
              title="Flame Detected"
              value={String(displayData.flame) === "1" || displayData.flame === "FLAME" ? "Yes" : "No"}
              icon={Flame}
              status={getSensorStatus("flame", displayData.flame)}
            />
            <SensorCard
              title="Humidity"
              value={Number(displayData.humidity)?.toFixed(1) ?? "--"}
              unit="%"
              icon={Droplets}
              status={getSensorStatus("humidity", displayData.humidity)}
            />
            <SensorCard
              title="Motion (PIR)"
              value={String(displayData.pir) === "1" || String(displayData.pir) === "0" && displayData.pir === 0 ? "Detected" : "None"}
              icon={Activity}
              status={String(displayData.pir) === "0" ? "warning" : "normal"}
            />
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-4">
            Waiting for sensor data...
          </div>
        )}
      </CardContent>
    </Card>
  );
};

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MqttStatusBadge } from "@/components/MqttStatusBadge";
import { FirePredictionBadge, PredictionResult } from "@/components/FirePredictionBadge";
import { useMqtt } from "@/hooks/useMqtt";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Thermometer, Droplets, Flame, Wind, Eye } from "lucide-react";

interface SensorData {
  field1: number;
  field2: number;
  field3: string;
  field4: number;
  field5: string;
  created_at: string;
}

interface Location {
  id: string;
  name: string;
  region: string;
  thingspeak_channel_id: string;
  thingspeak_read_key: string;
}

const LocationsStatus = () => {
  const { toast } = useToast();
  const [locations, setLocations] = useState<Location[]>([]);
  const [sensorData, setSensorData] = useState<{ [key: string]: SensorData }>({});
  const [loading, setLoading] = useState(false);
  const [predictions, setPredictions] = useState<{ [key: string]: PredictionResult }>({});
  const [hasLiveData, setHasLiveData] = useState<{ [key: string]: boolean }>({});
  const [predictingIds, setPredictingIds] = useState<Set<string>>(new Set());
  const [lastDataTime, setLastDataTime] = useState<{ [key: string]: Date }>({});

  // MQTT for real-time updates
  const { sensorData: mqttData, connectionStatus, lastUpdated: mqttLastUpdated } = useMqtt();

  useEffect(() => {
    fetchLocations();
  }, []);

  // When MQTT data arrives, update the first location's sensor data
  useEffect(() => {
    if (mqttData && locations.length > 0) {
      const firstLocation = locations[0];
      setHasLiveData(prev => ({ ...prev, [firstLocation.id]: true }));
      setLastDataTime(prev => ({ ...prev, [firstLocation.id]: new Date() }));
      setSensorData(prev => ({
        ...prev,
        [firstLocation.id]: {
          field1: mqttData.temperature,
          field2: mqttData.humidity ?? 0,
          field3: mqttData.flame === 1 || mqttData.flame === "1" ? "FLAME" : "NO FLAME",
          field4: mqttData.gas,
          field5: String(mqttData.pir),
          created_at: new Date().toISOString(),
        }
      }));
      runPrediction(firstLocation.id, {
        gas: mqttData.gas,
        flame: mqttData.flame,
        temperature: mqttData.temperature,
        humidity: mqttData.humidity,
        pir: mqttData.pir,
      });
    }
  }, [mqttData]);

  // Check data freshness every 5 seconds - if data older than 30s, show NO FIRE
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setHasLiveData(prev => {
        const updated = { ...prev };
        for (const locId of Object.keys(updated)) {
          const lastTime = lastDataTime[locId];
          if (!lastTime || (now - lastTime.getTime()) > 30000) {
            updated[locId] = false;
          }
        }
        return updated;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [lastDataTime]);

  // Fallback: poll ThingSpeak when MQTT is disconnected
  useEffect(() => {
    if (connectionStatus !== "connected" && locations.length > 0) {
      const interval = setInterval(() => {
        locations.forEach(location => {
          if (location.thingspeak_channel_id && location.thingspeak_read_key) {
            fetchSensorData(location.id, location.name, location.thingspeak_channel_id, location.thingspeak_read_key);
          }
        });
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [connectionStatus, locations]);

  const fetchLocations = async () => {
    try {
      const { data, error } = await supabase.from("locations").select("*").order("name");
      if (error) throw error;
      setLocations(data || []);
      data?.forEach(location => {
        if (location.thingspeak_channel_id && location.thingspeak_read_key) {
          fetchSensorData(location.id, location.name, location.thingspeak_channel_id, location.thingspeak_read_key);
        }
      });
    } catch (error) {
      toast({ title: "Error fetching locations", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    }
  };

  const fetchSensorData = async (locationId: string, name: string, channelId: string, readKey: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('thingspeak-service', {
        body: { action: 'latest', location: { name, thingspeak_channel_id: channelId, thingspeak_read_key: readKey } }
      });
      if (error) throw error;
      if (data.success && data.data) {
        const sData = {
          field1: data.data.temperature || 0,
          field2: data.data.humidity || 0,
          field3: data.data.flame || 0,
          field4: data.data.gas || 0,
          field5: data.data.pir || 0,
          created_at: data.data.timestamp,
        };
        setSensorData(prev => ({ ...prev, [locationId]: sData }));
        setHasLiveData(prev => ({ ...prev, [locationId]: true }));
        runPrediction(locationId, {
          gas: data.data.gas, flame: data.data.flame, temperature: data.data.temperature,
          humidity: data.data.humidity, pir: data.data.pir,
        });
        evaluateAlerts(locationId);
      }
    } catch (error) {
      console.error(`Error fetching sensor data for ${locationId}:`, error);
    } finally {
      setLoading(false);
    }
  };

  const runPrediction = async (locationId: string, sensors: any) => {
    setPredictingIds(prev => new Set(prev).add(locationId));
    try {
      const { data, error } = await supabase.functions.invoke("fire-predictor", {
        body: sensors,
      });
      if (error) throw error;
      if (data?.success) {
        setPredictions(prev => ({ ...prev, [locationId]: data.prediction }));
      }
    } catch (error) {
      console.error("Prediction error:", error);
    } finally {
      setPredictingIds(prev => { const s = new Set(prev); s.delete(locationId); return s; });
    }
  };

  const evaluateAlerts = async (locationId: string) => {
    try {
      await supabase.functions.invoke('alert-manager', { body: { action: 'evaluate', locationId } });
    } catch (error) {
      console.error('Error calling alert-manager:', error);
    }
  };

  const refreshAll = () => {
    locations.forEach(location => {
      if (location.thingspeak_channel_id && location.thingspeak_read_key) {
        fetchSensorData(location.id, location.name, location.thingspeak_channel_id, location.thingspeak_read_key);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-3xl font-bold">Locations Status</h1>
            <MqttStatusBadge status={connectionStatus} />
          </div>
          <p className="text-muted-foreground">Real-time sensor data from all monitoring locations</p>
        </div>
        <Button onClick={refreshAll} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh All
        </Button>
      </div>

      <div className="grid gap-6">
        {locations.map(location => {
          const data = sensorData[location.id];
          const pred = hasLiveData[location.id] ? predictions[location.id] : "no_fire";
          const isPredicting = predictingIds.has(location.id);

          return (
            <Card key={location.id}>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div>
                      <CardTitle>{location.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{location.region}</p>
                    </div>
                    <FirePredictionBadge prediction={pred} isLoading={isPredicting} />
                  </div>
                  <Badge variant="outline">Channel: {location.thingspeak_channel_id}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {data ? (
                  <div className="grid gap-4 md:grid-cols-5">
                    <Card className="border-primary/20">
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-2 mb-2">
                          <Thermometer className="h-5 w-5 text-primary" />
                          <span className="font-medium">Temperature</span>
                        </div>
                        <p className="text-2xl font-bold">{data.field1}°C</p>
                      </CardContent>
                    </Card>
                    <Card className="border-primary/20">
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-2 mb-2">
                          <Droplets className="h-5 w-5 text-primary" />
                          <span className="font-medium">Humidity</span>
                        </div>
                        <p className="text-2xl font-bold">{data.field2}%</p>
                      </CardContent>
                    </Card>
                    <Card className={`border-primary/20 ${data.field3 === "FLAME" ? "bg-red-100 border-red-500" : ""}`}>
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-2 mb-2">
                          <Flame className={`h-5 w-5 ${data.field3 === "FLAME" ? "text-red-600" : "text-destructive"}`} />
                          <span className="font-medium">Flame</span>
                          {data.field3 === "FLAME" && (
                            <Badge variant="destructive" className="ml-auto animate-pulse">🚨 Flame Detected</Badge>
                          )}
                        </div>
                        <p className={`text-2xl font-bold ${data.field3 === "FLAME" ? "text-red-700" : ""}`}>
                          {data.field3 === "FLAME" ? "Detected" : "None"}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="border-primary/20">
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-2 mb-2">
                          <Wind className="h-5 w-5 text-status-warning" />
                          <span className="font-medium">Gas</span>
                        </div>
                        <p className="text-2xl font-bold">{data.field4}</p>
                      </CardContent>
                    </Card>
                    <Card className={`border-primary/20 ${data.field5 === "0" ? "bg-blue-100 border-blue-500" : ""}`}>
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-2 mb-2">
                          <Eye className={`h-5 w-5 ${data.field5 === "0" ? "text-blue-600" : "text-primary"}`} />
                          <span className="font-medium">PIR Motion</span>
                          {data.field5 === "0" && (
                            <Badge variant="default" className="ml-auto animate-pulse bg-blue-600">👁️ Motion Detected</Badge>
                          )}
                        </div>
                        <p className={`text-2xl font-bold ${data.field5 === "0" ? "text-blue-700" : ""}`}>
                          {data.field5 === "0" ? "Detected" : "None"}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">Loading sensor data...</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default LocationsStatus;

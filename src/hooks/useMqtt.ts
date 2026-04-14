import { useState, useEffect, useRef, useCallback } from "react";
import mqtt, { MqttClient } from "mqtt";

export interface MqttSensorData {
  gas: number;
  flame: number | string;
  temperature: number;
  humidity?: number;
  pir: number | string;
}

interface UseMqttOptions {
  brokerUrl?: string;
  topics?: string[];
  enabled?: boolean;
}

interface UseMqttReturn {
  sensorData: MqttSensorData | null;
  alertData: any | null;
  connectionStatus: "connecting" | "connected" | "disconnected" | "error";
  lastUpdated: Date | null;
}

const DEFAULT_BROKER = "wss://broker.hivemq.com:8884/mqtt";
const DEFAULT_TOPICS = ["firealarm/data", "firealarm/alert"];

export const useMqtt = ({
  brokerUrl = DEFAULT_BROKER,
  topics = DEFAULT_TOPICS,
  enabled = true,
}: UseMqttOptions = {}): UseMqttReturn => {
  const [sensorData, setSensorData] = useState<MqttSensorData | null>(null);
  const [alertData, setAlertData] = useState<any | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<UseMqttReturn["connectionStatus"]>("disconnected");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const clientRef = useRef<MqttClient | null>(null);

  useEffect(() => {
    if (!enabled) return;

    console.log("[MQTT] Connecting to", brokerUrl);
    setConnectionStatus("connecting");

    const client = mqtt.connect(brokerUrl, {
      reconnectPeriod: 5000,
      connectTimeout: 10000,
      clean: true,
      clientId: `fire-defence-${Math.random().toString(16).slice(2, 10)}`,
    });

    clientRef.current = client;

    client.on("connect", () => {
      console.log("[MQTT] Connected");
      setConnectionStatus("connected");

      // Subscribe to all topics
      topics.forEach((topic) => {
        client.subscribe(topic, { qos: 0 }, (err) => {
          if (err) {
            console.error(`[MQTT] Subscribe error for ${topic}:`, err);
          } else {
            console.log(`[MQTT] Subscribed to ${topic}`);
          }
        });
      });
    });

    client.on("message", (topic, message) => {
      try {
        const payload = JSON.parse(message.toString());
        console.log(`[MQTT] Message on ${topic}:`, payload);

        if (topic === "firealarm/data") {
          setSensorData({
            gas: Number(payload.gas) || 0,
            flame: payload.flame,
            temperature: Number(payload.temperature) || 0,
            humidity: payload.humidity != null ? Number(payload.humidity) : undefined,
            pir: payload.pir,
          });
          setLastUpdated(new Date());
        } else if (topic === "firealarm/alert") {
          setAlertData(payload);
        }
      } catch (e) {
        console.error("[MQTT] Failed to parse message:", e);
      }
    });

    client.on("error", (err) => {
      console.error("[MQTT] Error:", err);
      setConnectionStatus("error");
    });

    client.on("close", () => {
      console.log("[MQTT] Disconnected");
      setConnectionStatus("disconnected");
    });

    client.on("reconnect", () => {
      console.log("[MQTT] Reconnecting...");
      setConnectionStatus("connecting");
    });

    return () => {
      console.log("[MQTT] Cleaning up");
      client.end(true);
      clientRef.current = null;
    };
  }, [brokerUrl, enabled]);

  return { sensorData, alertData, connectionStatus, lastUpdated };
};

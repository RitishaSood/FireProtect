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

export interface MqttMessageLog {
  topic: string;
  payload: any;
  raw: string;
  receivedAt: Date;
}

interface UseMqttReturn {
  sensorData: MqttSensorData | null;
  alertData: any | null;
  connectionStatus: "connecting" | "connected" | "disconnected" | "error";
  lastUpdated: Date | null;
  brokerUrl: string;
  topics: string[];
  subscribedTopics: string[];
  messageLog: MqttMessageLog[];
  messagesByTopic: Record<string, number>;
  totalMessages: number;
  connectedAt: Date | null;
  lastError: string | null;
}

const DEFAULT_BROKER = "wss://broker.hivemq.com:8884/mqtt";
const DEFAULT_TOPICS = ["firealarm/data", "firealarm/alert"];
const MAX_LOG_ENTRIES = 50;

export const useMqtt = ({
  brokerUrl = DEFAULT_BROKER,
  topics = DEFAULT_TOPICS,
  enabled = true,
}: UseMqttOptions = {}): UseMqttReturn => {
  const [sensorData, setSensorData] = useState<MqttSensorData | null>(null);
  const [alertData, setAlertData] = useState<any | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<UseMqttReturn["connectionStatus"]>("disconnected");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [subscribedTopics, setSubscribedTopics] = useState<string[]>([]);
  const [messageLog, setMessageLog] = useState<MqttMessageLog[]>([]);
  const [messagesByTopic, setMessagesByTopic] = useState<Record<string, number>>({});
  const [totalMessages, setTotalMessages] = useState(0);
  const [connectedAt, setConnectedAt] = useState<Date | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const clientRef = useRef<MqttClient | null>(null);

  useEffect(() => {
    if (!enabled) return;

    console.log("[MQTT] Connecting to", brokerUrl);
    setConnectionStatus("connecting");
    setSubscribedTopics([]);

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
      setConnectedAt(new Date());
      setLastError(null);

      // Subscribe to all topics
      topics.forEach((topic) => {
        client.subscribe(topic, { qos: 0 }, (err) => {
          if (err) {
            console.error(`[MQTT] Subscribe error for ${topic}:`, err);
            setLastError(`Subscribe failed for ${topic}: ${err.message}`);
          } else {
            console.log(`[MQTT] Subscribed to ${topic}`);
            setSubscribedTopics((prev) =>
              prev.includes(topic) ? prev : [...prev, topic]
            );
          }
        });
      });
    });

    client.on("message", (topic, message) => {
      const raw = message.toString();
      try {
        const payload = JSON.parse(raw);
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

        const entry: MqttMessageLog = {
          topic,
          payload,
          raw,
          receivedAt: new Date(),
        };
        setMessageLog((prev) => [entry, ...prev].slice(0, MAX_LOG_ENTRIES));
        setMessagesByTopic((prev) => ({ ...prev, [topic]: (prev[topic] || 0) + 1 }));
        setTotalMessages((n) => n + 1);
      } catch (e) {
        console.error("[MQTT] Failed to parse message:", e);
        const entry: MqttMessageLog = {
          topic,
          payload: null,
          raw,
          receivedAt: new Date(),
        };
        setMessageLog((prev) => [entry, ...prev].slice(0, MAX_LOG_ENTRIES));
        setMessagesByTopic((prev) => ({ ...prev, [topic]: (prev[topic] || 0) + 1 }));
        setTotalMessages((n) => n + 1);
      }
    });

    client.on("error", (err) => {
      console.error("[MQTT] Error:", err);
      setConnectionStatus("error");
      setLastError(err?.message || String(err));
    });

    client.on("close", () => {
      console.log("[MQTT] Disconnected");
      setConnectionStatus("disconnected");
      setSubscribedTopics([]);
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

  return {
    sensorData,
    alertData,
    connectionStatus,
    lastUpdated,
    brokerUrl,
    topics,
    subscribedTopics,
    messageLog,
    messagesByTopic,
    totalMessages,
    connectedAt,
    lastError,
  };
};

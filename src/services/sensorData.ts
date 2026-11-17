import { supabase } from "@/integrations/supabase/client";
import { DYNAMODB_API_BASE_URL, SENSOR_DATA_SOURCE } from "@/config/sensorData";

export interface SensorLocation {
  id: string;
  name?: string;
  thingspeak_channel_id?: string | null;
  thingspeak_read_key?: string | null;
  deviceId?: string;
}

export interface SensorReading {
  temperature: number;
  humidity: number;
  flame: number | string;
  gas: number;
  pir: number | string;
  timestamp: string;
}

export interface SensorReadingResult {
  reading: SensorReading;
  raw: unknown;
}

export interface SensorHistoryReading extends SensorReading {}

type DataRecord = Record<string, unknown>;

const asRecord = (value: unknown): DataRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as DataRecord
    : {};

const firstDefined = (...values: unknown[]): unknown =>
  values.find((value) => value !== undefined && value !== null && value !== "");

const asNumber = (value: unknown): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const normalizeReading = (value: unknown): SensorReading => {
  const record = asRecord(value);
  const timestamp = firstDefined(record.eventTimestamp, record.timestamp, record.created_at);

  return {
    temperature: asNumber(firstDefined(record.temperature, record.field1)),
    humidity: asNumber(firstDefined(record.humidity, record.field2)),
    flame: (firstDefined(record.flame, record.field3) as number | string | undefined) ?? "",
    gas: asNumber(firstDefined(record.gas, record.field4)),
    pir: (firstDefined(record.pir, record.field5) as number | string | undefined) ?? "",
    timestamp: typeof timestamp === "string" ? timestamp : "",
  };
};

const getDeviceId = (location: SensorLocation): string =>
  location.deviceId || location.thingspeak_channel_id || location.id;

const getDynamoEndpoint = (path: string): string => {
  if (!DYNAMODB_API_BASE_URL) {
    throw new Error("DynamoDB mode is enabled, but VITE_DYNAMODB_API_URL is not configured.");
  }

  const baseUrl = DYNAMODB_API_BASE_URL.replace(/\/+$/, "");
  if (new URL(baseUrl).protocol !== "https:") {
    throw new Error("The DynamoDB API endpoint must use HTTPS.");
  }
  return `${baseUrl}${path}`;
};

const fetchDynamoJson = async (path: string): Promise<unknown> => {
  const response = await fetch(getDynamoEndpoint(path), {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Sensor API request failed (${response.status}).`);
  }
  return response.json();
};

const fetchDynamoLatest = async (location: SensorLocation): Promise<SensorReadingResult> => {
  const deviceId = encodeURIComponent(getDeviceId(location));
  const raw = await fetchDynamoJson(`/devices/${deviceId}/latest`);
  const body = asRecord(raw);
  const record = firstDefined(body.item, body.data, body.Item, raw);
  const latestRecord = Array.isArray(record) ? record[0] : record;
  return { reading: normalizeReading(latestRecord), raw };
};

const normalizeThingSpeakLatest = (value: unknown): SensorReadingResult => {
  const body = asRecord(value);
  const raw = body.data;
  const record = asRecord(raw);
  const reading = normalizeReading(record);

  return {
    reading: {
      ...reading,
      flame: record.flame ?? (String(record.field3) === "0" ? "FLAME" : "NONE"),
      pir: record.pir ?? record.field5 ?? "",
    },
    raw,
  };
};

const fetchThingSpeakLatestThroughCloud = async (
  location: SensorLocation,
): Promise<SensorReadingResult> => {
  const { data, error } = await supabase.functions.invoke("thingspeak-service", {
    body: {
      action: "latest",
      location: {
        name: location.name,
        thingspeak_channel_id: location.thingspeak_channel_id,
        thingspeak_read_key: location.thingspeak_read_key,
      },
    },
  });
  if (error) throw error;
  if (!data?.success || !data.data) {
    throw new Error(data?.error || "No sensor reading was returned.");
  }
  return normalizeThingSpeakLatest(data);
};

const fetchThingSpeakLatestDirect = async (
  location: SensorLocation,
): Promise<SensorReadingResult> => {
  if (!location.thingspeak_channel_id || !location.thingspeak_read_key) {
    throw new Error("This location does not have a ThingSpeak channel configured.");
  }

  const url = new URL(
    `https://api.thingspeak.com/channels/${encodeURIComponent(location.thingspeak_channel_id)}/feeds/last.json`,
  );
  url.searchParams.set("api_key", location.thingspeak_read_key);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`ThingSpeak request failed (${response.status}).`);

  const raw = await response.json() as DataRecord;
  const reading = normalizeReading({
    ...raw,
    flame: String(raw.field3) === "0" ? "FLAME" : "NONE",
    pir: raw.field5,
  });
  return { reading, raw };
};

/** Latest reading for the dashboard and location details. */
export const fetchLatestSensorData = (location: SensorLocation): Promise<SensorReadingResult> => {
  if (SENSOR_DATA_SOURCE === "dynamodb") return fetchDynamoLatest(location);
  return fetchThingSpeakLatestThroughCloud(location);
};

/** Latest reading for Locations Status, preserving its current direct ThingSpeak path. */
export const fetchLatestStatusSensorData = (location: SensorLocation): Promise<SensorReadingResult> => {
  if (SENSOR_DATA_SOURCE === "dynamodb") return fetchDynamoLatest(location);
  return fetchThingSpeakLatestDirect(location);
};

/** Historical readings for charts, normalized to the same sensor fields. */
export const fetchSensorHistory = async (
  location: SensorLocation,
  results = 50,
): Promise<SensorHistoryReading[]> => {
  if (SENSOR_DATA_SOURCE === "dynamodb") {
    const deviceId = encodeURIComponent(getDeviceId(location));
    const query = new URLSearchParams({ limit: String(results) });
    const raw = await fetchDynamoJson(`/devices/${deviceId}/events?${query.toString()}`);
    const body = asRecord(raw);
    const records = Array.isArray(raw)
      ? raw
      : firstDefined(body.items, body.events, body.Items, body.data);
    return Array.isArray(records) ? records.map(normalizeReading) : [];
  }

  const { data, error } = await supabase.functions.invoke("thingspeak-service", {
    body: {
      action: "history",
      location: {
        name: location.name,
        thingspeak_channel_id: location.thingspeak_channel_id,
        thingspeak_read_key: location.thingspeak_read_key,
      },
      results,
    },
  });
  if (error) throw error;
  if (!data?.success || !Array.isArray(data.data)) {
    throw new Error(data?.error || "No sensor history was returned.");
  }
  return data.data.map(normalizeReading);
};
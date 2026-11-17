export type SensorDataSource = "supabase" | "dynamodb";

// DynamoDB remains inactive unless the source is explicitly selected.
export const SENSOR_DATA_SOURCE: SensorDataSource =
  import.meta.env.VITE_SENSOR_DATA_SOURCE === "dynamodb" ? "dynamodb" : "supabase";

// Set this to the HTTPS base URL of the future API Gateway/Lambda service.
export const DYNAMODB_API_BASE_URL = import.meta.env.VITE_DYNAMODB_API_URL?.trim() ?? "";

export const FUTURE_DYNAMODB_SCHEMA = {
  tableName: "FireProtectEvents",
  region: "ap-southeast-2",
  partitionKey: "deviceId",
  sortKey: "eventTimestamp",
  fields: [
    "deviceId",
    "eventTimestamp",
    "temperature",
    "humidity",
    "gas",
    "flame",
    "pir",
    "prediction",
    "prediction_label",
  ],
} as const;
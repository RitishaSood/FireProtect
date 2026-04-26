import { useEffect, useState } from "react";
import { useMqtt } from "@/hooks/useMqtt";
import { MqttStatusBadge } from "@/components/MqttStatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Activity,
  Radio,
  Inbox,
  Server,
  Clock,
  AlertCircle,
  CheckCircle2,
  Send,
  Download,
  Cpu,
} from "lucide-react";

const formatUptime = (since: Date | null) => {
  if (!since) return "—";
  const ms = Date.now() - since.getTime();
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
};

const formatTime = (d: Date | null) =>
  d ? d.toLocaleTimeString(undefined, { hour12: false }) : "—";

const MqttStatus = () => {
  const {
    brokerUrl,
    topics,
    subscribedTopics,
    connectionStatus,
    connectedAt,
    lastUpdated,
    lastError,
    messageLog,
    messagesByTopic,
    totalMessages,
    sensorData,
    alertData,
  } = useMqtt();

  // Tick once a second so uptime stays fresh
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const isConnected = connectionStatus === "connected";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold">MQTT Broker Status</h1>
            <MqttStatusBadge status={connectionStatus} />
          </div>
          <p className="text-muted-foreground">
            Live view of broker connection, subscriptions and message flow
          </p>
        </div>
      </div>

      {/* Top metric cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Activity className="h-4 w-4" />
              <span className="text-sm font-medium">Status</span>
            </div>
            <p className="text-2xl font-bold capitalize">{connectionStatus}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-sm font-medium">Uptime</span>
            </div>
            <p className="text-2xl font-bold">
              {isConnected ? formatUptime(connectedAt) : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Inbox className="h-4 w-4" />
              <span className="text-sm font-medium">Messages received</span>
            </div>
            <p className="text-2xl font-bold">{totalMessages}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Radio className="h-4 w-4" />
              <span className="text-sm font-medium">Last message</span>
            </div>
            <p className="text-2xl font-bold">{formatTime(lastUpdated)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Broker info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" />
            Broker Connection
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Broker URL
              </p>
              <p className="font-mono text-sm break-all">{brokerUrl}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Protocol
              </p>
              <p className="font-mono text-sm">MQTT over secure WebSocket (WSS)</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Connected at
              </p>
              <p className="font-mono text-sm">
                {connectedAt ? connectedAt.toLocaleString() : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                QoS
              </p>
              <p className="font-mono text-sm">0 (at most once)</p>
            </div>
          </div>

          {lastError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive">Last error</p>
                <p className="text-xs text-muted-foreground font-mono">{lastError}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pub/Sub flow */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              Publishers
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3 rounded-md border border-border p-3">
              <Cpu className="h-5 w-5 text-primary mt-0.5" />
              <div className="flex-1">
                <p className="font-medium">ESP32 / IoT sensor node</p>
                <p className="text-xs text-muted-foreground">
                  Publishes sensor readings and alerts to the broker
                </p>
                <div className="mt-2 flex gap-2 flex-wrap">
                  {topics.map((t) => (
                    <Badge key={t} variant="outline" className="font-mono text-xs">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Publishers send JSON payloads to topics. They never address subscribers
              directly — the broker handles routing.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" />
              Subscribers
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3 rounded-md border border-border p-3">
              <Activity className="h-5 w-5 text-primary mt-0.5" />
              <div className="flex-1">
                <p className="font-medium">This web client</p>
                <p className="text-xs text-muted-foreground">
                  Browser session subscribed via mqtt.js
                </p>
                <div className="mt-2 flex gap-2 flex-wrap">
                  {topics.map((t) => {
                    const ok = subscribedTopics.includes(t);
                    return (
                      <Badge
                        key={t}
                        variant={ok ? "default" : "outline"}
                        className="font-mono text-xs flex items-center gap-1"
                      >
                        {ok ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <AlertCircle className="h-3 w-3" />
                        )}
                        {t}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Subscribers receive every message the broker matches against their topic
              filters, in real time.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Per-topic stats */}
      <Card>
        <CardHeader>
          <CardTitle>Topic Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {topics.map((t) => (
              <div
                key={t}
                className="flex items-center justify-between rounded-md border border-border p-3"
              >
                <div>
                  <p className="font-mono text-sm">{t}</p>
                  <p className="text-xs text-muted-foreground">
                    {subscribedTopics.includes(t)
                      ? "Subscribed"
                      : "Not subscribed"}
                  </p>
                </div>
                <Badge variant="secondary" className="text-base">
                  {messagesByTopic[t] || 0}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Latest payloads */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Latest Sensor Payload</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs font-mono bg-muted/50 rounded-md p-3 overflow-auto max-h-64">
{sensorData ? JSON.stringify(sensorData, null, 2) : "// no data yet"}
            </pre>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Latest Alert Payload</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs font-mono bg-muted/50 rounded-md p-3 overflow-auto max-h-64">
{alertData ? JSON.stringify(alertData, null, 2) : "// no alert yet"}
            </pre>
          </CardContent>
        </Card>
      </div>

      {/* Live message log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Live Message Log
            <Badge variant="outline" className="ml-2">
              last {messageLog.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {messageLog.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Waiting for messages…
            </p>
          ) : (
            <ScrollArea className="h-80 pr-3">
              <div className="space-y-2">
                {messageLog.map((m, i) => (
                  <div
                    key={i}
                    className="rounded-md border border-border p-3 text-xs font-mono"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="outline" className="font-mono">
                        {m.topic}
                      </Badge>
                      <span className="text-muted-foreground">
                        {m.receivedAt.toLocaleTimeString(undefined, { hour12: false })}
                      </span>
                    </div>
                    <Separator className="my-1" />
                    <pre className="whitespace-pre-wrap break-all">
{m.payload != null ? JSON.stringify(m.payload) : m.raw}
                    </pre>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MqttStatus;
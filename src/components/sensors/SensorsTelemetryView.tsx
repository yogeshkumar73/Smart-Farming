import React, { useState } from 'react';
import {
  Activity,
  Cpu,
  Plus,
  RefreshCw,
  Send,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  DeviceTelemetryPayload,
  Field,
  SensorDevice,
  SensorReading,
} from '../../types/agriculture';

interface SensorsTelemetryViewProps {
  sensors: SensorDevice[];
  readings: SensorReading[];
  fields: Field[];
  selectedFieldId: string;
  onIngestTelemetry: (
    payload: Partial<DeviceTelemetryPayload> & {
      transport?: 'mqtt' | 'http_fallback';
      forced_confidence?: number;
    }
  ) => Promise<{ ok: boolean; message: string }>;
  onSyncOfflineBuffer: (
    events: Partial<DeviceTelemetryPayload>[]
  ) => Promise<{ acceptedCount: number; duplicatesSkippedCount: number }>;
  onRegisterSensor: (input: {
    device_id: string;
    field_id: string;
    firmware_version: string;
    moisture_offset: number;
    temperature_offset: number;
  }) => Promise<{ ok: boolean; message: string }>;
}

export const SensorsTelemetryView: React.FC<SensorsTelemetryViewProps> = ({
  sensors,
  readings,
  fields,
  selectedFieldId,
  onIngestTelemetry,
  onSyncOfflineBuffer,
  onRegisterSensor,
}) => {
  const defaultSensor =
    sensors.find((s) => s.fieldId === selectedFieldId) || sensors[0];
  const [deviceId, setDeviceId] = useState(defaultSensor?.deviceId || 'ESP32-001');
  const [fieldId, setFieldId] = useState(defaultSensor?.fieldId || 'FIELD-001');
  const [sequence, setSequence] = useState(1046);
  const [soilMoisture, setSoilMoisture] = useState(17.2);
  const [temperature, setTemperature] = useState(33.8);
  const [humidity, setHumidity] = useState(64.5);
  const [rainfall, setRainfall] = useState(0);
  const [ph, setPh] = useState(6.7);
  const [nitrogen, setNitrogen] = useState(41);
  const [phosphorus, setPhosphorus] = useState(27);
  const [potassium, setPotassium] = useState(35);
  const [transport, setTransport] = useState<'mqtt' | 'http_fallback'>('mqtt');
  const [simulateLowConfidence, setSimulateLowConfidence] = useState(false);
  const [ingestionFeedback, setIngestionFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [isSending, setIsSending] = useState(false);

  // Register New Sensor Form State
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [newDeviceId, setNewDeviceId] = useState('ESP32-004');
  const [newFieldId, setNewFieldId] = useState(fields[0]?.id || 'FIELD-001');
  const [newMoistureOffset, setNewMoistureOffset] = useState(0.2);
  const [newTempOffset, setNewTempOffset] = useState(0.0);
  const [registerFeedback, setRegisterFeedback] = useState<string | null>(null);

  const handlePublishTelemetry = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);
    setIngestionFeedback(null);
    try {
      const res = await onIngestTelemetry({
        device_id: deviceId,
        field_id: fieldId,
        timestamp: new Date().toISOString(),
        sequence: Number(sequence),
        soil_moisture: Number(soilMoisture),
        temperature: Number(temperature),
        humidity: Number(humidity),
        rainfall: Number(rainfall),
        ph: Number(ph),
        nitrogen: Number(nitrogen),
        phosphorus: Number(phosphorus),
        potassium: Number(potassium),
        firmware_version: '1.0.4',
        transport,
        forced_confidence: simulateLowConfidence ? 0.56 : undefined,
      });
      if (res.ok) {
        setSequence((prev) => prev + 1);
        setIngestionFeedback({ type: 'success', text: res.message });
      } else {
        setIngestionFeedback({ type: 'error', text: res.message });
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleReplayOfflineBuffer = async () => {
    setIsSending(true);
    setIngestionFeedback(null);
    try {
      const now = Date.now();
      const batch: Partial<DeviceTelemetryPayload>[] = [
        // Include an already-existing sequence #1045 to prove idempotent deduplication
        {
          device_id: 'ESP32-001',
          field_id: 'FIELD-001',
          timestamp: new Date(now - 240000).toISOString(),
          sequence: 1045,
          soil_moisture: 19.8,
          temperature: 32.4,
          humidity: 68.5,
          rainfall: 0,
          firmware_version: '1.0.4',
        },
        // And two buffered offline events from ESP32-003 (bringing it back online from STALE)
        {
          device_id: 'ESP32-003',
          field_id: 'FIELD-003',
          timestamp: new Date(now - 60000).toISOString(),
          sequence: 3009,
          soil_moisture: 30.4,
          temperature: 31.1,
          humidity: 79.0,
          rainfall: 0,
          ph: 6.3,
          nitrogen: 39,
          phosphorus: 25,
          potassium: 32,
          firmware_version: '1.0.2',
        },
        {
          device_id: 'ESP32-003',
          field_id: 'FIELD-003',
          timestamp: new Date(now - 5000).toISOString(),
          sequence: 3010,
          soil_moisture: 29.8,
          temperature: 31.4,
          humidity: 78.2,
          rainfall: 0,
          ph: 6.3,
          nitrogen: 39,
          phosphorus: 25,
          potassium: 32,
          firmware_version: '1.0.2',
        },
      ];
      const summary = await onSyncOfflineBuffer(batch);
      setIngestionFeedback({
        type: 'success',
        text: `Offline Buffer Replay Complete: ${summary.acceptedCount} new buffered events stored in time order; ${summary.duplicatesSkippedCount} duplicate sequence event(s) safely ignored (QoS 1 idempotency). ESP32-003 is now ONLINE.`,
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await onRegisterSensor({
      device_id: newDeviceId.trim(),
      field_id: newFieldId,
      firmware_version: '1.0.4',
      moisture_offset: Number(newMoistureOffset),
      temperature_offset: Number(newTempOffset),
    });
    setRegisterFeedback(res.message);
    if (res.ok) {
      setShowRegisterForm(false);
    }
  };

  const filteredReadings =
    selectedFieldId === 'all'
      ? readings
      : readings.filter((r) => r.fieldId === selectedFieldId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-slate-200">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            ESP32 Sensor Nodes, MQTT Telemetry & Offline Buffer Sync
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Blueprint Section 4.1–4.4: Sensor read → calibration → range validation → timestamp freshness → MQTT QoS 1 deduplication → feature builder.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleReplayOfflineBuffer}
            disabled={isSending}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-emerald-700" />
            Replay ESP32 Offline Buffer (QoS 1 Sync)
          </button>

          <button
            type="button"
            onClick={() => setShowRegisterForm((prev) => !prev)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Pair ESP32 Node
          </button>
        </div>
      </div>

      {registerFeedback && (
        <div className="p-3 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-800">
          {registerFeedback}
        </div>
      )}

      {showRegisterForm && (
        <form
          onSubmit={handleRegisterSubmit}
          className="bg-white p-5 rounded-xl border border-slate-300 grid grid-cols-1 md:grid-cols-4 gap-4 items-end"
        >
          <div>
            <label
              htmlFor="new-device-id"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Device ID *
            </label>
            <input
              id="new-device-id"
              type="text"
              required
              minLength={3}
              value={newDeviceId}
              onChange={(e) => setNewDeviceId(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>
          <div>
            <label
              htmlFor="new-device-field"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Assigned Field
            </label>
            <select
              id="new-device-field"
              value={newFieldId}
              onChange={(e) => setNewFieldId(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            >
              {fields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.id} — {f.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="new-moisture-offset"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Moisture Calibration Offset (%)
            </label>
            <input
              id="new-moisture-offset"
              type="number"
              step="0.1"
              value={newMoistureOffset}
              onChange={(e) => setNewMoistureOffset(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 cursor-pointer"
            >
              Register Device
            </button>
            <button
              type="button"
              onClick={() => setShowRegisterForm(false)}
              className="px-3 py-2 text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Registered ESP32 Devices Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {sensors.map((s) => {
          const isStale = s.status === 'stale' || s.status === 'offline';
          return (
            <div
              key={s.id}
              className="bg-white p-5 rounded-xl border border-slate-200 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-slate-700" />
                  <h3 className="text-base font-bold text-slate-900 font-mono">
                    {s.deviceId}
                  </h3>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                    isStale ? 'text-amber-700' : 'text-emerald-700'
                  }`}
                >
                  {isStale ? (
                    <WifiOff className="w-3.5 h-3.5" />
                  ) : (
                    <Wifi className="w-3.5 h-3.5" />
                  )}
                  {s.status.toUpperCase()}
                </span>
              </div>

              <div className="text-xs text-slate-600 space-y-1 font-mono tabular-nums">
                <div>Topic: {s.mqttTopic}</div>
                <div>
                  Field: {s.fieldId} · FW: v{s.firmwareVersion}
                </div>
                <div>
                  Calibration: Moisture {s.calibration.moistureOffset >= 0 ? '+' : ''}
                  {s.calibration.moistureOffset}% · Temp {s.calibration.temperatureOffset >= 0 ? '+' : ''}
                  {s.calibration.temperatureOffset}°C
                </div>
                <div>
                  Signal: {s.signalRssiDbm} dBm · Battery: {s.batteryPct}%
                </div>
                <div className={isStale ? 'text-amber-800 font-semibold' : 'text-slate-500'}>
                  Last Seen: {new Date(s.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Live Telemetry Ingestion & Decision Engine Simulator (Section 4.2 Contract) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={handlePublishTelemetry}
          className="lg:col-span-5 bg-white p-5 rounded-xl border border-slate-200 space-y-4"
        >
          <div className="pb-3 border-b border-slate-200">
            <h3 className="text-base font-bold text-slate-900">
              Publish Device Telemetry Event (Section 4.2 Contract)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Inject an MQTT or HTTP fallback reading to trigger schema validation, calibration, ML prediction, and alert/task generation.
            </p>
          </div>

          {ingestionFeedback && (
            <div
              role="status"
              className={`p-3 rounded-lg text-xs border ${
                ingestionFeedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-red-50 border-red-200 text-red-900'
              }`}
            >
              {ingestionFeedback.text}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="sim-device-id"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Device ID
              </label>
              <select
                id="sim-device-id"
                value={deviceId}
                onChange={(e) => {
                  const dev = sensors.find((s) => s.deviceId === e.target.value);
                  setDeviceId(e.target.value);
                  if (dev) setFieldId(dev.fieldId);
                }}
                className="w-full px-3 py-1.5 text-xs font-mono border border-slate-300 rounded-lg"
              >
                {sensors.map((s) => (
                  <option key={s.id} value={s.deviceId}>
                    {s.deviceId} ({s.fieldId})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="sim-sequence"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Sequence # (Dedup Key) *
              </label>
              <input
                id="sim-sequence"
                type="number"
                required
                value={sequence}
                onChange={(e) => setSequence(Number(e.target.value))}
                className="w-full px-3 py-1.5 text-xs font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label
                htmlFor="sim-moisture"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Soil Moisture (%) *
              </label>
              <input
                id="sim-moisture"
                type="number"
                step="0.1"
                required
                value={soilMoisture}
                onChange={(e) => setSoilMoisture(Number(e.target.value))}
                className="w-full px-3 py-1.5 text-xs font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label
                htmlFor="sim-temp"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Temperature (°C) *
              </label>
              <input
                id="sim-temp"
                type="number"
                step="0.1"
                required
                value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value))}
                className="w-full px-3 py-1.5 text-xs font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label
                htmlFor="sim-humidity"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Humidity (%) *
              </label>
              <input
                id="sim-humidity"
                type="number"
                step="0.1"
                required
                value={humidity}
                onChange={(e) => setHumidity(Number(e.target.value))}
                className="w-full px-3 py-1.5 text-xs font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label
                htmlFor="sim-rainfall"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Rainfall (mm)
              </label>
              <input
                id="sim-rainfall"
                type="number"
                step="0.1"
                value={rainfall}
                onChange={(e) => setRainfall(Number(e.target.value))}
                className="w-full px-3 py-1.5 text-xs font-mono tabular-nums border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label
                htmlFor="sim-ph"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Soil pH
              </label>
              <input
                id="sim-ph"
                type="number"
                step="0.1"
                value={ph}
                onChange={(e) => setPh(Number(e.target.value))}
                className="w-full px-3 py-1.5 text-xs font-mono tabular-nums border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label
                htmlFor="sim-transport"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Ingestion Transport
              </label>
              <select
                id="sim-transport"
                value={transport}
                onChange={(e) => setTransport(e.target.value as 'mqtt' | 'http_fallback')}
                className="w-full px-3 py-1.5 text-xs font-mono border border-slate-300 rounded-lg"
              >
                <option value="mqtt">MQTT Broker (QoS 1)</option>
                <option value="http_fallback">HTTP POST Fallback</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              id="sim-low-conf"
              type="checkbox"
              checked={simulateLowConfidence}
              onChange={(e) => setSimulateLowConfidence(e.target.checked)}
              className="w-4 h-4 accent-emerald-700 rounded"
            />
            <label htmlFor="sim-low-conf" className="text-xs text-slate-600">
              Test Confidence Gate (Force ML confidence to 56% &lt; 70% threshold → blocks high-impact alert)
            </label>
          </div>

          <button
            type="submit"
            disabled={isSending}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            {isSending ? 'Ingesting & Running Decision Engine...' : 'Ingest Telemetry & Run Decision Engine'}
          </button>
        </form>

        {/* High-Density Telemetry Ledger */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-700" />
              <h3 className="text-base font-bold text-slate-900">
                Validated Telemetry Stream ({filteredReadings.length} records)
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              Unique Index: (device_id, sequence)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                  <th className="py-2.5 px-4">Device / Seq</th>
                  <th className="py-2.5 px-3">Field</th>
                  <th className="py-2.5 px-3 text-right">Moisture</th>
                  <th className="py-2.5 px-3 text-right">Temp / Hum</th>
                  <th className="py-2.5 px-3 text-right">pH / NPK</th>
                  <th className="py-2.5 px-3">Validation</th>
                  <th className="py-2.5 px-4 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs font-mono tabular-nums">
                {filteredReadings.slice(0, 12).map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-4 font-semibold text-slate-900">
                      {r.deviceId} <span className="text-slate-400">#{r.sequence}</span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">{r.fieldId}</td>
                    <td className="py-2.5 px-3 text-right font-semibold text-slate-900">
                      {r.soilMoisture.toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-700">
                      {r.temperature.toFixed(1)}°C / {r.humidity.toFixed(0)}%
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-600">
                      {r.ph ?? '—'} · {r.nitrogen ?? '—'}/{r.phosphorus ?? '—'}/{r.potassium ?? '—'}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={
                          r.validationStatus === 'valid'
                            ? 'text-emerald-700 font-semibold'
                            : 'text-amber-700 font-semibold'
                        }
                      >
                        {r.validationStatus.toUpperCase()}
                      </span>
                      <span className="text-slate-400"> · {r.transport}</span>
                    </td>
                    <td className="py-2.5 px-4 text-right text-slate-500">
                      {new Date(r.eventTimestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

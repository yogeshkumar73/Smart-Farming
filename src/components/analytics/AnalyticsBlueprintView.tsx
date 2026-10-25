import React from 'react';
import { BarChart3, FileText, ShieldCheck } from 'lucide-react';
import {
  AlertRecord,
  CollaborativeTask,
  Field,
  SensorReading,
} from '../../types/agriculture';

interface AnalyticsBlueprintViewProps {
  fields: Field[];
  readings: SensorReading[];
  alerts: AlertRecord[];
  tasks: CollaborativeTask[];
  selectedFieldId: string;
}

export const AnalyticsBlueprintView: React.FC<AnalyticsBlueprintViewProps> = ({
  fields,
  readings,
  alerts,
  tasks,
  selectedFieldId,
}) => {
  const activeField =
    fields.find((f) => f.id === selectedFieldId) || fields[0];
  const fieldReadings = readings
    .filter((r) => r.fieldId === activeField.id)
    .slice(0, 10)
    .reverse();

  // Build SVG polyline points for Soil Moisture & Temperature
  const chartWidth = 640;
  const chartHeight = 180;
  const points = fieldReadings.map((r, i) => {
    const x =
      fieldReadings.length <= 1
        ? chartWidth / 2
        : (i / (fieldReadings.length - 1)) * (chartWidth - 60) + 30;
    const yMoisture = chartHeight - 25 - (Math.min(60, Math.max(0, r.soilMoisture)) / 60) * (chartHeight - 50);
    const yTemp = chartHeight - 25 - (Math.min(60, Math.max(0, r.temperature)) / 60) * (chartHeight - 50);
    return { x, yMoisture, yTemp, reading: r };
  });

  const moisturePolyline = points.map((p) => `${p.x},${p.yMoisture}`).join(' ');
  const tempPolyline = points.map((p) => `${p.x},${p.yTemp}`).join(' ');
  const thresholdY =
    chartHeight -
    25 -
    (Math.min(60, Math.max(0, activeField.moistureThreshold)) / 60) * (chartHeight - 50);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Field Telemetry Trends & Engineering Blueprint Reference
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Blueprint Section 11 & 18: Historical moisture vs. threshold trends, task resolution metrics, and direct reference to the uploaded Engineering Blueprint v1.1.
          </p>
        </div>

        <a
          href="/assets/aistudio/Smart_Precision_Agriculture_Full_HLD_LLD_Blueprint_38164264.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
        >
          <FileText className="w-4 h-4 text-emerald-700" />
          Open Uploaded HLD/LLD Blueprint PDF
        </a>
      </div>

      {/* Historical Telemetry Trend Chart */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-emerald-700" />
              Soil Moisture (%) & Canopy Temperature (°C) — {activeField.name} ({activeField.crop})
            </h3>
            <p className="text-xs text-slate-500">
              Dashed amber line marks the configured {activeField.moistureThreshold}% moisture threshold for {activeField.growthStage} stage.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="text-emerald-700 font-semibold">— Soil Moisture (%)</span>
            <span className="text-slate-600 font-semibold">— Temperature (°C)</span>
            <span className="text-amber-700 font-semibold">-- Threshold ({activeField.moistureThreshold}%)</span>
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full h-48 bg-slate-50 rounded-lg border border-slate-200"
            role="img"
            aria-label={`Telemetry trend chart for ${activeField.name}`}
          >
            {/* Threshold line */}
            <line
              x1={20}
              y1={thresholdY}
              x2={chartWidth - 20}
              y2={thresholdY}
              stroke="#d97706"
              strokeWidth="1.5"
              strokeDasharray="5,5"
            />
            {points.length > 1 && (
              <>
                <polyline
                  fill="none"
                  stroke="#475569"
                  strokeWidth="2"
                  points={tempPolyline}
                />
                <polyline
                  fill="none"
                  stroke="#047857"
                  strokeWidth="2.5"
                  points={moisturePolyline}
                />
              </>
            )}
            {points.map((p, idx) => (
              <g key={idx}>
                <circle cx={p.x} cy={p.yMoisture} r="4" fill="#047857" />
                <text
                  x={p.x}
                  y={p.yMoisture - 8}
                  textAnchor="middle"
                  className="text-[10px] fill-emerald-800 font-mono"
                >
                  {p.reading.soilMoisture}%
                </text>
                <circle cx={p.x} cy={p.yTemp} r="3" fill="#475569" />
                <text
                  x={p.x}
                  y={chartHeight - 6}
                  textAnchor="middle"
                  className="text-[9px] fill-slate-500 font-mono"
                >
                  #{p.reading.sequence}
                </text>
              </g>
            ))}
          </svg>
        </div>

        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>
            <strong>Agronomic Governance Note (Section 2 & 11):</strong> Guaranteed yield/cost analytics are intentionally omitted where multi-season field harvest source data is not yet verified.
          </span>
        </div>
      </div>

      {/* Embedded Blueprint Summary & Checklist */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-3">
          <h3 className="text-base font-bold text-slate-900">
            Blueprint v1.1 Architecture & Definition of Done Verification
          </h3>
          <ul className="space-y-2 text-xs text-slate-700 list-disc pl-4">
            <li>
              <strong>8-Stage Operational Pipeline:</strong> Sense → Validate → Store → Understand → Predict → Decide → Alert → Learn.
            </li>
            <li>
              <strong>Telemetry Deduplication & Offline Sync:</strong> Unique compound key on <code>(device_id, sequence)</code> with QoS 1 replay and stale reading detection (&gt;60m flagged stale).
            </li>
            <li>
              <strong>Confidence Gate & Decision Engine:</strong> Predictions below <code>0.70</code> confidence are marked <code>needs_review</code> and blocked from triggering high-impact alerts.
            </li>
            <li>
              <strong>Real-Time Collaborative Tasks:</strong> WebSocket + Firebase Firestore synchronization with human safety interlocks before completing irrigation/actuation tasks.
            </li>
          </ul>
          <div className="pt-2 text-xs font-mono tabular-nums text-slate-500">
            Total Readings: {readings.length} · Active Alerts: {alerts.filter((a) => a.status !== 'resolved').length} · Collaborative Tasks: {tasks.length}
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-3">
          <h3 className="text-base font-bold text-slate-900">
            Uploaded Engineering Blueprint Document Preview
          </h3>
          <object
            data="/assets/aistudio/Smart_Precision_Agriculture_Full_HLD_LLD_Blueprint_38164264.pdf"
            type="application/pdf"
            className="w-full h-56 rounded-lg border border-slate-200 bg-slate-50"
            aria-label="Smart Precision Agriculture Engineering Blueprint PDF"
          >
            <div className="p-6 text-center text-xs text-slate-600 space-y-2">
              <p> Blueprint PDF ready for viewing.</p>
              <a
                href="/assets/aistudio/Smart_Precision_Agriculture_Full_HLD_LLD_Blueprint_38164264.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold text-emerald-700"
              >
                Download Smart_Precision_Agriculture_Full_HLD_LLD_Blueprint_38164264.pdf
              </a>
            </div>
          </object>
        </div>
      </div>
    </div>
  );
};

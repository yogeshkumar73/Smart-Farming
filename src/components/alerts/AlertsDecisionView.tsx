import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  MessageSquarePlus,
  ShieldCheck,
  ThumbsUp,
} from 'lucide-react';
import {
  AlertRecord,
  AlertStatus,
  FarmerFeedbackLabel,
  FeedbackRecord,
  Field,
  PredictionRecord,
} from '../../types/agriculture';

interface AlertsDecisionViewProps {
  alerts: AlertRecord[];
  predictions: PredictionRecord[];
  feedbackList: FeedbackRecord[];
  fields: Field[];
  selectedFieldId: string;
  onUpdateAlertStatus: (alertId: string, status: AlertStatus) => Promise<void>;
  onSubmitFeedback: (input: {
    prediction_id: string;
    field_id: string;
    farmer_label: FarmerFeedbackLabel;
    comment: string;
  }) => Promise<void>;
  onCreateTaskFromAlert: (alert: AlertRecord) => Promise<void>;
}

export const AlertsDecisionView: React.FC<AlertsDecisionViewProps> = ({
  alerts,
  predictions,
  feedbackList,
  fields,
  selectedFieldId,
  onUpdateAlertStatus,
  onSubmitFeedback,
  onCreateTaskFromAlert,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | AlertStatus>('all');
  const [activeFeedbackAlertId, setActiveFeedbackAlertId] = useState<string | null>(null);
  const [farmerLabel, setFarmerLabel] = useState<FarmerFeedbackLabel>('accurate_helpful');
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  const filteredAlerts = alerts.filter((a) => {
    if (selectedFieldId !== 'all' && a.fieldId !== selectedFieldId) return false;
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    return true;
  });

  const handleFeedbackSubmit = async (e: React.FormEvent, alert: AlertRecord) => {
    e.preventDefault();
    if (!feedbackComment.trim()) return;
    await onSubmitFeedback({
      prediction_id: alert.predictionId,
      field_id: alert.fieldId,
      farmer_label: farmerLabel,
      comment: feedbackComment.trim(),
    });
    setFeedbackComment('');
    setActiveFeedbackAlertId(null);
    setFeedbackNotice(
      `Farmer feedback recorded for prediction ${alert.predictionId} (stored as candidate evaluation label per Blueprint Section 9).`
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Alert & Recommendation Engine + Farmer Feedback Loop
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Blueprint Section 10: Every alert explains what was observed, why it matters, model confidence/limitations, and a plain-language next step.
          </p>
        </div>

        <div
          className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start"
          role="group"
          aria-label="Filter alerts by status"
        >
          {(
            [
              { id: 'all', label: `All Alerts (${alerts.length})` },
              { id: 'active', label: 'Active' },
              { id: 'acknowledged', label: 'Acknowledged' },
              { id: 'resolved', label: 'Resolved' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {feedbackNotice && (
        <div
          role="status"
          className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between"
        >
          <span>{feedbackNotice}</span>
          <button
            type="button"
            onClick={() => setFeedbackNotice(null)}
            className="font-semibold underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Alerts List */}
      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-200">
        {filteredAlerts.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No alerts match the selected filter.
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const fieldObj = fields.find((f) => f.id === alert.fieldId);
            return (
              <div key={alert.id} className="p-5 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="space-y-2 max-w-3xl">
                    {/* Unboxed inline metadata per Zero-Pill Rule */}
                    <div className="flex flex-wrap items-center gap-2 text-xs font-mono tabular-nums text-slate-500">
                      <span
                        className={
                          alert.severity === 'high'
                            ? 'text-red-700 font-bold'
                            : alert.severity === 'medium'
                            ? 'text-amber-700 font-bold'
                            : 'text-slate-700 font-semibold'
                        }
                      >
                        SEVERITY: {alert.severity.toUpperCase()}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-semibold text-slate-800">
                        Status: {alert.status.toUpperCase()}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        Field: {fieldObj ? `${fieldObj.name} (${fieldObj.crop})` : alert.fieldId}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>Confidence: {Math.round(alert.confidence * 100)}%</span>
                      <span aria-hidden="true">·</span>
                      <span>Model: {alert.modelVersion}</span>
                      <span aria-hidden="true">·</span>
                      <span>Deduplicated Count: {alert.occurrenceCount}×</span>
                    </div>

                    {/* Plain language Recommended Next Action FIRST per Section 11 */}
                    <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                      <div className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Recommended Next Action (Farmer-First Guidance):
                      </div>
                      <p className="text-sm font-semibold text-slate-900">
                        {alert.recommendation}
                      </p>
                    </div>

                    <div className="space-y-1 text-xs text-slate-700">
                      <p>
                        <strong className="text-slate-900">What was observed:</strong> {alert.message}
                      </p>
                      <p>
                        <strong className="text-slate-900">Why it matters:</strong> {alert.whyItMatters}
                      </p>
                      <p className="text-slate-500">
                        <strong className="text-slate-700">Advisory Limitations:</strong> {alert.limitations}
                      </p>
                    </div>

                    <div className="text-[11px] font-mono text-slate-500 pt-1">
                      Delivery Channels: In-App ({alert.deliveryStatus.inApp}) · Push ({alert.deliveryStatus.push}) · SMS ({alert.deliveryStatus.sms})
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap lg:flex-col items-end gap-2 shrink-0">
                    {alert.status === 'active' && (
                      <button
                        type="button"
                        onClick={() => onUpdateAlertStatus(alert.id, 'acknowledged')}
                        className="px-3.5 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Acknowledge Alert
                      </button>
                    )}
                    {alert.status !== 'resolved' && (
                      <button
                        type="button"
                        onClick={() => onUpdateAlertStatus(alert.id, 'resolved')}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        Mark Resolved
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onCreateTaskFromAlert(alert)}
                      className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Assign Crew Task
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveFeedbackAlertId((prev) =>
                          prev === alert.id ? null : alert.id
                        )
                      }
                      className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-900 pt-1 cursor-pointer"
                    >
                      <MessageSquarePlus className="w-3.5 h-3.5" />
                      Submit Farmer Feedback
                    </button>
                  </div>
                </div>

                {/* Expandable Farmer Feedback Form (Section 5.2 Step 9: Learn) */}
                {activeFeedbackAlertId === alert.id && (
                  <form
                    onSubmit={(e) => handleFeedbackSubmit(e, alert)}
                    className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3"
                  >
                    <div className="text-xs font-bold text-slate-900">
                      Evaluate Alert & Prediction ({alert.predictionId}) — Closes the Learn Loop
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label
                          htmlFor={`fb-label-${alert.id}`}
                          className="block text-xs font-medium text-slate-700 mb-1"
                        >
                          Field Verification Outcome
                        </label>
                        <select
                          id={`fb-label-${alert.id}`}
                          value={farmerLabel}
                          onChange={(e) =>
                            setFarmerLabel(e.target.value as FarmerFeedbackLabel)
                          }
                          className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                        >
                          <option value="accurate_helpful">
                            Accurate & Helpful (Field Confirmed)
                          </option>
                          <option value="false_alarm">
                            False Alarm (Soil/Crop Normal)
                          </option>
                          <option value="too_late">
                            Alert Arrived Too Late
                          </option>
                          <option value="needs_calibration">
                            Sensor Drift / Needs Calibration
                          </option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label
                          htmlFor={`fb-comment-${alert.id}`}
                          className="block text-xs font-medium text-slate-700 mb-1"
                        >
                          Field Observation Note *
                        </label>
                        <div className="flex gap-2">
                          <input
                            id={`fb-comment-${alert.id}`}
                            type="text"
                            required
                            minLength={2}
                            value={feedbackComment}
                            onChange={(e) => setFeedbackComment(e.target.value)}
                            placeholder="e.g., Checked 15cm depth near canal gate; soil was indeed dry..."
                            className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-600"
                          />
                          <button
                            type="submit"
                            className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            Save Feedback
                          </button>
                        </div>
                      </div>
                    </div>
                  </form>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ML Governance & Recorded Farmer Feedback Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
            <h3 className="text-base font-bold text-slate-900">
              Recent Model Predictions & Confidence Gate Log
            </h3>
          </div>
          <div className="divide-y divide-slate-200 text-xs">
            {predictions.slice(0, 5).map((p) => (
              <div key={p.id} className="py-2.5 space-y-1">
                <div className="flex items-center justify-between font-mono tabular-nums text-slate-500">
                  <span className="font-semibold text-slate-800">
                    {p.fieldId} · {p.predictionType}
                  </span>
                  <span>
                    Risk: {p.riskScore}/100 · Conf: {Math.round(p.confidence * 100)}% · Status:{' '}
                    <strong
                      className={
                        p.status === 'ready' ? 'text-emerald-700' : 'text-amber-700'
                      }
                    >
                      {p.status.toUpperCase()}
                    </strong>
                  </span>
                </div>
                <p className="text-slate-700">{p.explanation}</p>
                <div className="text-[11px] font-mono text-slate-400">
                  Window: {p.featureWindow} · Model: {p.modelVersion}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
            <ThumbsUp className="w-4 h-4 text-emerald-700" />
            <h3 className="text-base font-bold text-slate-900">
              Farmer Feedback & Ground-Truth Candidate Registry ({feedbackList.length})
            </h3>
          </div>
          <div className="divide-y divide-slate-200 text-xs">
            {feedbackList.map((fb) => (
              <div key={fb.id} className="py-2.5 space-y-1">
                <div className="flex items-center justify-between font-mono tabular-nums text-slate-500">
                  <span className="font-semibold text-slate-800">
                    {fb.fieldId} · Label: {fb.farmerLabel}
                  </span>
                  <span>{new Date(fb.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p className="text-slate-700">{fb.comment}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

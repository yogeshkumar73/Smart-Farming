import React, { useState } from 'react';
import {
  Camera,
  CheckCircle2,
  ClipboardPlus,
  Microscope,
  ShieldAlert,
  Upload,
} from 'lucide-react';
import {
  Field,
  LeafDiseaseAnalysisResult,
} from '../../types/agriculture';

interface DiseaseDetectionViewProps {
  fields: Field[];
  selectedFieldId: string;
  analyses: LeafDiseaseAnalysisResult[];
  onAnalyzeLeaf: (input: {
    field_id: string;
    sample_preset: string;
    image_base64?: string;
    mime_type?: string;
    notes?: string;
  }) => Promise<LeafDiseaseAnalysisResult>;
  onCreateFollowUpTask: (analysis: LeafDiseaseAnalysisResult) => Promise<void>;
}

export const DiseaseDetectionView: React.FC<DiseaseDetectionViewProps> = ({
  fields,
  selectedFieldId,
  analyses,
  onAnalyzeLeaf,
  onCreateFollowUpTask,
}) => {
  const [fieldId, setFieldId] = useState(
    selectedFieldId !== 'all' ? selectedFieldId : fields[0]?.id || 'FIELD-001'
  );
  const [samplePreset, setSamplePreset] = useState('wheat_stripe_rust');
  const [notes, setNotes] = useState('');
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null);
  const [uploadedBase64, setUploadedBase64] = useState<string | undefined>(undefined);
  const [uploadedMime, setUploadedMime] = useState<string | undefined>(undefined);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [taskCreatedNotice, setTaskCreatedNotice] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      setUploadedPreview(dataUrl);
      const commaIdx = dataUrl.indexOf(',');
      if (commaIdx > 0) {
        setUploadedBase64(dataUrl.slice(commaIdx + 1));
        setUploadedMime(file.type || 'image/jpeg');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRunVisionPipeline = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAnalyzing(true);
    setTaskCreatedNotice(null);
    try {
      await onAnalyzeLeaf({
        field_id: fieldId,
        sample_preset: samplePreset,
        image_base64: uploadedBase64,
        mime_type: uploadedMime,
        notes: notes.trim() || undefined,
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const latestAnalysis = analyses[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-5 border-b border-slate-200">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
          Leaf-Image Disease Vision & Quality Gate Pipeline
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          Blueprint Section 5.3 & 9: Leaf image → file/quality check (blur, exposure) → model inference → 70% confidence safety threshold → limitations & next step.
        </p>
      </div>

      {taskCreatedNotice && (
        <div
          role="status"
          className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 font-medium"
        >
          {taskCreatedNotice}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Upload & Field Specimen Selector */}
        <form
          onSubmit={handleRunVisionPipeline}
          className="lg:col-span-5 bg-white p-5 rounded-xl border border-slate-200 space-y-4"
        >
          <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
            <Camera className="w-4 h-4 text-emerald-700" />
            <h3 className="text-base font-bold text-slate-900">
              Submit Leaf Specimen for Inference
            </h3>
          </div>

          <div>
            <label
              htmlFor="disease-field-select"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Field & Crop Context
            </label>
            <select
              id="disease-field-select"
              value={fieldId}
              onChange={(e) => setFieldId(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            >
              {fields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.id} — {f.name} ({f.crop}, {f.growthStage})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="disease-preset-select"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Field Specimen Preset (or Upload Custom Leaf Image Below)
            </label>
            <select
              id="disease-preset-select"
              value={samplePreset}
              onChange={(e) => setSamplePreset(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            >
              <option value="wheat_stripe_rust">
                Specimen A: Wheat Flag Leaf with Yellow-Orange Striations (Stripe Rust Suspect)
              </option>
              <option value="mustard_alternaria_blight">
                Specimen B: Mustard Lower Leaf with Concentric Dark Rings (Alternaria Blight)
              </option>
              <option value="healthy_leaf_sample">
                Specimen C: Healthy Green Leaf Canopy (Control Sample)
              </option>
              <option value="blurry_low_light">
                Specimen D: Blurry / Shadowed Leaf Image (Test Pre-Inference Quality Gate Rejection)
              </option>
            </select>
          </div>

          <div>
            <label
              htmlFor="leaf-file-upload"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Optional Custom Leaf Photo Upload (JPEG/PNG, max 5MB)
            </label>
            <label
              htmlFor="leaf-file-upload"
              className="flex items-center justify-center gap-2 px-4 py-3 border border-dashed border-slate-300 rounded-lg text-xs text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              <Upload className="w-4 h-4 text-slate-500" />
              <span>
                {uploadedPreview ? 'Custom leaf image attached' : 'Select leaf image from device'}
              </span>
              <input
                id="leaf-file-upload"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="sr-only"
              />
            </label>
          </div>

          <div>
            <label
              htmlFor="disease-notes-input"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Scouting Notes (Distribution, Upper vs Lower Canopy)
            </label>
            <textarea
              id="disease-notes-input"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Observed on 4 plants near northern irrigation channel..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
          </div>

          <button
            type="submit"
            disabled={isAnalyzing}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors cursor-pointer"
          >
            <Microscope className="w-4 h-4" />
            {isAnalyzing ? 'Running Quality Check & Vision Model...' : 'Run Leaf Disease Vision Pipeline'}
          </button>
        </form>

        {/* Right: Latest Inference Result & Quality Gate Report */}
        <div className="lg:col-span-7 space-y-4">
          {latestAnalysis && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
                <div>
                  <div className="text-xs font-mono tabular-nums text-slate-500">
                    {latestAnalysis.id} · Field: {latestAnalysis.fieldId} · Crop: {latestAnalysis.crop}
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                    {latestAnalysis.diseaseClass}
                  </h3>
                </div>
                <div className="text-right font-mono tabular-nums">
                  <div
                    className={`text-sm font-bold ${
                      latestAnalysis.status === 'ready'
                        ? 'text-emerald-700'
                        : 'text-amber-700'
                    }`}
                  >
                    Confidence: {Math.round(latestAnalysis.confidence * 100)}%
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Gate: {latestAnalysis.status.toUpperCase()} · {latestAnalysis.modelVersion}
                  </div>
                </div>
              </div>

              {/* Pre-Inference Image Quality Gate Verification */}
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  {latestAnalysis.imageQuality.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  ) : (
                    <ShieldAlert className="w-4 h-4 text-amber-700" />
                  )}
                  Step 1 — Pre-Inference Image Quality Gate:{' '}
                  {latestAnalysis.imageQuality.passed ? 'PASSED' : 'REJECTED (UNCERTAIN)'}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-[11px] text-slate-600">
                  <div>Resolution: {latestAnalysis.imageQuality.resolutionCheck}</div>
                  <div>Lighting: {latestAnalysis.imageQuality.lightingCheck}</div>
                  <div>Focus/Blur: {latestAnalysis.imageQuality.blurCheck}</div>
                </div>
              </div>

              {/* Recommended Next Step First */}
              <div className="p-4 rounded-lg bg-emerald-50/70 border border-emerald-200 space-y-1">
                <div className="text-xs font-bold text-emerald-900">
                  Recommended Next Step (Advisory Only — No Autonomous Spraying):
                </div>
                <p className="text-sm font-semibold text-slate-900">
                  {latestAnalysis.recommendedNextStep}
                </p>
              </div>

              <div className="space-y-2 text-xs text-slate-700">
                <p>
                  <strong className="text-slate-900">Visual Findings:</strong>{' '}
                  {latestAnalysis.explanation}
                </p>
                <p className="text-slate-500">
                  <strong className="text-slate-700">Diagnostic Limitations:</strong>{' '}
                  {latestAnalysis.limitations}
                </p>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={async () => {
                    await onCreateFollowUpTask(latestAnalysis);
                    setTaskCreatedNotice(
                      `Created collaborative scouting task for ${latestAnalysis.fieldId} (${latestAnalysis.diseaseClass}).`
                    );
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <ClipboardPlus className="w-4 h-4" />
                  Create Follow-up Scouting Task from Diagnosis
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

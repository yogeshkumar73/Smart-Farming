import {
  AlertRecord,
  AlertSeverity,
  CollaborativeTask,
  DeviceTelemetryPayload,
  Field,
  GrowthStage,
  PredictionRecord,
  PredictionStatus,
  SensorReading,
} from '../types/agriculture';

/**
 * Verbatim validation constants synchronized with firebase-blueprint.json & firestore.rules
 */
export const BLUEPRINT_CONSTRAINTS = {
  ID_REGEX: /^[a-zA-Z0-9_\-]+$/,
  ID_MAX_LEN: 128,
  TASK_TITLE_MIN: 3,
  TASK_TITLE_MAX: 160,
  TASK_DESC_MIN: 1,
  TASK_DESC_MAX: 1000,
  ASSIGNEE_NAME_MAX: 80,
  COMMENT_MAX: 600,
  FEEDBACK_COMMENT_MAX: 500,
  FARM_NAME_MIN: 2,
  FARM_NAME_MAX: 100,
  FIELD_NAME_MIN: 2,
  FIELD_NAME_MAX: 100,
  CONFIGURED_MIN_CONFIDENCE: 0.7,
  STALE_READING_THRESHOLD_MS: 60 * 60 * 1000, // 60 minutes
  FUTURE_DRIFT_TOLERANCE_MS: 5 * 60 * 1000, // 5 minutes
};

export function isValidBlueprintId(id: string): boolean {
  return (
    typeof id === 'string' &&
    id.length >= 1 &&
    id.length <= BLUEPRINT_CONSTRAINTS.ID_MAX_LEN &&
    BLUEPRINT_CONSTRAINTS.ID_REGEX.test(id)
  );
}

export interface TelemetryValidationResult {
  isValidSchema: boolean;
  validationStatus: 'valid' | 'stale' | 'future_dated' | 'out_of_range';
  errors: string[];
  notes: string[];
  calibratedPayload?: DeviceTelemetryPayload;
}

/**
 * Validates and calibrates incoming ESP32 sensor payloads according to Section 4.1 - 4.4 of the Blueprint.
 */
export function validateAndCalibrateTelemetry(
  payload: Partial<DeviceTelemetryPayload>,
  nowMs: number = Date.now(),
  calibration: { moistureOffset: number; temperatureOffset: number } = {
    moistureOffset: 0,
    temperatureOffset: 0,
  }
): TelemetryValidationResult {
  const errors: string[] = [];
  const notes: string[] = [];

  if (!payload || typeof payload !== 'object') {
    return {
      isValidSchema: false,
      validationStatus: 'out_of_range',
      errors: ['Malformed payload: body must be a JSON object'],
      notes,
    };
  }

  if (!payload.device_id || !isValidBlueprintId(payload.device_id)) {
    errors.push('Invalid or missing device_id');
  }
  if (!payload.field_id || !isValidBlueprintId(payload.field_id)) {
    errors.push('Invalid or missing field_id');
  }
  if (typeof payload.sequence !== 'number' || !Number.isInteger(payload.sequence) || payload.sequence < 0) {
    errors.push('sequence must be a non-negative integer');
  }
  if (typeof payload.soil_moisture !== 'number' || Number.isNaN(payload.soil_moisture)) {
    errors.push('soil_moisture must be a number');
  }
  if (typeof payload.temperature !== 'number' || Number.isNaN(payload.temperature)) {
    errors.push('temperature must be a number');
  }
  if (typeof payload.humidity !== 'number' || Number.isNaN(payload.humidity)) {
    errors.push('humidity must be a number');
  }
  if (typeof payload.rainfall !== 'number' || Number.isNaN(payload.rainfall)) {
    errors.push('rainfall must be a number');
  }
  if (!payload.timestamp || Number.isNaN(Date.parse(payload.timestamp))) {
    errors.push('timestamp must be a valid ISO-8601 string');
  }

  if (errors.length > 0) {
    return {
      isValidSchema: false,
      validationStatus: 'out_of_range',
      errors,
      notes,
    };
  }

  // Apply sensor calibration offsets (Section 4.1: Sensor read -> calibration -> range validation)
  const calibratedMoisture = Number(
    (payload.soil_moisture! + calibration.moistureOffset).toFixed(1)
  );
  const calibratedTemp = Number(
    (payload.temperature! + calibration.temperatureOffset).toFixed(1)
  );

  let validationStatus: 'valid' | 'stale' | 'future_dated' | 'out_of_range' = 'valid';

  // Range checks
  if (calibratedMoisture < 0 || calibratedMoisture > 100) {
    errors.push(`Calibrated soil_moisture (${calibratedMoisture}%) out of valid range [0, 100]`);
  }
  if (calibratedTemp < -20 || calibratedTemp > 65) {
    errors.push(`Calibrated temperature (${calibratedTemp}°C) out of valid range [-20, 65]`);
  }
  if (payload.humidity! < 0 || payload.humidity! > 100) {
    errors.push(`humidity (${payload.humidity}%) out of valid range [0, 100]`);
  }
  if (payload.rainfall! < 0 || payload.rainfall! > 1000) {
    errors.push(`rainfall (${payload.rainfall}mm) out of valid range [0, 1000]`);
  }
  if (payload.ph !== undefined && (payload.ph < 3.0 || payload.ph > 10.5)) {
    errors.push(`ph (${payload.ph}) out of valid agronomic range [3.0, 10.5]`);
  }

  if (errors.length > 0) {
    return {
      isValidSchema: false,
      validationStatus: 'out_of_range',
      errors,
      notes,
    };
  }

  const eventTimeMs = Date.parse(payload.timestamp!);
  const ageMs = nowMs - eventTimeMs;

  if (ageMs > BLUEPRINT_CONSTRAINTS.STALE_READING_THRESHOLD_MS) {
    validationStatus = 'stale';
    notes.push(
      `Reading timestamp is ${Math.round(ageMs / 60000)} minutes old (exceeds 60m live freshness window)`
    );
  } else if (eventTimeMs - nowMs > BLUEPRINT_CONSTRAINTS.FUTURE_DRIFT_TOLERANCE_MS) {
    validationStatus = 'future_dated';
    notes.push('Reading timestamp is future-dated beyond 5m clock drift tolerance');
  }

  return {
    isValidSchema: true,
    validationStatus,
    errors: [],
    notes,
    calibratedPayload: {
      device_id: payload.device_id!,
      field_id: payload.field_id!,
      timestamp: payload.timestamp!,
      sequence: payload.sequence!,
      soil_moisture: calibratedMoisture,
      temperature: calibratedTemp,
      humidity: Number(payload.humidity!.toFixed(1)),
      rainfall: Number(payload.rainfall!.toFixed(1)),
      ph: payload.ph !== undefined ? Number(payload.ph.toFixed(2)) : undefined,
      nitrogen: payload.nitrogen,
      phosphorus: payload.phosphorus,
      potassium: payload.potassium,
      firmware_version: payload.firmware_version || '1.0.0',
    },
  };
}

/**
 * Deduplicates incoming readings using (device_id, sequence) per Section 4.3 & 4.4 Step 3.
 */
export function isDuplicateReading(
  existingReadings: Pick<SensorReading, 'deviceId' | 'sequence' | 'eventId'>[],
  deviceId: string,
  sequence: number
): boolean {
  const eventId = `${deviceId}:${sequence}`;
  return existingReadings.some(
    (r) => r.eventId === eventId || (r.deviceId === deviceId && r.sequence === sequence)
  );
}

/**
 * Growth stage water sensitivity multiplier.
 * Flowering and grain filling stages are more sensitive to moisture deficits.
 */
export function getStageSensitivityMultiplier(stage: GrowthStage): number {
  switch (stage) {
    case 'flowering':
    case 'grain_filling':
      return 1.25;
    case 'tillering':
    case 'vegetative':
      return 1.1;
    case 'germination':
    case 'seedling':
      return 1.15;
    case 'maturity':
      return 0.85;
    default:
      return 1.0;
  }
}

export interface DecisionEvaluationOutput {
  prediction: PredictionRecord;
  alert: AlertRecord | null;
  deduplicatedExistingAlert: boolean;
}

/**
 * Implements Section 4.5 (Prediction/alert decision logic) & Section 10 (Alert & Recommendation Engine).
 * Preserves strict separation: Feature Builder -> ML Prediction -> Confidence Gate -> Agronomic Rules -> Alert Deduplication.
 */
export function evaluateIrrigationAndRiskDecision(params: {
  field: Field;
  recentReadings: SensorReading[];
  existingAlerts: AlertRecord[];
  nowIso?: string;
  forcedConfidence?: number;
}): DecisionEvaluationOutput {
  const nowIso = params.nowIso || new Date().toISOString();
  const { field, recentReadings, existingAlerts } = params;

  // Step 1: Check for missing or stale data (Section 4.5: if input_is_stale or required_features_missing)
  if (!recentReadings || recentReadings.length === 0) {
    const insufficientPred: PredictionRecord = {
      id: `pred_${Date.now()}_insuff`,
      fieldId: field.id,
      predictionType: 'irrigation_need',
      createdAt: nowIso,
      riskScore: 0,
      confidence: 0,
      severity: 'low',
      status: 'insufficient_data',
      explanation: 'No sensor readings available for this field.',
      recommendation: 'Verify ESP32 sensor power and MQTT connectivity before making irrigation decisions.',
      featureWindow: '0 readings',
      modelVersion: 'irrigation-rf-v1.2',
      missingInputs: ['soil_moisture', 'temperature', 'humidity'],
    };
    return {
      prediction: insufficientPred,
      alert: null,
      deduplicatedExistingAlert: false,
    };
  }

  const latest = recentReadings[0];
  if (latest.validationStatus === 'stale' || latest.validationStatus === 'future_dated') {
    const stalePred: PredictionRecord = {
      id: `pred_${Date.now()}_stale`,
      fieldId: field.id,
      predictionType: 'irrigation_need',
      createdAt: nowIso,
      riskScore: 0,
      confidence: 0.45,
      severity: 'low',
      status: 'insufficient_data',
      explanation: `Latest telemetry from ${latest.deviceId} is marked ${latest.validationStatus}. Old data is never presented as live.`,
      recommendation: 'Inspect field sensor node and wait for fresh synchronized readings before acting.',
      featureWindow: `Last seen ${latest.eventTimestamp}`,
      modelVersion: 'irrigation-rf-v1.2',
      missingInputs: ['fresh_telemetry'],
    };
    return {
      prediction: stalePred,
      alert: null,
      deduplicatedExistingAlert: false,
    };
  }

  // Step 2: Build rolling features across up to 6 recent valid readings
  const validWindow = recentReadings
    .filter((r) => r.validationStatus === 'valid')
    .slice(0, 6);
  const windowSize = validWindow.length || 1;

  const avgMoisture =
    validWindow.reduce((sum, r) => sum + r.soilMoisture, 0) / windowSize;
  const avgTemp =
    validWindow.reduce((sum, r) => sum + r.temperature, 0) / windowSize;
  const avgHumidity =
    validWindow.reduce((sum, r) => sum + r.humidity, 0) / windowSize;
  const totalRainfall = validWindow.reduce((sum, r) => sum + r.rainfall, 0);

  // Compute moisture deficit relative to field threshold
  const deficit = field.moistureThreshold - latest.soilMoisture;
  const rollingDeficit = field.moistureThreshold - avgMoisture;
  const stageMultiplier = getStageSensitivityMultiplier(field.growthStage);

  // Calculate raw irrigation risk score [0..100]
  let rawRisk = 15;
  if (deficit > 0) {
    rawRisk = Math.min(
      98,
      Math.round(
        (35 + deficit * 3.8 + Math.max(0, rollingDeficit) * 1.5 + Math.max(0, avgTemp - 30) * 1.4 - totalRainfall * 2.0) *
          stageMultiplier
      )
    );
  } else {
    rawRisk = Math.max(8, Math.round(25 - Math.abs(deficit) * 1.5));
  }

  // Model confidence based on window completeness and sensor consistency
  const computedConfidence =
    params.forcedConfidence !== undefined
      ? params.forcedConfidence
      : Number(Math.min(0.96, 0.72 + Math.min(windowSize, 5) * 0.04).toFixed(2));

  // Step 3: Confidence Gate (Section 4.5: if prediction.confidence < configured_min_confidence)
  const status: PredictionStatus =
    computedConfidence < BLUEPRINT_CONSTRAINTS.CONFIGURED_MIN_CONFIDENCE
      ? 'needs_review'
      : 'ready';

  // Step 4: Agronomic Rules Evaluate Severity
  let severity: AlertSeverity = 'low';
  if (status === 'needs_review') {
    // Do not promote low-confidence output to a high-impact action
    severity = 'low';
  } else if (rawRisk >= 75 || (deficit >= 6 && field.growthStage === 'flowering')) {
    severity = 'high';
  } else if (rawRisk >= 45 || deficit > 0) {
    severity = 'medium';
  } else {
    severity = 'low';
  }

  // Step 5: Recommendation Catalog Lookup (Plain language, recommended next action first)
  let recommendation =
    'No irrigation action required today. Continue routine soil moisture monitoring.';
  let explanation = `Soil moisture (${latest.soilMoisture}%) is above the ${field.moistureThreshold}% threshold for ${field.crop} (${field.growthStage} stage).`;
  let whyItMatters = `Adequate root-zone moisture supports healthy ${field.growthStage} development without waterlogging.`;

  if (status === 'needs_review') {
    recommendation =
      'Needs manual field inspection: Model confidence is below the 70% safety gate. Verify soil moisture manually before operating irrigation valves.';
    explanation = `Advisory model estimated a ${rawRisk}/100 irrigation risk, but confidence (${Math.round(computedConfidence * 100)}%) is below the 70% threshold.`;
    whyItMatters =
      'Low-confidence predictions are gated to prevent premature irrigation or crop stress.';
  } else if (severity === 'high') {
    recommendation = `Schedule manual irrigation check immediately and apply 20–25mm water after confirming valve interlocks. Do not run unverified automated pumps.`;
    explanation = `Soil moisture (${latest.soilMoisture}%, rolling avg ${avgMoisture.toFixed(1)}%) has dropped significantly below the ${field.moistureThreshold}% threshold during ${field.growthStage} stage at ${avgTemp.toFixed(1)}°C.`;
    whyItMatters = `Moisture stress during ${field.growthStage} in ${field.crop} (${field.variety}) directly reduces grain yield and plant vigor.`;
  } else if (severity === 'medium') {
    recommendation = `Inspect root-zone soil moisture and local weather forecast within 12 hours before deciding whether to irrigate.`;
    explanation = `Soil moisture (${latest.soilMoisture}%) is slightly below the ${field.moistureThreshold}% field threshold with ${totalRainfall.toFixed(1)}mm recent rainfall.`;
    whyItMatters = `Early detection allows planned irrigation before visible leaf wilting occurs.`;
  }

  const prediction: PredictionRecord = {
    id: `pred_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    fieldId: field.id,
    predictionType: 'irrigation_need',
    createdAt: nowIso,
    riskScore: rawRisk,
    confidence: computedConfidence,
    severity,
    status,
    explanation,
    recommendation,
    featureWindow: `${windowSize} readings (avg moisture ${avgMoisture.toFixed(1)}%, avg temp ${avgTemp.toFixed(1)}°C, rain ${totalRainfall.toFixed(1)}mm)`,
    modelVersion: 'irrigation-rf-v1.2',
  };

  // Step 6: Alert Deduplication & Escalation (Section 4.4 Step 8 & Section 10)
  // Low severity or needs_review does not trigger disruptive alerts unless medium/high
  if (severity === 'low' || status !== 'ready') {
    return {
      prediction,
      alert: null,
      deduplicatedExistingAlert: false,
    };
  }

  const activeExisting = existingAlerts.find(
    (a) =>
      a.fieldId === field.id &&
      a.type === 'irrigation_need' &&
      (a.status === 'active' || a.status === 'acknowledged')
  );

  if (activeExisting) {
    // Escalate severity if higher, update message and occurrence count instead of spamming
    const escalatedSeverity: AlertSeverity =
      severity === 'high' || activeExisting.severity === 'high' ? 'high' : 'medium';
    const updatedAlert: AlertRecord = {
      ...activeExisting,
      predictionId: prediction.id,
      severity: escalatedSeverity,
      message: explanation,
      whyItMatters,
      recommendation,
      confidence: computedConfidence,
      updatedAt: nowIso,
      occurrenceCount: activeExisting.occurrenceCount + 1,
      deliveryStatus: {
        inApp: 'delivered',
        sms: escalatedSeverity === 'high' ? 'sent' : 'disabled',
        push: 'sent',
      },
    };
    return {
      prediction,
      alert: updatedAlert,
      deduplicatedExistingAlert: true,
    };
  }

  const newAlert: AlertRecord = {
    id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    fieldId: field.id,
    predictionId: prediction.id,
    type: 'irrigation_need',
    severity,
    status: 'active',
    message: explanation,
    whyItMatters,
    recommendation,
    confidence: computedConfidence,
    limitations:
      'Advisory ML output based on point capacitive probe readings. Verify physical soil profile and rain forecast before opening irrigation gates.',
    modelVersion: prediction.modelVersion,
    createdAt: nowIso,
    updatedAt: nowIso,
    deliveryStatus: {
      inApp: 'delivered',
      sms: severity === 'high' ? 'sent' : 'disabled',
      push: 'sent',
    },
    occurrenceCount: 1,
  };

  return {
    prediction,
    alert: newAlert,
    deduplicatedExistingAlert: false,
  };
}

/**
 * Validates outgoing CollaborativeTask mutations against firebase-blueprint.json constraints.
 */
export function validateTaskInput(input: {
  title: string;
  description: string;
  farmId: string;
  fieldId: string;
  assigneeName: string;
  dueDate: string;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const title = (input.title || '').trim();
  const description = (input.description || '').trim();
  const assigneeName = (input.assigneeName || '').trim();

  if (
    title.length < BLUEPRINT_CONSTRAINTS.TASK_TITLE_MIN ||
    title.length > BLUEPRINT_CONSTRAINTS.TASK_TITLE_MAX
  ) {
    errors.push(
      `Task title must be between ${BLUEPRINT_CONSTRAINTS.TASK_TITLE_MIN} and ${BLUEPRINT_CONSTRAINTS.TASK_TITLE_MAX} characters.`
    );
  }
  if (
    description.length < BLUEPRINT_CONSTRAINTS.TASK_DESC_MIN ||
    description.length > BLUEPRINT_CONSTRAINTS.TASK_DESC_MAX
  ) {
    errors.push(
      `Task description must be between ${BLUEPRINT_CONSTRAINTS.TASK_DESC_MIN} and ${BLUEPRINT_CONSTRAINTS.TASK_DESC_MAX} characters.`
    );
  }
  if (!isValidBlueprintId(input.farmId)) {
    errors.push('Please select a valid Farm.');
  }
  if (!isValidBlueprintId(input.fieldId)) {
    errors.push('Please select a valid Field.');
  }
  if (assigneeName.length < 1 || assigneeName.length > BLUEPRINT_CONSTRAINTS.ASSIGNEE_NAME_MAX) {
    errors.push('Assignee name is required (max 80 characters).');
  }
  if (!input.dueDate || input.dueDate.trim().length < 8) {
    errors.push('Please specify a valid due date.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Idempotent state reducer for real-time collaborative task updates (Real-Time Guidelines Section 2).
 */
export function upsertCollaborativeTask(
  tasks: CollaborativeTask[],
  incomingTask: CollaborativeTask
): CollaborativeTask[] {
  const index = tasks.findIndex((t) => t.id === incomingTask.id);
  if (index === -1) {
    return [incomingTask, ...tasks];
  }
  const updated = [...tasks];
  updated[index] = {
    ...updated[index],
    ...incomingTask,
    comments: incomingTask.comments || updated[index].comments || [],
  };
  return updated;
}

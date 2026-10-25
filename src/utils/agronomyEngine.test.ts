import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateAndCalibrateTelemetry,
  isDuplicateReading,
  evaluateIrrigationAndRiskDecision,
  validateTaskInput,
  upsertCollaborativeTask,
} from './agronomyEngine';
import { Field, SensorReading, CollaborativeTask } from '../types/agriculture';

const sampleField: Field = {
  id: 'FIELD-001',
  ownerId: 'user_farmer_1',
  farmId: 'FARM-001',
  name: 'North Canal Wheat Parcel',
  crop: 'Wheat',
  variety: 'HD-2967',
  sowingDate: '2026-09-15',
  growthStage: 'flowering',
  areaHectares: 1.8,
  moistureThreshold: 26.0,
  soilCharacteristics: {
    phTarget: 6.8,
    organicMatterPct: 2.1,
    drainage: 'well_drained',
  },
  createdAt: '2026-09-15T08:00:00Z',
};

test('validateAndCalibrateTelemetry validates contract, applies offsets, and flags stale data', () => {
  const nowMs = Date.parse('2026-10-25T12:00:00Z');

  // 1. Valid fresh reading with calibration offset
  const validRes = validateAndCalibrateTelemetry(
    {
      device_id: 'ESP32-001',
      field_id: 'FIELD-001',
      timestamp: '2026-10-25T11:50:00Z',
      sequence: 1042,
      soil_moisture: 22.4,
      temperature: 31.5,
      humidity: 78.2,
      rainfall: 0,
      ph: 6.7,
      firmware_version: '1.0.0',
    },
    nowMs,
    { moistureOffset: 0.6, temperatureOffset: -0.5 }
  );

  assert.equal(validRes.isValidSchema, true);
  assert.equal(validRes.validationStatus, 'valid');
  assert.equal(validRes.calibratedPayload?.soil_moisture, 23.0);
  assert.equal(validRes.calibratedPayload?.temperature, 31.0);

  // 2. Stale reading (> 60 mins old)
  const staleRes = validateAndCalibrateTelemetry(
    {
      device_id: 'ESP32-001',
      field_id: 'FIELD-001',
      timestamp: '2026-10-25T09:00:00Z',
      sequence: 1043,
      soil_moisture: 20.0,
      temperature: 30.0,
      humidity: 60.0,
      rainfall: 0,
      firmware_version: '1.0.0',
    },
    nowMs
  );
  assert.equal(staleRes.isValidSchema, true);
  assert.equal(staleRes.validationStatus, 'stale');

  // 3. Out of range reading
  const invalidRes = validateAndCalibrateTelemetry(
    {
      device_id: 'ESP32-001',
      field_id: 'FIELD-001',
      timestamp: '2026-10-25T11:55:00Z',
      sequence: 1044,
      soil_moisture: 145.0,
      temperature: 30.0,
      humidity: 60.0,
      rainfall: 0,
      firmware_version: '1.0.0',
    },
    nowMs
  );
  assert.equal(invalidRes.isValidSchema, false);
  assert.equal(invalidRes.validationStatus, 'out_of_range');
});

test('isDuplicateReading detects duplicate (device_id, sequence) idempotently', () => {
  const existing = [
    { deviceId: 'ESP32-001', sequence: 1042, eventId: 'ESP32-001:1042' },
  ];
  assert.equal(isDuplicateReading(existing, 'ESP32-001', 1042), true);
  assert.equal(isDuplicateReading(existing, 'ESP32-001', 1043), false);
});

test('evaluateIrrigationAndRiskDecision gates low confidence and deduplicates active alerts', () => {
  const lowMoistureReading: SensorReading = {
    id: 'reading_1',
    eventId: 'ESP32-001:1050',
    deviceId: 'ESP32-001',
    fieldId: 'FIELD-001',
    sequence: 1050,
    eventTimestamp: '2026-10-25T11:55:00Z',
    receivedAt: '2026-10-25T11:55:02Z',
    soilMoisture: 17.5, // 8.5% below 26% threshold during flowering
    temperature: 34.2,
    humidity: 44.0,
    rainfall: 0,
    ph: 6.7,
    firmwareVersion: '1.0.0',
    validationStatus: 'valid',
    transport: 'mqtt',
  };

  // 1. Low confidence gate (< 0.70) must produce status="needs_review" and NO high-impact alert
  const lowConfOut = evaluateIrrigationAndRiskDecision({
    field: sampleField,
    recentReadings: [lowMoistureReading],
    existingAlerts: [],
    forcedConfidence: 0.58,
  });
  assert.equal(lowConfOut.prediction.status, 'needs_review');
  assert.equal(lowConfOut.alert, null);

  // 2. High confidence with severe moisture deficit during flowering issues a HIGH alert
  const highConfOut = evaluateIrrigationAndRiskDecision({
    field: sampleField,
    recentReadings: [lowMoistureReading],
    existingAlerts: [],
  });
  assert.equal(highConfOut.prediction.status, 'ready');
  assert.equal(highConfOut.prediction.severity, 'high');
  assert.ok(highConfOut.alert);
  assert.equal(highConfOut.alert?.severity, 'high');
  assert.equal(highConfOut.deduplicatedExistingAlert, false);

  // 3. Subsequent reading for same field/type deduplicates and increments occurrenceCount
  const dedupOut = evaluateIrrigationAndRiskDecision({
    field: sampleField,
    recentReadings: [lowMoistureReading],
    existingAlerts: [highConfOut.alert!],
  });
  assert.equal(dedupOut.deduplicatedExistingAlert, true);
  assert.equal(dedupOut.alert?.id, highConfOut.alert?.id);
  assert.equal(dedupOut.alert?.occurrenceCount, 2);
});

test('validateTaskInput and upsertCollaborativeTask enforce schema and idempotency', () => {
  const invalidCheck = validateTaskInput({
    title: 'Hi', // too short (<3)
    description: '',
    farmId: 'FARM-001',
    fieldId: 'FIELD-001',
    assigneeName: '',
    dueDate: '',
  });
  assert.equal(invalidCheck.valid, false);
  assert.equal(invalidCheck.errors.length, 4);

  const validCheck = validateTaskInput({
    title: 'Inspect Soil Moisture Probe ESP32-001',
    description: 'Check root zone sensor calibration and manual valve interlock.',
    farmId: 'FARM-001',
    fieldId: 'FIELD-001',
    assigneeName: 'Aarav Verma',
    dueDate: '2026-10-26',
  });
  assert.equal(validCheck.valid, true);

  const taskA: CollaborativeTask = {
    id: 'task_1',
    ownerId: 'u1',
    farmId: 'FARM-001',
    fieldId: 'FIELD-001',
    title: 'Check valve',
    description: 'Verify safety lock',
    category: 'irrigation',
    priority: 'high',
    status: 'todo',
    assigneeName: 'Aarav',
    assigneeId: 'u2',
    dueDate: '2026-10-26',
    createdAt: '2026-10-25T10:00:00Z',
    updatedAt: '2026-10-25T10:00:00Z',
    comments: [],
  };

  const list1 = upsertCollaborativeTask([], taskA);
  assert.equal(list1.length, 1);

  const list2 = upsertCollaborativeTask(list1, { ...taskA, status: 'in_progress' });
  assert.equal(list2.length, 1);
  assert.equal(list2[0].status, 'in_progress');
});

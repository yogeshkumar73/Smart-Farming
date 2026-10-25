export type UserRole = 'farmer' | 'advisor' | 'technician';
export type SupportedLanguage = 'en' | 'hi' | 'es';
export type SoilType = 'loamy' | 'clay' | 'sandy' | 'silty' | 'black_cotton' | 'alluvial';
export type GrowthStage =
  | 'germination'
  | 'seedling'
  | 'vegetative'
  | 'tillering'
  | 'flowering'
  | 'grain_filling'
  | 'maturity';

export type AlertSeverity = 'low' | 'medium' | 'high';
export type AlertStatus = 'active' | 'acknowledged' | 'resolved';
export type PredictionType = 'irrigation_need' | 'crop_environment_risk' | 'leaf_disease';
export type PredictionStatus = 'ready' | 'needs_review' | 'insufficient_data';

export type TaskCategory =
  | 'irrigation'
  | 'scouting'
  | 'sensor_maintenance'
  | 'soil_nutrition'
  | 'disease_management';
export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskStatus = 'todo' | 'in_progress' | 'completed';

export type FarmerFeedbackLabel =
  | 'accurate_helpful'
  | 'false_alarm'
  | 'too_late'
  | 'needs_calibration';

export interface Farm {
  id: string;
  ownerId: string;
  name: string;
  location: {
    district: string;
    state: string;
  };
  soilType: SoilType;
  areaHectares: number;
  createdAt: string;
  updatedAt?: string;
}

export interface Field {
  id: string;
  ownerId: string;
  farmId: string;
  name: string;
  crop: string;
  variety: string;
  sowingDate: string;
  growthStage: GrowthStage;
  areaHectares: number;
  moistureThreshold: number;
  soilCharacteristics: {
    phTarget: number;
    organicMatterPct: number;
    drainage: 'well_drained' | 'moderate' | 'poor';
  };
  createdAt: string;
  updatedAt?: string;
}

export interface SensorDevice {
  id: string;
  deviceId: string;
  fieldId: string;
  farmId: string;
  sensorTypes: string[];
  units: Record<string, string>;
  status: 'online' | 'stale' | 'offline' | 'maintenance';
  calibration: {
    moistureOffset: number;
    temperatureOffset: number;
    lastCalibratedAt: string;
  };
  firmwareVersion: string;
  lastSeen: string;
  mqttTopic: string;
  signalRssiDbm: number;
  batteryPct: number;
}

export interface DeviceTelemetryPayload {
  device_id: string;
  field_id: string;
  timestamp: string;
  sequence: number;
  soil_moisture: number;
  temperature: number;
  humidity: number;
  rainfall: number;
  ph?: number;
  nitrogen?: number;
  phosphorus?: number;
  potassium?: number;
  firmware_version: string;
}

export interface SensorReading {
  id: string;
  eventId: string;
  deviceId: string;
  fieldId: string;
  sequence: number;
  eventTimestamp: string;
  receivedAt: string;
  soilMoisture: number;
  temperature: number;
  humidity: number;
  rainfall: number;
  ph?: number;
  nitrogen?: number;
  phosphorus?: number;
  potassium?: number;
  firmwareVersion: string;
  validationStatus: 'valid' | 'stale' | 'future_dated' | 'out_of_range';
  validationNotes?: string[];
  transport: 'mqtt' | 'http_fallback' | 'offline_buffer_sync';
}

export interface PredictionRecord {
  id: string;
  fieldId: string;
  predictionType: PredictionType;
  createdAt: string;
  riskScore: number; // 0 to 100
  confidence: number; // 0.0 to 1.0
  severity: AlertSeverity;
  status: PredictionStatus;
  explanation: string;
  recommendation: string;
  featureWindow: string;
  modelVersion: string;
  missingInputs?: string[];
}

export interface AlertRecord {
  id: string;
  fieldId: string;
  predictionId: string;
  type: PredictionType;
  severity: AlertSeverity;
  status: AlertStatus;
  message: string;
  whyItMatters: string;
  recommendation: string;
  confidence: number;
  limitations: string;
  modelVersion: string;
  createdAt: string;
  updatedAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  deliveryStatus: {
    inApp: 'delivered';
    sms: 'queued' | 'sent' | 'disabled';
    push: 'sent' | 'disabled';
  };
  occurrenceCount: number;
}

export interface FeedbackRecord {
  id: string;
  ownerId: string;
  predictionId: string;
  fieldId: string;
  farmerLabel: FarmerFeedbackLabel;
  comment: string;
  createdAt: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  content: string;
  createdAt: string;
}

export interface CollaborativeTask {
  id: string;
  ownerId: string;
  farmId: string;
  fieldId: string;
  title: string;
  description: string;
  category: TaskCategory;
  priority: TaskPriority;
  status: TaskStatus;
  assigneeName: string;
  assigneeId: string;
  dueDate: string;
  linkedAlertId?: string;
  safetyInterlockRequired?: boolean;
  safetyConfirmedBy?: string;
  createdAt: string;
  updatedAt: string;
  comments: TaskComment[];
  syncSource?: 'server' | 'firestore' | 'optimistic';
}

export interface CollaboratorPresence {
  clientId: string;
  uid: string;
  displayName: string;
  role: UserRole;
  activeView: string;
  activeFieldId: string;
  color: string;
  lastActiveAt: string;
}

export interface LeafDiseaseAnalysisResult {
  id: string;
  fieldId: string;
  crop: string;
  imageQuality: {
    passed: boolean;
    resolutionCheck: string;
    lightingCheck: string;
    blurCheck: string;
  };
  diseaseClass: string;
  confidence: number;
  modelVersion: string;
  status: PredictionStatus;
  severity: AlertSeverity;
  explanation: string;
  limitations: string;
  recommendedNextStep: string;
  createdAt: string;
}

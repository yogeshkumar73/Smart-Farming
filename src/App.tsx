import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Cpu,
  Droplets,
  LogIn,
  LogOut,
  Microscope,
  Plus,
  ShieldAlert,
  Thermometer,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
  signInWithGooglePopup,
  signOutUser,
  testFirestoreConnection,
} from './firebase';
import {
  AlertRecord,
  AlertStatus,
  CollaboratorPresence,
  CollaborativeTask,
  DeviceTelemetryPayload,
  Farm,
  FarmerFeedbackLabel,
  FeedbackRecord,
  Field,
  GrowthStage,
  LeafDiseaseAnalysisResult,
  PredictionRecord,
  SensorDevice,
  SensorReading,
  SoilType,
  SupportedLanguage,
  TaskCategory,
  TaskPriority,
  TaskStatus,
  UserRole,
} from './types/agriculture';
import {
  INITIAL_ALERTS,
  INITIAL_DISEASE_ANALYSES,
  INITIAL_FARMS,
  INITIAL_FEEDBACK,
  INITIAL_FIELDS,
  INITIAL_PREDICTIONS,
  INITIAL_READINGS,
  INITIAL_SENSORS,
  INITIAL_TASKS,
} from './utils/seedData';
import { upsertCollaborativeTask } from './utils/agronomyEngine';
import { TRANSLATIONS } from './utils/i18n';
import { TaskCollaborationView } from './components/tasks/TaskCollaborationView';
import { SensorsTelemetryView } from './components/sensors/SensorsTelemetryView';
import { AlertsDecisionView } from './components/alerts/AlertsDecisionView';
import { DiseaseDetectionView } from './components/disease/DiseaseDetectionView';
import { FarmsFieldsView } from './components/farms/FarmsFieldsView';
import { AnalyticsBlueprintView } from './components/analytics/AnalyticsBlueprintView';

type ActiveSection =
  | 'dashboard'
  | 'tasks'
  | 'farms'
  | 'sensors'
  | 'disease'
  | 'alerts'
  | 'analytics';

export default function App() {
  const [activeSection, setActiveSection] = useState<ActiveSection>('dashboard');
  const [selectedFieldId, setSelectedFieldId] = useState<string>('FIELD-001');
  const [language, setLanguage] = useState<SupportedLanguage>('en');
  const [activeRole, setActiveRole] = useState<UserRole>('farmer');
  const [openTaskModalFromHeader, setOpenTaskModalFromHeader] = useState(false);

  // Authoritative Application State (pre-seeded for instant zero-latency rendering, synced via WebSocket + Firestore)
  const [farms, setFarms] = useState<Farm[]>(INITIAL_FARMS);
  const [fields, setFields] = useState<Field[]>(INITIAL_FIELDS);
  const [sensors, setSensors] = useState<SensorDevice[]>(INITIAL_SENSORS);
  const [readings, setReadings] = useState<SensorReading[]>(INITIAL_READINGS);
  const [predictions, setPredictions] = useState<PredictionRecord[]>(INITIAL_PREDICTIONS);
  const [alerts, setAlerts] = useState<AlertRecord[]>(INITIAL_ALERTS);
  const [feedbackList, setFeedbackList] = useState<FeedbackRecord[]>(INITIAL_FEEDBACK);
  const [tasks, setTasks] = useState<CollaborativeTask[]>(INITIAL_TASKS);
  const [diseaseAnalyses, setDiseaseAnalyses] = useState<LeafDiseaseAnalysisResult[]>(
    INITIAL_DISEASE_ANALYSES
  );
  const [collaborators, setCollaborators] = useState<CollaboratorPresence[]>([
    {
      clientId: 'local-farmer',
      uid: 'demo-farmer-01',
      displayName: 'Rajesh Patel',
      role: 'farmer',
      activeView: 'dashboard',
      activeFieldId: 'FIELD-001',
      color: '#16A34A',
      lastActiveAt: new Date().toISOString(),
    },
    {
      clientId: 'advisor-session-1',
      uid: 'advisor-01',
      displayName: 'Dr. Meera Sharma',
      role: 'advisor',
      activeView: 'alerts',
      activeFieldId: 'FIELD-001',
      color: '#0D9488',
      lastActiveAt: new Date().toISOString(),
    },
    {
      clientId: 'tech-session-1',
      uid: 'tech-01',
      displayName: 'Vikram Singh (IoT)',
      role: 'technician',
      activeView: 'sensors',
      activeFieldId: 'FIELD-003',
      color: '#2563EB',
      lastActiveAt: new Date().toISOString(),
    },
  ]);

  // Firebase Auth & Real-Time Connection State
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [firestoreOnline, setFirestoreOnline] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);
  const clientIdRef = useRef<string>(
    `client_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  );

  const t = TRANSLATIONS[language];

  // 1. Validate Firestore connectivity on boot & listen for Firebase Auth
  useEffect(() => {
    testFirestoreConnection().then((ok) => setFirestoreOnline(ok));
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setIsAuthReady(true);
      if (user && user.emailVerified) {
        // Ensure user public profile & default farm/field exist in Firestore so rules relational checks pass
        try {
          await setDoc(
            doc(db, 'users', user.uid, 'public', 'profile'),
            {
              uid: user.uid,
              displayName: (user.displayName || 'Lead Farmer').slice(0, 80),
              role: 'farmer',
              language: 'en',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
          await setDoc(
            doc(db, 'farms', 'FARM-001'),
            {
              ownerId: user.uid,
              name: 'North Field Farm',
              district: 'Karnal District',
              state: 'Uttar Pradesh',
              soilType: 'loamy',
              areaHectares: 4.5,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
          await setDoc(
            doc(db, 'fields', 'FIELD-001'),
            {
              ownerId: user.uid,
              farmId: 'FARM-001',
              name: 'North Canal Wheat Parcel A',
              crop: 'Wheat',
              variety: 'HD-2967',
              sowingDate: '2026-09-12',
              growthStage: 'flowering',
              areaHectares: 1.8,
              moistureThreshold: 25.0,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        } catch {
          // If farm/field already exists under another user or rules block overwrite, ignore safely
        }
      }
    });
    return () => unsubAuth();
  }, []);

  // 2. Attach Firestore onSnapshot listener for authenticated user's tasks
  useEffect(() => {
    if (!isAuthReady || !firebaseUser) return;
    const tasksQuery = query(
      collection(db, 'tasks'),
      where('ownerId', '==', firebaseUser.uid)
    );
    const unsubTasks = onSnapshot(
      tasksQuery,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const data = change.doc.data();
          const syncedTask: CollaborativeTask = {
            id: change.doc.id,
            ownerId: data.ownerId,
            farmId: data.farmId,
            fieldId: data.fieldId,
            title: data.title,
            description: data.description,
            category: data.category,
            priority: data.priority,
            status: data.status,
            assigneeName: data.assigneeName,
            assigneeId: data.assigneeId,
            dueDate: data.dueDate,
            linkedAlertId: data.linkedAlertId,
            createdAt:
              data.createdAt?.toDate?.()?.toISOString?.() || new Date().toISOString(),
            updatedAt:
              data.updatedAt?.toDate?.()?.toISOString?.() || new Date().toISOString(),
            comments: [],
            syncSource: 'firestore',
          };
          setTasks((prev) => upsertCollaborativeTask(prev, syncedTask));
        });
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'tasks');
      }
    );
    return () => unsubTasks();
  }, [isAuthReady, firebaseUser]);

  // 3. Connect to Full-Stack WebSocket Server (/ws) for Real-Time Multi-User Sync
  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let isUnmounted = false;

    function connectWs() {
      if (isUnmounted) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isUnmounted) return;
        setWsConnected(true);
        ws.send(
          JSON.stringify({
            type: 'presence:join',
            payload: {
              clientId: clientIdRef.current,
              uid: firebaseUser?.uid || 'demo-farmer-01',
              displayName: firebaseUser?.displayName || 'Rajesh Patel (Lead Farmer)',
              role: activeRole,
              activeView: activeSection,
              activeFieldId: selectedFieldId,
              color: '#16A34A',
            },
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          const { type, payload } = msg;
          if (type === 'init:state' && payload) {
            if (payload.farms) setFarms(payload.farms);
            if (payload.fields) setFields(payload.fields);
            if (payload.sensors) setSensors(payload.sensors);
            if (payload.readings) setReadings(payload.readings);
            if (payload.predictions) setPredictions(payload.predictions);
            if (payload.alerts) setAlerts(payload.alerts);
            if (payload.feedback) setFeedbackList(payload.feedback);
            if (payload.tasks) setTasks(payload.tasks);
            if (payload.diseaseAnalyses) setDiseaseAnalyses(payload.diseaseAnalyses);
            if (payload.collaborators) setCollaborators(payload.collaborators);
          } else if (type === 'presence:list' && Array.isArray(payload)) {
            setCollaborators(payload);
          } else if (type === 'task:created' || type === 'task:updated') {
            setTasks((prev) => upsertCollaborativeTask(prev, payload as CollaborativeTask));
          } else if (type === 'task:deleted' && payload?.id) {
            setTasks((prev) => prev.filter((t) => t.id !== payload.id));
          } else if (type === 'telemetry:ingested' && payload) {
            if (payload.reading) {
              setReadings((prev) => {
                if (prev.some((r) => r.eventId === payload.reading.eventId)) return prev;
                return [payload.reading, ...prev];
              });
            }
            if (payload.prediction) {
              setPredictions((prev) => [payload.prediction, ...prev]);
            }
            if (payload.alert) {
              setAlerts((prev) => {
                const idx = prev.findIndex((a) => a.id === payload.alert.id);
                if (idx >= 0) {
                  const next = [...prev];
                  next[idx] = payload.alert;
                  return next;
                }
                return [payload.alert, ...prev];
              });
            }
            if (payload.autoCreatedTask) {
              setTasks((prev) =>
                upsertCollaborativeTask(prev, payload.autoCreatedTask)
              );
            }
            if (payload.sensor) {
              setSensors((prev) =>
                prev.map((s) => (s.id === payload.sensor.id ? payload.sensor : s))
              );
            }
          } else if (type === 'alert:updated' && payload) {
            setAlerts((prev) =>
              prev.map((a) => (a.id === payload.id ? payload : a))
            );
          } else if (type === 'feedback:recorded' && payload) {
            setFeedbackList((prev) => [payload, ...prev]);
          } else if (type === 'disease:analyzed' && payload) {
            setDiseaseAnalyses((prev) => {
              if (prev.some((d) => d.id === payload.id)) return prev;
              return [payload, ...prev];
            });
          } else if (type === 'farm:created' && payload) {
            setFarms((prev) => {
              if (prev.some((f) => f.id === payload.id)) return prev;
              return [payload, ...prev];
            });
          } else if (type === 'field:created' && payload) {
            setFields((prev) => {
              if (prev.some((f) => f.id === payload.id)) return prev;
              return [...prev, payload];
            });
          } else if (type === 'field:updated' && payload) {
            setFields((prev) =>
              prev.map((f) => (f.id === payload.id ? payload : f))
            );
          } else if (type === 'sensor:registered' && payload) {
            setSensors((prev) => {
              if (prev.some((s) => s.id === payload.id)) return prev;
              return [...prev, payload];
            });
          }
        } catch {
          // Ignore malformed frame
        }
      };

      ws.onclose = () => {
        if (isUnmounted) return;
        setWsConnected(false);
        reconnectTimer = setTimeout(connectWs, 3000);
      };
    }

    connectWs();
    return () => {
      isUnmounted = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [firebaseUser]);

  // Broadcast presence update when active view, role, or field changes
  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'presence:update',
          payload: {
            clientId: clientIdRef.current,
            uid: firebaseUser?.uid || 'demo-farmer-01',
            displayName: firebaseUser?.displayName || 'Rajesh Patel (Lead Farmer)',
            role: activeRole,
            activeView: activeSection,
            activeFieldId: selectedFieldId,
          },
        })
      );
    }
  }, [activeSection, selectedFieldId, activeRole, firebaseUser]);

  // ============================================================================
  // Action Handlers (Optimistic + Server REST/WS + Firestore when signed in)
  // ============================================================================

  const handleCreateTask = async (taskInput: {
    title: string;
    description: string;
    farmId: string;
    fieldId: string;
    category: TaskCategory;
    priority: TaskPriority;
    assigneeName: string;
    assigneeId: string;
    dueDate: string;
    safetyInterlockRequired: boolean;
  }) => {
    const taskId = `TASK-${Date.now().toString().slice(-5)}`;
    const nowIso = new Date().toISOString();
    const optimisticTask: CollaborativeTask = {
      id: taskId,
      ownerId: firebaseUser?.uid || 'demo-farmer-01',
      ...taskInput,
      status: 'todo',
      createdAt: nowIso,
      updatedAt: nowIso,
      comments: [],
      syncSource: 'optimistic',
    };
    setTasks((prev) => upsertCollaborativeTask(prev, optimisticTask));

    await fetch('/api/v1/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: taskId,
        ownerId: firebaseUser?.uid || 'demo-farmer-01',
        ...taskInput,
      }),
    });

    if (firebaseUser && firebaseUser.emailVerified) {
      const pathForWrite = `tasks/${taskId}`;
      try {
        await setDoc(doc(db, 'tasks', taskId), {
          ownerId: firebaseUser.uid,
          farmId: taskInput.farmId,
          fieldId: taskInput.fieldId,
          title: taskInput.title.slice(0, 160),
          description: taskInput.description.slice(0, 1000),
          category: taskInput.category,
          priority: taskInput.priority,
          status: 'todo',
          assigneeName: taskInput.assigneeName.slice(0, 80),
          assigneeId: taskInput.assigneeId,
          dueDate: taskInput.dueDate.slice(0, 32),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, pathForWrite);
      }
    }
  };

  const handleUpdateTaskStatus = async (
    taskId: string,
    status: TaskStatus,
    safetyConfirmedBy?: string
  ) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status,
              safetyConfirmedBy: safetyConfirmedBy || t.safetyConfirmedBy,
              updatedAt: new Date().toISOString(),
            }
          : t
      )
    );

    await fetch(`/api/v1/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, safetyConfirmedBy }),
    });

    if (firebaseUser && firebaseUser.emailVerified) {
      const target = tasks.find((t) => t.id === taskId);
      if (target && target.ownerId === firebaseUser.uid && target.status !== 'completed') {
        try {
          await updateDoc(doc(db, 'tasks', taskId), {
            status,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `tasks/${taskId}`);
        }
      }
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    await fetch(`/api/v1/tasks/${taskId}`, { method: 'DELETE' });
  };

  const handleAddComment = async (taskId: string, content: string) => {
    await fetch(`/api/v1/tasks/${taskId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        authorId: firebaseUser?.uid || 'demo-farmer-01',
        authorName: firebaseUser?.displayName || 'Rajesh Patel (Lead Farmer)',
        authorRole: activeRole,
        content,
      }),
    });
  };

  const handleIngestTelemetry = async (
    payload: Partial<DeviceTelemetryPayload> & {
      transport?: 'mqtt' | 'http_fallback';
      forced_confidence?: number;
    }
  ) => {
    const res = await fetch('/api/v1/readings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, message: data.message || 'Telemetry validation failed.' };
    }
    const alertInfo = data.alert
      ? data.deduplicatedExistingAlert
        ? `Updated deduplicated ${data.alert.severity.toUpperCase()} alert (${data.alert.occurrenceCount}×).`
        : `Issued new ${data.alert.severity.toUpperCase()} alert & auto-assigned collaborative task.`
      : data.prediction?.status === 'needs_review'
      ? `Confidence gate (${Math.round(data.prediction.confidence * 100)}% < 70%) marked prediction NEEDS_REVIEW; no high-impact alert issued.`
      : 'Prediction nominal; no alert needed.';
    return {
      ok: true,
      message: `Ingested ${data.reading.deviceId} seq #${data.reading.sequence} (${data.reading.soilMoisture}% moisture). ${alertInfo}`,
    };
  };

  const handleSyncOfflineBuffer = async (events: Partial<DeviceTelemetryPayload>[]) => {
    const res = await fetch('/api/v1/readings/sync-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events }),
    });
    const data = await res.json();
    return {
      acceptedCount: data.acceptedCount || 0,
      duplicatesSkippedCount: data.duplicatesSkippedCount || 0,
    };
  };

  const handleRegisterSensor = async (input: {
    device_id: string;
    field_id: string;
    firmware_version: string;
    moisture_offset: number;
    temperature_offset: number;
  }) => {
    const res = await fetch('/api/v1/sensors/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, message: data.message || 'Device registration failed.' };
    }
    return {
      ok: true,
      message: `Paired sensor ${data.deviceId} on MQTT topic ${data.mqttTopic}.`,
    };
  };

  const handleUpdateAlertStatus = async (alertId: string, status: AlertStatus) => {
    await fetch(`/api/v1/alerts/${alertId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
  };

  const handleSubmitFeedback = async (input: {
    prediction_id: string;
    field_id: string;
    farmer_label: FarmerFeedbackLabel;
    comment: string;
  }) => {
    await fetch('/api/v1/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...input,
        ownerId: firebaseUser?.uid || 'demo-farmer-01',
      }),
    });
  };

  const handleAnalyzeLeaf = async (input: {
    field_id: string;
    sample_preset: string;
    image_base64?: string;
    mime_type?: string;
    notes?: string;
  }): Promise<LeafDiseaseAnalysisResult> => {
    const res = await fetch('/api/v1/disease/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    return data as LeafDiseaseAnalysisResult;
  };

  const handleCreateFarm = async (input: {
    name: string;
    district: string;
    state: string;
    soilType: SoilType;
    areaHectares: number;
  }) => {
    const res = await fetch('/api/v1/farms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: input.name,
        location: { district: input.district, state: input.state },
        soil_type: input.soilType,
        area_hectares: input.areaHectares,
        ownerId: firebaseUser?.uid || 'demo-farmer-01',
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, message: data.message || 'Could not register farm.' };
    }
    return {
      ok: true,
      message: `Registered farm "${data.name}" (${data.areaHectares} ha, ${data.soilType} soil).`,
    };
  };

  const handleCreateField = async (input: {
    farmId: string;
    name: string;
    crop: string;
    variety: string;
    sowingDate: string;
    growthStage: GrowthStage;
    areaHectares: number;
    moistureThreshold: number;
  }) => {
    const res = await fetch(`/api/v1/farms/${input.farmId}/fields`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...input,
        ownerId: firebaseUser?.uid || 'demo-farmer-01',
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, message: data.message || 'Could not register field.' };
    }
    setSelectedFieldId(data.id);
    return {
      ok: true,
      message: `Registered field "${data.name}" (${data.crop} - ${data.variety}) in ${data.farmId}.`,
    };
  };

  const handleUpdateFieldStage = async (
    fieldId: string,
    growthStage: GrowthStage,
    moistureThreshold: number
  ) => {
    await fetch(`/api/v1/fields/${fieldId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ growthStage, moistureThreshold }),
    });
  };

  // Current selected field context for Dashboard
  const currentField =
    fields.find((f) => f.id === selectedFieldId) || fields[0];
  const currentSensor =
    sensors.find((s) => s.fieldId === currentField.id) || sensors[0];
  const currentFieldReadings = readings.filter((r) => r.fieldId === currentField.id);
  const latestReading = currentFieldReadings[0];
  const currentPrediction =
    predictions.find((p) => p.fieldId === currentField.id) || predictions[0];
  const activeFieldAlerts = alerts.filter(
    (a) => a.fieldId === currentField.id && a.status !== 'resolved'
  );
  const pendingTasksCount = tasks.filter((tk) => tk.status !== 'completed').length;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Strict 3-Zone Top Bar Contract (frontend-design Section 2) */}
      <header className="flex items-center justify-between gap-8 px-6 py-3.5 bg-white border-b border-slate-200 sticky top-0 z-30">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#overview"
          onClick={(e) => {
            e.preventDefault();
            setActiveSection('dashboard');
          }}
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          AgriPulse Command
        </a>

        {/* Zone 2: 5 concise single-line navigation links */}
        <nav
          aria-label="Primary platform navigation"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
        >
          {(
            [
              { id: 'dashboard', label: t.navDashboard },
              { id: 'tasks', label: `${t.navTasks} (${pendingTasksCount})` },
              { id: 'sensors', label: t.navSensors },
              { id: 'disease', label: t.navDisease },
              { id: 'alerts', label: t.navAlerts },
            ] as const
          ).map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              onClick={(e) => {
                e.preventDefault();
                setActiveSection(item.id);
              }}
              className={`transition-colors whitespace-nowrap shrink-0 py-1 ${
                activeSection === item.id
                  ? 'text-emerald-800 font-semibold underline underline-offset-8 decoration-2 decoration-emerald-700'
                  : 'hover:text-slate-900'
              }`}
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              setActiveSection('tasks');
              setOpenTaskModalFromHeader(true);
            }}
            className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {t.primaryCtaTask}
          </button>
        </div>
      </header>

      {/* Workspace Context Bar (Field Selector, Secondary Views, Language, Auth & Live Sync Status) */}
      <div className="bg-slate-900 text-slate-200 px-6 py-2.5 border-b border-slate-800">
        <div className="max-w-[1360px] mx-auto flex flex-wrap items-center justify-between gap-4 text-xs">
          {/* Left: Active Parcel Selector & Secondary Modules */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor="global-field-select" className="text-slate-400 font-medium whitespace-nowrap">
                Field Context:
              </label>
              <select
                id="global-field-select"
                value={selectedFieldId}
                onChange={(e) => setSelectedFieldId(e.target.value)}
                className="px-2.5 py-1 text-xs font-medium bg-slate-800 text-white border border-slate-700 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="all">All Registered Fields ({fields.length})</option>
                {fields.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.id}: {f.name} ({f.crop} · {f.growthStage})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 border-l border-slate-700 pl-3">
              <button
                type="button"
                onClick={() => setActiveSection('farms')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeSection === 'farms'
                    ? 'bg-emerald-700 text-white'
                    : 'bg-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                {t.navFarms}
              </button>
              <button
                type="button"
                onClick={() => setActiveSection('analytics')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeSection === 'analytics'
                    ? 'bg-emerald-700 text-white'
                    : 'bg-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                {t.navAnalytics}
              </button>
            </div>
          </div>

          {/* Right: Collaborator Role, Language, Live WebSocket/Firestore Telemetry Status & Google Sign-In */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5 font-mono tabular-nums">
              <span
                className={`w-2 h-2 rounded-full ${
                  wsConnected ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
                aria-hidden="true"
              />
              <span className="text-slate-300">
                {wsConnected ? 'Live WS Sync' : 'Reconnecting WS'}
              </span>
              <span aria-hidden="true" className="text-slate-600">
                ·
              </span>
              <span className="text-slate-300">
                {collaborators.length} Online
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <label htmlFor="role-select" className="text-slate-400">
                Role:
              </label>
              <select
                id="role-select"
                value={activeRole}
                onChange={(e) => setActiveRole(e.target.value as UserRole)}
                className="bg-slate-800 text-slate-200 border border-slate-700 rounded px-2 py-0.5 text-xs"
              >
                <option value="farmer">Farmer</option>
                <option value="advisor">Agri Advisor</option>
                <option value="technician">IoT Technician</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <label htmlFor="lang-select" className="text-slate-400">
                Lang:
              </label>
              <select
                id="lang-select"
                value={language}
                onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
                className="bg-slate-800 text-slate-200 border border-slate-700 rounded px-2 py-0.5 text-xs"
              >
                <option value="en">English</option>
                <option value="hi">हिन्दी (Hindi)</option>
                <option value="es">Español</option>
              </select>
            </div>

            {firebaseUser ? (
              <div className="flex items-center gap-2">
                <span className="text-emerald-300 font-medium truncate max-w-[140px]">
                  {firebaseUser.displayName || firebaseUser.email}
                </span>
                <button
                  type="button"
                  onClick={() => signOutUser()}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 rounded text-slate-200 cursor-pointer"
                >
                  <LogOut className="w-3 h-3" />
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() =>
                  signInWithGooglePopup().catch((err) =>
                    console.warn('Google sign-in popup closed or blocked in preview:', err)
                  )
                }
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-white whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LogIn className="w-3 h-3 text-emerald-400" />
                Google Sign-In (Firestore Cloud Sync)
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Container (1440px baseline, generous whitespace) */}
      <main className="flex-1 max-w-[1360px] w-full mx-auto px-6 py-6 space-y-6">
        {activeSection === 'dashboard' && (
          <div className="space-y-6">
            {/* Blueprint 8-Step Pipeline Banner */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="text-[11px] font-mono text-emerald-800 font-semibold">
                  ARCHITECTURE PRINCIPLE (SECTION 1 & 20) · {firestoreOnline ? 'FIRESTORE READY' : 'LOCAL MODE'}
                </div>
                <div className="text-sm font-bold text-slate-900">
                  {t.pipelineTitle}
                </div>
              </div>
              <div className="text-xs text-slate-600 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
                <span>{t.mvpBoundaryNotice}</span>
              </div>
            </div>

            {/* Stale Data Banner if Current Field Sensor is Stale (Section 4.6 & 11) */}
            {currentSensor?.status === 'stale' && (
              <div
                role="alert"
                className="p-4 rounded-xl bg-amber-50 border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="text-sm font-bold text-amber-900 flex items-center gap-2">
                    <WifiOff className="w-4 h-4 text-amber-700" />
                    {t.staleWarningTitle} ({currentSensor.deviceId} in {currentField.name})
                  </div>
                  <p className="text-xs text-amber-800">
                    Last seen at{' '}
                    <span className="font-mono font-semibold">
                      {new Date(currentSensor.lastSeen).toLocaleTimeString()}
                    </span>{' '}
                    (exceeds 60-minute freshness window). Decision engine has paused live irrigation predictions for this parcel until buffered MQTT readings synchronize.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSection('sensors')}
                  className="px-3.5 py-2 text-xs font-semibold text-white bg-amber-800 rounded-lg hover:bg-amber-900 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Open Sensors & Replay Offline Buffer
                </button>
              </div>
            )}

            {/* Dominant Focal Anchor: Farmer-First Actionable Decision Banner + Field Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              <div className="lg:col-span-8 bg-white p-6 rounded-xl border border-slate-200 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-mono tabular-nums text-slate-500">
                    <span className="font-bold text-slate-900">{currentField.id}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      Crop: {currentField.crop} ({currentField.variety})
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Stage: {currentField.growthStage.toUpperCase()}</span>
                    <span aria-hidden="true">·</span>
                    <span>Area: {currentField.areaHectares} ha</span>
                    <span aria-hidden="true">·</span>
                    <span>Threshold: {currentField.moistureThreshold}% Moisture</span>
                  </div>

                  <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                    {currentField.name} — Field Decision & Task Summary
                  </h1>

                  {/* Plain-language Recommended Next Action First (Blueprint Section 11) */}
                  <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-1.5 mt-2">
                    <div className="text-xs font-bold text-emerald-900 flex items-center justify-between">
                      <span>{t.recommendedActionFirst}:</span>
                      <span className="font-mono tabular-nums">
                        Model: {currentPrediction?.modelVersion} · Confidence:{' '}
                        {Math.round((currentPrediction?.confidence || 0.85) * 100)}%
                      </span>
                    </div>
                    <p className="text-base font-bold text-slate-900">
                      {currentPrediction?.recommendation}
                    </p>
                    <p className="text-xs text-slate-700">
                      {currentPrediction?.explanation}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                  <div className="text-xs text-slate-500 font-mono tabular-nums">
                    Active Alerts: <strong className="text-slate-900">{activeFieldAlerts.length}</strong> · Open Field Tasks:{' '}
                    <strong className="text-slate-900">{pendingTasksCount}</strong> · Sensor:{' '}
                    <strong
                      className={
                        currentSensor?.status === 'online'
                          ? 'text-emerald-700'
                          : 'text-amber-700'
                      }
                    >
                      {currentSensor?.deviceId} ({currentSensor?.status.toUpperCase()})
                    </strong>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveSection('sensors')}
                      className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
                    >
                      Simulate Telemetry
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSection('tasks')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      Open Collaborative Task Board
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Live Collaborators & Risk Score Card */}
              <div className="lg:col-span-4 bg-white p-6 rounded-xl border border-slate-200 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <Users className="w-4 h-4 text-emerald-700" />
                      Live Team Collaboration
                    </h2>
                    <span className="text-xs font-mono tabular-nums text-emerald-700 font-semibold">
                      {collaborators.length} Active
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100 text-xs">
                    {collaborators.map((c) => (
                      <div
                        key={c.clientId}
                        className="py-2 flex items-center justify-between gap-2"
                      >
                        <div>
                          <div className="font-semibold text-slate-900">
                            {c.displayName}
                          </div>
                          <div className="text-slate-500">
                            Role: {c.role} · Viewing: {c.activeView}
                          </div>
                        </div>
                        <span className="font-mono text-[11px] text-slate-500">
                          {c.activeFieldId}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 font-medium">
                      Irrigation Need Risk Score:
                    </span>
                    <span
                      className={`font-mono font-bold tabular-nums text-sm ${
                        (currentPrediction?.riskScore || 0) >= 70
                          ? 'text-red-700'
                          : (currentPrediction?.riskScore || 0) >= 45
                          ? 'text-amber-700'
                          : 'text-emerald-700'
                      }`}
                    >
                      {currentPrediction?.riskScore ?? 0}/100 ({currentPrediction?.severity.toUpperCase()})
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        (currentPrediction?.riskScore || 0) >= 70
                          ? 'bg-red-600'
                          : (currentPrediction?.riskScore || 0) >= 45
                          ? 'bg-amber-500'
                          : 'bg-emerald-600'
                      }`}
                      style={{ width: `${Math.min(100, currentPrediction?.riskScore || 10)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 4-Column Telemetry Strip (Full Width Below Hero Split per Pre-Flight Rule 13) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Capacitive Soil Moisture</span>
                  <Droplets className="w-4 h-4 text-emerald-700" />
                </div>
                <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                  {latestReading ? `${latestReading.soilMoisture.toFixed(1)}%` : '—'}
                </div>
                <div className="text-xs font-mono tabular-nums text-slate-500">
                  Target Threshold: {currentField.moistureThreshold.toFixed(1)}% ·{' '}
                  <span
                    className={
                      latestReading &&
                      latestReading.soilMoisture < currentField.moistureThreshold
                        ? 'text-red-700 font-semibold'
                        : 'text-emerald-700 font-semibold'
                    }
                  >
                    {latestReading &&
                    latestReading.soilMoisture < currentField.moistureThreshold
                      ? 'BELOW THRESHOLD'
                      : 'ADEQUATE'}
                  </span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Microclimate Temp & Humidity</span>
                  <Thermometer className="w-4 h-4 text-amber-600" />
                </div>
                <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                  {latestReading
                    ? `${latestReading.temperature.toFixed(1)}°C / ${latestReading.humidity.toFixed(0)}%`
                    : '—'}
                </div>
                <div className="text-xs font-mono tabular-nums text-slate-500">
                  Recent Rain: {latestReading ? `${latestReading.rainfall.toFixed(1)} mm` : '0.0 mm'}
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Soil Acidity (pH) & NPK</span>
                  <Microscope className="w-4 h-4 text-slate-700" />
                </div>
                <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                  pH {latestReading?.ph ?? currentField.soilCharacteristics.phTarget}
                </div>
                <div className="text-xs font-mono tabular-nums text-slate-500">
                  N: {latestReading?.nitrogen ?? 42} · P: {latestReading?.phosphorus ?? 28} · K:{' '}
                  {latestReading?.potassium ?? 35} mg/kg
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>ESP32 Telemetry Freshness</span>
                  <Cpu className="w-4 h-4 text-slate-700" />
                </div>
                <div className="text-lg font-bold font-mono tabular-nums text-slate-900 flex items-center gap-1.5">
                  {currentSensor?.status === 'online' ? (
                    <Wifi className="w-4 h-4 text-emerald-700" />
                  ) : (
                    <WifiOff className="w-4 h-4 text-amber-700" />
                  )}
                  {currentSensor?.deviceId} ({currentSensor?.status.toUpperCase()})
                </div>
                <div className="text-xs font-mono tabular-nums text-slate-500">
                  Seq #{latestReading?.sequence ?? '—'} · Battery {currentSensor?.batteryPct}%
                </div>
              </div>
            </div>

            {/* Two-Column Operational Split: Active Collaborative Tasks + Active Field Alerts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Real-Time Collaborative Tasks Queue */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-emerald-700" />
                    <h2 className="text-base font-bold text-slate-900">
                      Collaborative Field Tasks ({tasks.length})
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveSection('tasks')}
                    className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 cursor-pointer"
                  >
                    Manage All Tasks →
                  </button>
                </div>

                <div className="divide-y divide-slate-200">
                  {tasks.slice(0, 4).map((task) => (
                    <div key={task.id} className="p-4 space-y-2">
                      <div className="flex items-center justify-between text-xs font-mono tabular-nums text-slate-500">
                        <span>
                          <strong className="text-slate-800">{task.id}</strong> · {task.fieldId} ·{' '}
                          <span
                            className={
                              task.priority === 'high'
                                ? 'text-red-700 font-semibold'
                                : 'text-slate-700'
                            }
                          >
                            {task.priority.toUpperCase()}
                          </span>
                        </span>
                        <span className="font-semibold text-slate-800">
                          {task.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                      <div className="text-sm font-bold text-slate-900">{task.title}</div>
                      <div className="flex items-center justify-between text-xs text-slate-600 pt-1">
                        <span>Assignee: {task.assigneeName}</span>
                        <div className="flex items-center gap-1.5">
                          {task.status !== 'completed' && !task.safetyInterlockRequired && (
                            <button
                              type="button"
                              onClick={() => handleUpdateTaskStatus(task.id, 'completed')}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-800 bg-emerald-50 rounded hover:bg-emerald-100 cursor-pointer"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              Complete
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setActiveSection('tasks')}
                            className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 rounded hover:bg-slate-200 cursor-pointer"
                          >
                            Inspect
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: Active Agronomic Alerts & Recommendations */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <h2 className="text-base font-bold text-slate-900">
                      Active Agronomic Alerts & Next Steps ({alerts.length})
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveSection('alerts')}
                    className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 cursor-pointer"
                  >
                    Open Alerts & Feedback →
                  </button>
                </div>

                <div className="divide-y divide-slate-200">
                  {alerts.slice(0, 3).map((alert) => (
                    <div key={alert.id} className="p-4 space-y-2">
                      <div className="flex items-center justify-between text-xs font-mono tabular-nums text-slate-500">
                        <span
                          className={
                            alert.severity === 'high'
                              ? 'text-red-700 font-bold'
                              : 'text-amber-700 font-bold'
                          }
                        >
                          {alert.severity.toUpperCase()} SEVERITY · {alert.fieldId}
                        </span>
                        <span>
                          Status: <strong>{alert.status.toUpperCase()}</strong> · Conf:{' '}
                          {Math.round(alert.confidence * 100)}%
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-slate-900">
                        Next Step: {alert.recommendation}
                      </p>
                      <p className="text-xs text-slate-600">{alert.message}</p>
                      <div className="flex items-center justify-end gap-2 pt-1">
                        {alert.status === 'active' && (
                          <button
                            type="button"
                            onClick={() => handleUpdateAlertStatus(alert.id, 'acknowledged')}
                            className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 rounded hover:bg-slate-200 cursor-pointer"
                          >
                            Acknowledge
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setActiveSection('alerts')}
                          className="px-2.5 py-1 text-xs font-semibold text-emerald-800 bg-emerald-50 rounded hover:bg-emerald-100 cursor-pointer"
                        >
                          Give Farmer Feedback
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'tasks' && (
          <TaskCollaborationView
            tasks={tasks}
            farms={farms}
            fields={fields}
            collaborators={collaborators}
            currentUser={{
              uid: firebaseUser?.uid || 'demo-farmer-01',
              displayName: firebaseUser?.displayName || 'Rajesh Patel (Lead Farmer)',
              role: activeRole,
              isFirebaseAuthenticated: Boolean(firebaseUser),
            }}
            selectedFieldId={selectedFieldId}
            onCreateTask={handleCreateTask}
            onUpdateTaskStatus={handleUpdateTaskStatus}
            onDeleteTask={handleDeleteTask}
            onAddComment={handleAddComment}
            openModalOnMount={openTaskModalFromHeader}
            onModalClose={() => setOpenTaskModalFromHeader(false)}
          />
        )}

        {activeSection === 'farms' && (
          <FarmsFieldsView
            farms={farms}
            fields={fields}
            onCreateFarm={handleCreateFarm}
            onCreateField={handleCreateField}
            onUpdateFieldStage={handleUpdateFieldStage}
          />
        )}

        {activeSection === 'sensors' && (
          <SensorsTelemetryView
            sensors={sensors}
            readings={readings}
            fields={fields}
            selectedFieldId={selectedFieldId}
            onIngestTelemetry={handleIngestTelemetry}
            onSyncOfflineBuffer={handleSyncOfflineBuffer}
            onRegisterSensor={handleRegisterSensor}
          />
        )}

        {activeSection === 'disease' && (
          <DiseaseDetectionView
            fields={fields}
            selectedFieldId={selectedFieldId}
            analyses={diseaseAnalyses}
            onAnalyzeLeaf={handleAnalyzeLeaf}
            onCreateFollowUpTask={async (analysis) => {
              const targetField =
                fields.find((f) => f.id === analysis.fieldId) || fields[0];
              await handleCreateTask({
                title: `Leaf Disease Follow-Up: ${analysis.diseaseClass}`,
                description: `${analysis.explanation} Recommended Next Step: ${analysis.recommendedNextStep}`,
                farmId: targetField.farmId,
                fieldId: targetField.id,
                category: 'disease_management',
                priority: analysis.severity,
                assigneeName: 'Dr. Meera Sharma (Agri Advisor)',
                assigneeId: 'advisor-01',
                dueDate: new Date().toISOString().slice(0, 10),
                safetyInterlockRequired: false,
              });
            }}
          />
        )}

        {activeSection === 'alerts' && (
          <AlertsDecisionView
            alerts={alerts}
            predictions={predictions}
            feedbackList={feedbackList}
            fields={fields}
            selectedFieldId={selectedFieldId}
            onUpdateAlertStatus={handleUpdateAlertStatus}
            onSubmitFeedback={handleSubmitFeedback}
            onCreateTaskFromAlert={async (alert) => {
              const targetField =
                fields.find((f) => f.id === alert.fieldId) || fields[0];
              await handleCreateTask({
                title: `Alert Follow-Up (${alert.severity.toUpperCase()}): ${targetField.name}`,
                description: `${alert.message} Recommended Action: ${alert.recommendation}`,
                farmId: targetField.farmId,
                fieldId: targetField.id,
                category:
                  alert.type === 'irrigation_need' ? 'irrigation' : 'scouting',
                priority: alert.severity,
                assigneeName: 'Rajesh Patel (Lead Farmer)',
                assigneeId: targetField.ownerId,
                dueDate: new Date().toISOString().slice(0, 10),
                safetyInterlockRequired: alert.severity === 'high',
              });
              setActiveSection('tasks');
            }}
          />
        )}

        {activeSection === 'analytics' && (
          <AnalyticsBlueprintView
            fields={fields}
            readings={readings}
            alerts={alerts}
            tasks={tasks}
            selectedFieldId={selectedFieldId}
          />
        )}
      </main>

      {/* Quiet Footer (No Ornamental Telemetry Tickers per Frontend Design Constitution) */}
      <footer className="bg-white border-t border-slate-200 px-6 py-4 mt-12">
        <div className="max-w-[1360px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            AgriPulse Command · Smart Precision Agriculture & Collaborative Task Platform (Blueprint v1.1)
          </div>
          <div className="flex items-center gap-4">
            <a
              href="/assets/aistudio/Smart_Precision_Agriculture_Full_HLD_LLD_Blueprint_38164264.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-900 underline"
            >
              Engineering Blueprint PDF
            </a>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => setActiveSection('analytics')}
              className="hover:text-slate-900 cursor-pointer"
            >
              Architecture & Governance
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

import { SupportedLanguage } from '../types/agriculture';

export const TRANSLATIONS: Record<
  SupportedLanguage,
  {
    navDashboard: string;
    navTasks: string;
    navFarms: string;
    navSensors: string;
    navDisease: string;
    navAlerts: string;
    navAnalytics: string;
    primaryCtaTask: string;
    pipelineTitle: string;
    recommendedActionFirst: string;
    staleWarningTitle: string;
    mvpBoundaryNotice: string;
  }
> = {
  en: {
    navDashboard: 'Overview',
    navTasks: 'Task Collaboration',
    navFarms: 'Farms & Fields',
    navSensors: 'Sensors & MQTT',
    navDisease: 'Disease Vision',
    navAlerts: 'Alerts & Feedback',
    navAnalytics: 'Analytics & Blueprint',
    primaryCtaTask: 'New Field Task',
    pipelineTitle: 'Sense → Validate → Store → Understand → Predict → Decide → Alert → Learn',
    recommendedActionFirst: 'Recommended Next Action',
    staleWarningTitle: 'Stale Telemetry Notice — Old Data Is Not Shown As Live',
    mvpBoundaryNotice:
      'Safety Interlock Active: No autonomous drone spraying or unconfirmed pump actuation. Human verification required.',
  },
  hi: {
    navDashboard: 'डैशबोर्ड (Overview)',
    navTasks: 'कार्य सहयोग (Tasks)',
    navFarms: 'खेत और फसल (Fields)',
    navSensors: 'सेंसर (Sensors)',
    navDisease: 'रोग पहचान (Leaf Vision)',
    navAlerts: 'चेतावनी (Alerts)',
    navAnalytics: 'विश्लेषण (Analytics)',
    primaryCtaTask: 'नया कार्य जोड़ें',
    pipelineTitle: 'सेंस → सत्यापित → स्टोर → समझें → अनुमान → निर्णय → अलर्ट → सीखें',
    recommendedActionFirst: 'सुझाया गया अगला कदम (Recommended Action)',
    staleWarningTitle: 'पुराना डेटा चेतावनी — पुराना सेंसर डेटा लाइव नहीं माना जाता',
    mvpBoundaryNotice:
      'सुरक्षा नियम: बिना किसान की पुष्टि के पंप या स्प्रे स्वचालित रूप से चालू नहीं होगा।',
  },
  es: {
    navDashboard: 'Panel General',
    navTasks: 'Tareas y Equipo',
    navFarms: 'Fincas y Parcelas',
    navSensors: 'Sensores y MQTT',
    navDisease: 'Visión Foliares',
    navAlerts: 'Alertas y Feedback',
    navAnalytics: 'Analítica y Plano',
    primaryCtaTask: 'Nueva Tarea',
    pipelineTitle: 'Captar → Validar → Guardar → Entender → Predecir → Decidir → Alertar → Aprender',
    recommendedActionFirst: 'Acción Recomendada Inmediata',
    staleWarningTitle: 'Aviso de Telemetría Antigua — Datos antiguos no se muestran como vivos',
    mvpBoundaryNotice:
      'Bloqueo de Seguridad MVP: Sin pulverización autónoma ni activación de bombas sin confirmación humana.',
  },
};

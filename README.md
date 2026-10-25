
# AgriPulse Command

AgriPulse Command is a farmer-first precision-agriculture dashboard and field-team collaboration app. It brings farm records, sensor telemetry, agronomic decision support, alerts, leaf-disease analysis, and operational tasks together in one workspace.

The project follows the blueprint workflow:

**Sense → Validate → Store → Understand → Predict → Decide → Alert → Learn**

The full High-Level and Low-Level Design blueprint is available at [`public/assets/aistudio/Smart_Precision_Agriculture_Full_HLD_LLD_Blueprint_38164264.pdf`](public/assets/aistudio/Smart_Precision_Agriculture_Full_HLD_LLD_Blueprint_38164264.pdf). The analytics screen also links to this document.

## Features

- **Dashboard:** At-a-glance field conditions, active agronomic alerts, and collaborative work.
- **Farm and field registry:** Organize farms and parcels with crop, variety, area, growth stage, and soil context.
- **Sensor telemetry:** View ESP32 sensor status and readings, including soil moisture, temperature, humidity, rainfall, and optional soil nutrients. The API accepts telemetry over HTTP and supports validation, calibration offsets, stale/out-of-range checks, and duplicate-reading detection.
- **Agronomic decisions and alerts:** Evaluate irrigation needs and crop-environment risks, explain recommendations, track alert status, and capture farmer feedback.
- **Leaf-disease analysis:** Submit a leaf image or specimen preset for a quality-gated analysis, review confidence and limitations, and create a follow-up task.
- **Collaborative field tasks:** Assign and filter tasks, track their status and priority, add comments, and coordinate field-team presence over WebSockets.
- **Analytics and blueprint reference:** Review field telemetry trends and open the engineering blueprint.
- **Authentication and persistence integration:** Google sign-in and Firestore-backed task synchronization are provided through Firebase. English, Hindi, and Spanish UI translations are included.

The application starts with sample farms, fields, sensor readings, alerts, and tasks so the dashboard can be explored immediately. API and WebSocket domain state is held in server memory and resets when the server restarts; it is not a production database.

## Technology

- React 19, TypeScript, and Vite
- Tailwind CSS 4, Motion, and Lucide icons
- Express and WebSockets (`ws`) for the development/API server and live collaboration
- Firebase Authentication and Cloud Firestore
- Google Gemini API for the server-side disease-analysis endpoint when configured

## Getting started

### Requirements

- [Bun](https://bun.sh/) (recommended; the repository includes `bun.lock`)
- A Firebase project configured for Google Authentication and Cloud Firestore to use Firebase-backed features
- A Gemini API key to enable Gemini-powered leaf analysis

### Install and run

```sh
bun install
```

On Windows PowerShell, copy the example environment file:

```powershell
Copy-Item .env.example .env
```

Set `GEMINI_API_KEY` in `.env` to enable Gemini-powered leaf analysis. Without a key, the disease-analysis workflow uses its deterministic demo results instead.

The Firebase web configuration is read from [`firebase-applet-config.json`](firebase-applet-config.json). Point it at a Firebase project where Google sign-in is enabled and the Firestore rules in [`firestore.rules`](firestore.rules) are deployed. Do not put server credentials or other private secrets in client-side configuration.

Start the development server:

```sh
bun run dev
```

Open [http://localhost:3000](http://localhost:3000). The same server runs the Vite development app, the `/api/v1/*` HTTP endpoints, and the `/ws` WebSocket endpoint.

### Production build

```sh
bun run build
bun run start
```

`start` serves the built app and API on port `3000`.

## Project layout

```text
.
├── public/
│   └── assets/aistudio/       # Agriculture engineering blueprint PDF
├── src/
│   ├── components/
│   │   ├── alerts/            # Alerts and farmer feedback
│   │   ├── analytics/         # Telemetry trends and blueprint reference
│   │   ├── disease/           # Leaf-image analysis workflow
│   │   ├── farms/             # Farm and field registry
│   │   ├── sensors/           # Sensor devices and telemetry
│   │   └── tasks/             # Collaborative task workflow
│   ├── types/agriculture.ts   # Shared domain types
│   ├── utils/
│   │   ├── agronomyEngine.ts  # Telemetry validation and decision logic
│   │   ├── i18n.ts            # English, Hindi, and Spanish translations
│   │   └── seedData.ts        # Demo farms, fields, readings, alerts, and tasks
│   ├── App.tsx                # Application state and feature wiring
│   └── firebase.ts            # Firebase initialization and helpers
├── firestore.rules            # Firestore access-control rules
├── firestore.rules.test.ts    # Static Firestore rules regression tests
├── firebase-blueprint.json    # Firestore entities and access blueprint
├── security_spec.md           # Data invariants and security scenarios
└── server.ts                  # Express API, Gemini integration, and WebSockets
```

## API overview

The Express server exposes versioned routes under `/api/v1`, including endpoints for farms and fields, sensors and readings, predictions and alerts, feedback, disease analysis, analytics, and tasks with comments. The WebSocket endpoint at `/ws` broadcasts state and collaboration events. The server currently uses seeded in-memory state for these API resources.

## Checks

```sh
bun run lint
bun run build
```

The repository also contains Node.js test-runner tests in `src/utils/agronomyEngine.test.ts` and `firestore.rules.test.ts`.

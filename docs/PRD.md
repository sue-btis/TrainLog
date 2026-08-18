# PRD — Offline-First Training PWA

## 1. Product Overview

### Product Name
**Working name:** TrainLog PWA

### Product Type
Progressive Web App orientada principalmente a dispositivos móviles para:

- importar rutinas estructuradas;
- visualizar entrenamientos mediante calendario;
- ejecutar sesiones de entrenamiento;
- registrar peso, repeticiones y RIR;
- consultar el rendimiento anterior;
- aplicar reglas de progresión;
- conservar historial;
- funcionar sin conexión a internet.

### Product Philosophy

La aplicación debe separar claramente dos conceptos:

> **Planned Training** → lo que estaba programado.

> **Actual Training** → lo que realmente realizó el usuario.

Esta separación constituye la base del modelo de datos, historial y sistema de progresión.

---

# 2. Purpose

## General Purpose

Crear una aplicación de entrenamiento:

- simple;
- mobile-first;
- offline-first;
- instalable como PWA;
- sin backend obligatorio;
- sin costos recurrentes de infraestructura;
- basada en rutinas importables;
- capaz de almacenar y analizar el historial de entrenamiento.

La aplicación debe permitir que una rutina externa actúe como una **declaración del programa de entrenamiento**, mientras que la PWA se encargue de ejecutarla, registrar resultados y mostrar progreso.

---

# 3. Product Goals

## Primary Goals

### G1. Routine Import

Permitir cargar una rutina desde un archivo estructurado.

Formato inicial:

```text
YAML
```

Posteriormente podría admitirse:

```text
JSON
```

### G2. Offline Training

Permitir realizar un entrenamiento completo sin conexión a internet.

Debe funcionar offline:

- consultar rutina;
- consultar calendario;
- iniciar entrenamiento;
- registrar series;
- modificar pesos;
- registrar repeticiones;
- registrar RIR;
- utilizar temporizador;
- finalizar entrenamiento;
- consultar historial local.

### G3. Training History

Guardar permanentemente los resultados realizados.

Ejemplo:

```text
Front Squat

Planned:
4 × 4-6
RIR 2

Actual:
75 × 6 @2
75 × 6 @2
75 × 5 @1
75 × 5 @1
```

### G4. Progression

Mostrar al usuario:

- entrenamiento anterior;
- peso anterior;
- reps anteriores;
- objetivo actual;
- evolución;
- siguiente carga sugerida.

### G5. Zero Required Infrastructure

El MVP no debe depender de:

- backend;
- VPS;
- API propia;
- PostgreSQL;
- autenticación;
- servicios de pago.

---

# 4. Non-Goals — MVP

La primera versión **no** intentará resolver:

- coaching mediante IA;
- generación automática de rutinas;
- red social;
- publicación de entrenamientos;
- smartwatch;
- Google Fit;
- Apple Health;
- Health Connect;
- múltiples usuarios;
- sincronización cloud;
- gestión de gimnasios;
- nutrición;
- seguimiento de calorías;
- pagos;
- suscripciones.

Estos elementos quedan fuera del alcance inicial.

---

# 5. Target User

## Primary User

Persona que:

- entrena con programación estructurada;
- utiliza peso, repeticiones y RIR;
- modifica sus rutinas periódicamente;
- necesita visualizar el entrenamiento anterior;
- quiere controlar progresión;
- entrena principalmente utilizando el teléfono;
- puede encontrarse en gimnasios con mala conectividad.

## Primary Usage Context

```text
Gym
 ↓
Phone
 ↓
PWA installed
 ↓
No reliable internet required
```

La interfaz debe diseñarse pensando primero en esta situación.

---

# 6. Core User Journey

```text
Create YAML routine
        ↓
Import into PWA
        ↓
Validate
        ↓
Store in IndexedDB
        ↓
Activate routine
        ↓
Generate training calendar
        ↓
Open Today's Workout
        ↓
Start Workout
        ↓
Complete Sets
        ↓
Weight + Reps + RIR
        ↓
Rest Timer
        ↓
Finish Workout
        ↓
Store Session
        ↓
Calculate Progress
        ↓
Use previous performance
in next workout
```

---

# 7. Product Architecture

## High-Level Architecture

```text
                GitHub
                   │
                   │ Deploy
                   ▼
          Static Web Hosting
        Cloudflare Pages
                   │
                   ▼
        ┌────────────────────┐
        │     React PWA      │
        │                    │
        │ React              │
        │ TypeScript         │
        │ Vite               │
        │ Service Worker     │
        │ Dexie              │
        │ IndexedDB          │
        └─────────┬──────────┘
                  │
            Local storage
                  │
     ┌────────────┼─────────────┐
     ▼            ▼             ▼
  Routines     Workouts      History
     │            │             │
     ▼            ▼             ▼
 Calendar    Completed Sets   Progress
```

---

# 8. Technical Architecture

## Frontend

Recommended:

```text
React
TypeScript
Vite
```

## PWA

Recommended:

```text
vite-plugin-pwa
```

Responsabilidades:

- Web App Manifest;
- instalación;
- service worker;
- precache;
- actualización de recursos;
- funcionamiento sin conexión.

## Local Database

```text
IndexedDB
```

Wrapper recomendado:

```text
Dexie.js
```

IndexedDB será considerada la **fuente local principal de datos**.

No utilizar `localStorage` para datos de entrenamiento complejos.

## Routing

Opciones:

```text
TanStack Router
```

o

```text
React Router
```

## Charts

Inicialmente:

```text
Recharts
```

## Hosting

```text
Cloudflare Pages
```

Alternativas compatibles:

```text
GitHub Pages
Vercel
Netlify
```

La aplicación debe mantenerse agnóstica al proveedor.

---

# 9. Offline-First Architecture

El principio será:

> **Una acción del usuario no debe depender de una respuesta del servidor.**

Flujo:

```text
User Action
    ↓
Local database
    ↓
Immediate UI update
```

No:

```text
User
 ↓
Internet
 ↓
Server
 ↓
Database
 ↓
Response
 ↓
UI
```

## Data Availability Offline

Debe estar disponible offline:

- rutina activa;
- rutinas anteriores;
- ejercicios;
- calendario;
- entrenamiento del día;
- historial;
- series anteriores;
- configuración;
- reglas de progresión.

---

# 10. Information Architecture

La aplicación tendrá cinco áreas principales.

```text
Today

Calendar

Progress

Exercises

More
```

## Bottom Navigation

Diseñada para uso con una mano:

```text
┌──────────────────────────────┐
│                              │
│          CONTENT             │
│                              │
├──────────────────────────────┤
│ Today Calendar Progress More │
└──────────────────────────────┘
```

`Exercises` puede integrarse inicialmente dentro de `Progress` o `More` si se desea mantener cuatro elementos principales.

---

# 11. Core Features

# 11.1 Routine Import

El usuario puede seleccionar:

```text
Import Routine
```

y elegir:

```text
.yaml
.yml
```

Proceso:

```text
Select file
    ↓
Parse YAML
    ↓
Schema validation
    ↓
Semantic validation
    ↓
Preview
    ↓
Import
```

## Validation

Debe detectar:

- nombre faltante;
- días inválidos;
- ejercicios sin nombre;
- sets inválidos;
- rangos de reps incorrectos;
- RIR fuera del rango permitido;
- descansos negativos;
- progresiones no reconocidas.

Ejemplo:

```text
Import failed

Monday → Front Squat

min_reps cannot be greater
than max_reps.
```

---

# 11.2 Routine Management

El usuario podrá almacenar múltiples rutinas.

Ejemplo:

```text
ROUTINES

● September Hybrid
  Active

○ August Hybrid
  Archived

○ Strength Block
  Archived
```

Funciones:

- importar;
- activar;
- archivar;
- consultar;
- eliminar;
- duplicar posteriormente.

---

# 11.3 Calendar

Debe presentar:

- entrenamiento programado;
- entrenamiento realizado;
- descanso;
- sesión parcial;
- entrenamiento omitido.

Ejemplo:

```text
September 2026

 M   T   W   T   F   S   S

 ✓   ✓   -   ✓   ✓   -   -
 ✓   ✓   -   ✓   ✓   -   -
 ✓   ●   -   ○   ○   -   -
```

Estados conceptuales:

```text
scheduled
completed
partial
skipped
rest
```

---

# 11.4 Today's Workout

Pantalla principal de uso diario.

Debe mostrar:

```text
Tuesday

Pull — Vertical Strength

9 exercises
~75 min

START WORKOUT
```

Además:

- última sesión;
- principales ejercicios;
- objetivo del entrenamiento.

---

# 11.5 Workout Execution

Durante una sesión:

```text
Weighted Pull-Up

Strength

Target
4 × 4-6

RIR
1-2

Rest
3:00
```

## Previous Session

```text
LAST SESSION

+5 kg

6
6
5
5
```

## Current Session

```text
SET 1

Weight
[ 7.5 ]

Reps
[ 6 ]

RIR
[ 2 ]

COMPLETE SET
```

---

# 11.6 Rest Timer

Al completar una serie:

```text
COMPLETE SET
      ↓
Start timer
```

Ejemplo:

```text
REST

02:43

[ SKIP ]
```

Debe permitir:

- iniciar automáticamente;
- pausar;
- reiniciar;
- omitir;
- sumar tiempo manualmente.

---

# 11.7 Set Logging

Cada set terminado debe almacenar:

```text
weight
reps
rir
timestamp
```

También:

```text
setNumber
exerciseSessionId
```

Posteriormente podrían agregarse:

```text
tempo
assistance
notes
failure
pain
```

pero no forman parte del MVP.

---

# 11.8 Previous Performance

Antes de realizar un ejercicio se mostrará:

```text
PREVIOUS

75 kg

Set 1 → 6 @2
Set 2 → 6 @2
Set 3 → 5 @1
Set 4 → 5 @1
```

Esto constituye una de las funciones principales del producto.

---

# 11.9 Progression Engine

La progresión debe estar separada de la interfaz.

Conceptualmente:

```text
Training History
       +
Progression Rule
       ↓
Progression Engine
       ↓
Suggested Target
```

## Initial Progression Type

Primera estrategia:

```text
double_progression
```

Ejemplo:

```yaml
progression:
  type: double_progression
  increment: 2.5
```

Rutina:

```text
4 × 4-6
```

Si:

```text
75 × 6
75 × 6
75 × 6
75 × 6
```

entonces:

```text
Target achieved

Suggested next load:
77.5 kg
```

---

# 11.10 Exercise History

Cada ejercicio tendrá su propia pantalla.

Ejemplo:

```text
FRONT SQUAT

Current working weight
75 kg

Best set
77.5 × 5

Sessions
12

Last performed
August 18
```

Historial:

```text
Aug 18
75 × 6
75 × 6
75 × 5
75 × 5

Aug 11
72.5 × 6
72.5 × 6
72.5 × 6
72.5 × 5
```

---

# 11.11 Progress Dashboard

MVP:

- carga;
- repeticiones;
- volumen;
- mejores sets.

Posteriormente:

- estimated 1RM;
- weekly volume;
- muscle volume;
- adherence;
- PR timeline.

---

# 12. Routine Template

## Example

```yaml
version: 1

routine:
  name: "Hybrid Strength - September"
  start_date: "2026-09-01"
  weeks: 4

days:

  monday:
    name: "Push - Quad + Shoulder Strength"

    exercises:

      - name: "Front Squat"

        category: "quadriceps"
        goal: "strength"

        sets: 4

        reps:
          min: 4
          max: 6

        rir:
          min: 1
          max: 2

        rest_seconds: 210

        focus: "Quadriceps Strength"

        notes:
          - "Maintain upright torso"
          - "Avoid technical failure"

        progression:
          type: "double_progression"
          increment: 2.5
```

---

# 13. Template Design Principles

El archivo debe ser:

### Human-readable

Debe poder editarse manualmente.

### Declarative

Debe expresar:

> qué hacer

y no:

> cómo debe programarlo internamente la aplicación.

### Versioned

Siempre incluir:

```yaml
version: 1
```

Esto permitirá evolucionar el formato.

---

# 14. Core Data Model

La base debe diferenciar:

```text
Definition
Planning
Execution
```

---

# 14.1 Exercise

Representa el concepto general.

```text
Exercise

id
name
category
equipment
```

Ejemplo:

```text
Front Squat
```

---

# 14.2 Routine

```text
Routine

id
name
startDate
endDate
status
createdAt
```

---

# 14.3 Routine Day

```text
RoutineDay

id
routineId
weekday
name
order
```

---

# 14.4 Planned Exercise

Define lo programado.

```text
PlannedExercise

id
routineDayId
exerciseId

sets

minReps
maxReps

minRir
maxRir

restSeconds

focus
notes

order
```

---

# 14.5 Progression Rule

```text
ProgressionRule

id
plannedExerciseId

type
increment

conditions
```

---

# 14.6 Workout Session

Representa un entrenamiento real.

```text
WorkoutSession

id

routineId
routineDayId

scheduledDate
startedAt
completedAt

status
```

---

# 14.7 Exercise Session

```text
ExerciseSession

id
workoutSessionId
exerciseId
plannedExerciseId

order
status
```

---

# 14.8 Completed Set

Unidad básica del historial.

```text
CompletedSet

id

exerciseSessionId

setNumber

weight
reps
rir

completedAt
```

---

# 15. Data Relationships

```text
Routine
   │
   ├── RoutineDay
   │      │
   │      └── PlannedExercise
   │              │
   │              └── ProgressionRule
   │
   └── WorkoutSession
           │
           └── ExerciseSession
                   │
                   └── CompletedSet
```

---

# 16. Planned vs Actual

Este principio debe conservarse explícitamente.

```text
PLANNED

Front Squat
4 × 4-6
RIR 1-2
Rest 3:30
       │
       │ performed as
       ▼
ACTUAL

75 × 6 @2
75 × 6 @2
75 × 5 @1
75 × 5 @1
```

Nunca modificar lo programado para representar automáticamente lo realizado.

Son entidades diferentes.

---

# 17. Backup Architecture

Debido a que no existe servidor, el backup es una funcionalidad crítica.

## Export

```text
Settings
   ↓
Export Backup
```

Genera:

```text
trainlog-backup-2026-08-18.json
```

Debe contener:

```json
{
  "version": 1,
  "exportedAt": "...",
  "routines": [],
  "exercises": [],
  "plannedExercises": [],
  "workouts": [],
  "exerciseSessions": [],
  "completedSets": [],
  "settings": {}
}
```

---

# 18. Restore

```text
New Phone
   ↓
Install PWA
   ↓
Import Backup
   ↓
Validate
   ↓
Restore IndexedDB
```

El backup debe validarse antes de modificar la base local existente.

---

# 19. CSV Export

Además del backup completo, permitir:

```text
Export Workout History
```

Ejemplo:

```csv
date,exercise,set,weight,reps,rir
2026-08-18,Front Squat,1,75,6,2
2026-08-18,Front Squat,2,75,6,2
2026-08-18,Front Squat,3,75,5,1
2026-08-18,Front Squat,4,75,5,1
```

Esto facilitará análisis externos.

---

# 20. Mobile UX Principles

## One-Hand Operation

Los principales controles deben encontrarse en zonas cómodas del teléfono.

## Large Inputs

Ejemplo:

```text
WEIGHT      REPS       RIR

[ 75.0 ]    [ 6 ]      [ 2 ]
```

## Minimal Typing

Debe preferirse:

```text
+
-
buttons
presets
numeric inputs
```

sobre entrada textual.

## Previous Values as Defaults

Si la sesión anterior fue:

```text
75 kg
```

la siguiente sesión debe precargar:

```text
75 kg
```

o la carga sugerida por progresión.

---

# 21. UX Principle — Gym Mode

Durante el entrenamiento se eliminará información innecesaria.

Ejemplo:

```text
┌────────────────────────────┐
│ FRONT SQUAT                │
│                            │
│ 4 × 4-6 · RIR 2            │
│ Rest 3:30                  │
│                            │
│ Previous                   │
│ 75 × 6 @2                  │
│                            │
│ SET 1                      │
│                            │
│  Weight    Reps     RIR    │
│  [75]      [6]      [2]    │
│                            │
│   COMPLETE SET             │
│                            │
└────────────────────────────┘
```

Nada que no contribuya al entrenamiento actual debe competir visualmente con estos controles.

---

# 22. Functional Requirements

## FR-01

El usuario puede importar una rutina YAML.

## FR-02

El sistema valida el archivo antes de almacenarlo.

## FR-03

La rutina importada se almacena en IndexedDB.

## FR-04

El usuario puede activar una rutina.

## FR-05

La aplicación genera el calendario correspondiente.

## FR-06

El usuario puede iniciar una sesión.

## FR-07

La aplicación muestra los ejercicios programados.

## FR-08

La aplicación muestra la sesión anterior del ejercicio.

## FR-09

El usuario puede registrar peso.

## FR-10

El usuario puede registrar reps.

## FR-11

El usuario puede registrar RIR.

## FR-12

La aplicación puede iniciar el temporizador de descanso.

## FR-13

El usuario puede modificar una serie.

## FR-14

El usuario puede eliminar una serie registrada accidentalmente.

## FR-15

El usuario puede finalizar un entrenamiento.

## FR-16

La aplicación almacena el entrenamiento completado.

## FR-17

El historial permanece disponible offline.

## FR-18

El usuario puede consultar progreso por ejercicio.

## FR-19

El usuario puede exportar toda la información.

## FR-20

El usuario puede restaurar un backup.

---

# 23. Non-Functional Requirements

## NFR-01 — Offline

El entrenamiento completo debe funcionar sin internet.

## NFR-02 — Performance

Las acciones locales deben sentirse instantáneas.

Objetivo:

```text
< 100 ms
```

para operaciones normales sobre IndexedDB cuando sea razonablemente posible.

## NFR-03 — Reliability

Registrar una serie debe persistir inmediatamente.

No esperar a que termine todo el entrenamiento.

## NFR-04 — Mobile First

Diseño inicial alrededor de pantallas aproximadas de:

```text
360-430 px
```

de ancho.

## NFR-05 — Responsive

Desktop será compatible, pero secundario.

## NFR-06 — Installable

Debe poder instalarse como PWA.

## NFR-07 — Data Ownership

Los datos pertenecen al usuario y pueden exportarse.

## NFR-08 — No Mandatory Account

El MVP no requiere:

```text
email
password
login
```

---

# 24. Data Integrity Requirements

Cada entidad principal debe utilizar IDs únicos.

Recomendado:

```text
UUID
```

o:

```text
ULID
```

No depender de:

```text
exerciseName
```

como primary key.

Ejemplo incorrecto:

```text
id = "Front Squat"
```

Correcto:

```text
id = "01J..."
name = "Front Squat"
```

Esto permitirá renombrar ejercicios sin romper históricos.

---

# 25. Routine Import Rules

Importar una nueva rutina **no debe modificar las sesiones históricas**.

Ejemplo:

```text
August Routine
      ↓
completed workouts

September Routine
      ↓
new programming
```

La información histórica de agosto debe permanecer exactamente como fue realizada.

---

# 26. Exercise Identity

Debe existir una diferencia entre:

```text
Exercise Definition

Front Squat
```

y:

```text
Planned Exercise

Front Squat
4 × 4-6
RIR 2
```

Así el historial de `Front Squat` puede consultarse a través de múltiples rutinas.

---

# 27. Progression Architecture

La progresión debe diseñarse mediante estrategias extensibles.

```text
ProgressionStrategy
```

Ejemplos futuros:

```text
double_progression
linear_load
rep_target
rir_based
manual
percentage_based
```

MVP:

```text
manual
double_progression
```

---

# 28. Manual Progression

Debe existir siempre.

```yaml
progression:
  type: manual
```

La app conserva:

- resultados anteriores;
- recomendaciones visuales;

pero no modifica automáticamente la carga.

---

# 29. Double Progression

Ejemplo:

```yaml
sets: 4

reps:
  min: 4
  max: 6

progression:
  type: double_progression
  increment: 2.5
```

Regla inicial:

```text
IF

all completed sets
reach max reps

THEN

previous weight
+
increment
```

Ejemplo:

```text
75 × 6
75 × 6
75 × 6
75 × 6

↓

77.5 kg suggested
```

---

# 30. RIR Considerations

RIR debe almacenarse como resultado real.

Ejemplo:

```text
Planned RIR: 2

Actual:
Set 1 → 2
Set 2 → 2
Set 3 → 1
Set 4 → 0
```

Esto permitirá posteriormente evaluar:

```text
load progression
+
fatigue
+
effort
```

No debe descartarse el RIR histórico.

---

# 31. Initial Screens

## Screen 1 — Today

```text
Today's workout
Current routine
Start workout
```

## Screen 2 — Workout

```text
exercise
planned sets
previous results
current set
timer
```

## Screen 3 — Calendar

```text
month
training status
session detail
```

## Screen 4 — Progress

```text
exercise selector
history
charts
PRs
```

## Screen 5 — Routine Detail

```text
days
exercises
programming
```

## Screen 6 — Import

```text
select YAML
validation
preview
confirm
```

## Screen 7 — Settings

```text
backup
restore
CSV export
units
theme
```

---

# 32. Settings

Initial settings:

```text
Weight unit
kg / lb

Default RIR
optional

Timer vibration
on / off

Timer sound
on / off

Theme
system / light / dark
```

---

# 33. Progressive Web App Requirements

Debe incluir:

```text
manifest.webmanifest
```

con:

```text
name
short_name
icons
start_url
display
theme_color
background_color
```

Además:

```text
service worker
```

para assets esenciales.

---

# 34. Local Storage Strategy

## IndexedDB

Para:

```text
routines
workouts
sets
history
settings
```

## Cache Storage

Para:

```text
HTML
JS
CSS
icons
static resources
```

No deben confundirse ambos mecanismos.

---

# 35. Error Recovery

Si la aplicación se cierra durante un entrenamiento:

```text
Open app
    ↓
Detect active workout
    ↓
Resume Workout
```

Una sesión activa debe persistir después de cada serie.

---

# 36. Workout State

Estados posibles:

```text
scheduled

in_progress

completed

partial

skipped
```

Una sesión `in_progress` debe poder recuperarse después de:

- cerrar la PWA;
- bloquear el teléfono;
- reiniciar navegador.

---

# 37. Data Safety

Antes de operaciones destructivas:

```text
Delete Routine
Delete Workout
Restore Backup
Clear Data
```

se debe realizar confirmación explícita.

El `Restore Backup` debe permitir:

```text
replace existing data
```

y posteriormente podría incluir:

```text
merge
```

No implementar `merge` en MVP.

---

# 38. MVP Scope

## MVP 0.1

### Routine

- YAML import;
- validation;
- routine storage;
- activate routine.

### Calendar

- planned days;
- completed days.

### Workout

- start session;
- exercises;
- weight;
- reps;
- RIR;
- completed sets;
- rest timer;
- previous results;
- finish session.

### History

- sessions;
- exercise history.

### Progression

- manual;
- double progression.

### Data

- IndexedDB;
- backup;
- restore;
- CSV export.

### Platform

- responsive;
- PWA;
- offline.

---

# 39. V1.0

Después del MVP:

- advanced charts;
- estimated 1RM;
- PR detection;
- workout volume;
- muscle volume;
- calendar statistics;
- workout adherence;
- routine editor;
- exercise management;
- deload support;
- supersets;
- warm-up sets;
- drop sets;
- custom progression strategies.

---

# 40. Future Architecture

La arquitectura debe permitir agregar cloud sin reconstruir la aplicación.

```text
Today

React
 ↓
IndexedDB
```

Futuro:

```text
React
 ↓
IndexedDB
 ↓
Sync Engine
 ↓
Cloud Database
```

El funcionamiento local continuará siendo primario.

---

# 41. Future Optional Cloud

Posibles opciones:

```text
Supabase
Firebase
custom API
```

No forman parte del MVP.

---

# 42. Future AI

Un sistema de IA podría posteriormente analizar:

```text
training history
performance
RIR
volume
progression
plateaus
```

Ejemplo:

```text
Front Squat has remained at
80 kg for four sessions.

Average RIR decreased
from 2.1 to 0.8.

Increasing load is currently
not recommended.
```

La IA nunca debe formar parte de la lógica fundamental de almacenamiento o progresión.

---

# 43. Product Principles

## Principle 1

**Offline is normal, not an exception.**

## Principle 2

**Logging a set must be faster than writing it manually.**

## Principle 3

**Previous performance must always be visible when useful.**

## Principle 4

**Planned and actual training are separate entities.**

## Principle 5

**Routine files describe programming; the app executes it.**

## Principle 6

**The user's data must remain portable.**

## Principle 7

**No infrastructure should be required for the core product.**

## Principle 8

**Progression rules must be deterministic and understandable.**

---

# 44. Success Criteria for MVP

El MVP se considera funcional cuando puede realizarse este flujo completamente offline:

```text
1. Install PWA

2. Import:
   september.yaml

3. Activate routine

4. Open Tuesday

5. Start Pull workout

6. See:
   Weighted Pull-Up
   4 × 4-6
   RIR 1-2
   Rest 3:00

7. See previous performance

8. Enter:
   +7.5 kg
   6 reps
   RIR 2

9. Complete set

10. Rest timer starts

11. Finish all exercises

12. Complete workout

13. Close application

14. Reopen without internet

15. Workout history still exists

16. Next Tuesday shows
    previous results

17. Progression engine
    calculates next target

18. Export complete backup
```

Si este flujo funciona correctamente, existe un producto utilizable.

---

# 45. Suggested Project Structure

```text
src/

├── app/
│   ├── router/
│   └── providers/
│
├── features/
│
│   ├── routines/
│   │   ├── components/
│   │   ├── services/
│   │   ├── schemas/
│   │   └── types/
│   │
│   ├── calendar/
│   │
│   ├── workouts/
│   │
│   ├── exercises/
│   │
│   ├── progression/
│   │
│   ├── history/
│   │
│   └── backup/
│
├── db/
│   ├── database.ts
│   ├── schema.ts
│   └── migrations/
│
├── components/
│
├── hooks/
│
├── utils/
│
├── types/
│
└── pwa/
```

La organización debe ser principalmente **feature-based**, no una carpeta global enorme de:

```text
components/
services/
models/
```

sin contexto funcional.

---

# 46. Recommended Development Order

```text
1. Domain models

2. IndexedDB schema

3. YAML specification

4. YAML parser + validator

5. Routine import

6. Routine viewer

7. Calendar generation

8. Workout session creation

9. Set logging

10. Rest timer

11. Workout completion

12. Previous performance

13. Exercise history

14. Progression engine

15. Backup / Restore

16. PWA offline behavior

17. Charts

18. UX polish
```

---

# 47. First Architectural Milestone

Antes de diseñar toda la interfaz debe existir este flujo:

```text
routine.yaml
      ↓
parser
      ↓
validator
      ↓
domain objects
      ↓
IndexedDB
      ↓
query routine
```

El segundo flujo fundamental será:

```text
PlannedExercise
      ↓
Start Workout
      ↓
ExerciseSession
      ↓
CompletedSet
      ↓
IndexedDB
      ↓
Workout History
```

Estos dos flujos forman el núcleo técnico del producto.

---

# 48. Product Summary

**TrainLog PWA** será una aplicación mobile-first y offline-first para ejecutar programas de entrenamiento definidos mediante archivos estructurados.

Su arquitectura central será:

```text
Routine YAML
      ↓
React PWA
      ↓
IndexedDB
      ↓
Workout execution
      ↓
Training history
      ↓
Progression engine
```

El MVP requerirá únicamente:

```text
React
TypeScript
Vite
Dexie
IndexedDB
PWA
Static hosting
```

La aplicación no dependerá de backend, cuentas, bases de datos cloud ni servicios de pago para cumplir su función principal.

La prioridad técnica será conservar una separación estricta entre:

```text
PROGRAMMING
     ↓
Planned Exercise

and

PERFORMANCE
     ↓
Completed Set
```

Esa decisión permitirá posteriormente construir progresión, estadísticas, periodización, sincronización e incluso análisis mediante IA sin modificar el núcleo conceptual de la aplicación.
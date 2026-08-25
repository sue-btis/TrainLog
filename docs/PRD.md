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
Parse + validate
        ↓
Wizard Step 1
review exercises
        ↓
Wizard Step 2
suggested days + weeks
        ↓
Accept
        ↓
Store in IndexedDB
        ↓
Generate Placements
        ↓
Open Today
        ↓
Start Workout
        ↓
Snapshot planned targets
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
Derive progression
from history
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

## Estilos y componentes de UI

```text
Tailwind CSS v4
shadcn/ui (Radix UI)
```

- Tailwind v4 con un **único bloque `@theme`** que declara los tokens de
  [DESIGN.md](../DESIGN.md) (colores, radios, sombras, tipografías, easings). Los tokens son la
  fuente: no se permiten valores arbitrarios de color, radio, sombra o tipografía en el código de
  aplicación.
- shadcn/ui se adopta **por su comportamiento accesible** (trampa de foco, portales, cierre con
  Escape, roles ARIA), no por su apariencia. Cada componente copiado se re-estiliza con los tokens
  del sistema antes de su primer uso, y se elimina el tema oscuro que genera el CLI.
- Componentes propios (dome, tarjetas, campos, chips, navegación) se escriben directamente con
  utilidades; shadcn se reserva para diálogos, sheets, popovers, select, tabs, switch, tooltip,
  accordion y toasts.
- El CLI de shadcn se ejecuta solo en tiempo de desarrollo. No se admite ninguna dependencia que
  realice peticiones de red en runtime (§9): fuentes autoalojadas en woff2, iconos empaquetados con
  `lucide-react`.
- La autoridad sobre la apariencia es [DESIGN.md](../DESIGN.md); este documento solo fija el stack.

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

La navegación tiene **cuatro** pestañas, y sólo cuatro (DESIGN.md §Navigation).
Todo lo demás se alcanza desde una de ellas.

```text
Today

Calendar

Progress

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

## Bajo `More`

Pantallas que se visitan, no acciones que se ejecutan:

```text
Routines          la lista de programas importados (§11.2)
Session history   cada sesión realizada (§38, «History | Sessions»)
Exercises         el catálogo y los ejercicios propios (§11.12)
```

`Routines` ocupó la tercera pestaña mientras `Progress` no existía. Al llegar
`Progress` (§11.11) bajó aquí, que es donde corresponde a una pantalla que se
mira después de importar y no durante un entrenamiento.

`Exercises` (§11.12) llegó después del MVP 0.1, y entró aquí — no como quinta
pestaña. Agrupa por categoría, filtra por equipo y busca por nombre; cada fila
abre el historial de ese ejercicio (§11.10), que ya sabe decir «No history yet»
para un movimiento nunca entrenado. No crea ni edita ejercicios: eso sigue
siendo `exercise management` en §39.

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

La importación es un asistente de dos pasos. La rutina no se almacena hasta que
el usuario acepta.

```text
Select file
    ↓
Parse YAML
    ↓
Schema validation
    ↓
Step 1 - Exercises
    ↓
Step 2 - Days + Weeks
    ↓
Accept
    ↓
Store routine
    ↓
Generate Placements
```

## Step 1 - Exercises

Muestra cada Workout con sus ejercicios y su programación.

El usuario puede:

- editar valores (`sets`, `reps`, `rir`, `rest_seconds`, `notes`, `unit`);
- eliminar ejercicios;
- reordenar ejercicios;
- agregar ejercicios;
- agregar Workouts;
- corregir el nombre de la rutina y el de cada Workout.

El selector de agregar ofrece tres fuentes en una lista: el catálogo incluido, los
Exercises que el usuario ha creado, y todo ejercicio ya escrito en cualquier parte
del borrador. También acepta un nombre nuevo — el Exercise se acuña al aceptar,
dentro de la misma transacción, nunca antes.

**El asistente se puede abrir sin archivo.** «Empezar desde cero» siembra un
borrador en blanco en el mismo asistente: una rutina sin nombre y sin Workouts,
que abre bloqueada declarando exactamente esos dos problemas. Es el mismo
recorrido de edición, validación y `Accept`, y produce la misma transacción.

## Step 2 - Days and Weeks

Muestra los `suggested_days` declarados en el archivo, ya asignados, y el número
de semanas.

El usuario puede editar ambos antes de aceptar.

Al aceptar se generan las `Placements` correspondientes.

## Validation

Existen dos niveles.

### Structural - bloquea la importación

- YAML malformado;
- `version` faltante o desconocida;
- rutina sin nombre;
- workout sin nombre;
- ejercicio sin nombre;
- campos requeridos ausentes.

Ejemplo:

```text
Import failed

The file could not be read.
```

### Semantic - se corrige dentro del asistente

Se carga el archivo y el campo se marca en rojo. `Accept` permanece bloqueado
hasta que se corrija.

Son ocho:

- `min_reps` mayor que `max_reps`;
- RIR fuera del rango permitido;
- descansos negativos;
- sets menores o iguales a cero;
- progresiones no reconocidas;
- dos Workouts que comparten un `suggested_day`;
- una rutina que no declara ningún Workout;
- un nombre de rutina en blanco.

Ejemplo:

```text
Push - Quad → Front Squat

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

Cada importación crea una rutina nueva. Una rutina ya aceptada admite
**agregados** y nada más: mientras esté activa se le puede añadir un Workout, y a
cualquiera de sus Workouts un Planned Exercise. Nada de lo ya guardado se
renombra, reordena, reprograma ni se borra. Corregir sigue ocurriendo dentro del
asistente, sobre el borrador, antes de aceptar.

`Delete Routine` se rechaza cuando existen `Sessions` asociadas. En ese caso solo
se ofrece archivar. Eliminar rutinas con historial contradiría la sección 25.

---

# 11.3 Calendar

El calendario combina dos cosas:

```text
Placements
lo que el usuario planificó

Sessions
lo que realmente ocurrió
```

No existe programación automática por fecha. Las `Placements` se generan en el
asistente y luego pueden moverse o eliminarse libremente.

Ejemplo:

```text
September 2026

 M   T   W   T   F   S   S

 ✓   ✓   -   ✓   ✓   -   -
 ✓   ✓   -   ✓   ✓   -   -
 ✓   ●   -   ○   ✗   -   -
```

Estados visibles:

```text
completed      Session completada
partial        Session parcial
in_progress    Session activa
planned        Placement futura sin Session
missed         Placement pasada sin Session
rest           día sin Placement
```

`missed` es derivado - fecha pasada sin `Session` - y nunca se almacena. No
existe un proceso que marque días automáticamente.

Una `Placement` pasada sin `Session` permanece en su lugar. No se desplaza ni se
arrastra hacia adelante.

---

# 11.4 Today's Workout

Pantalla principal de uso diario.

La sugerencia se resuelve así:

```text
¿Existe Placement para hoy?
        ↓ sí
mostrar ese Workout

        ↓ no
siguiente Workout en rotación
(orden del archivo)
```

El selector de Workout está siempre disponible. Un día sin `Placement` no es un
día bloqueado.

Debe mostrar:

```text
Tuesday

Pull - Vertical Strength

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

Al iniciar cada ejercicio se copian sus objetivos planificados dentro de la
`ExerciseSession`. El historial nunca vuelve a leer la plantilla.

## Deviation

La sesión real puede apartarse libremente de lo planificado:

- más series de las programadas;
- menos series;
- omitir un ejercicio;
- reordenar ejercicios;
- sustituir un ejercicio;
- agregar un ejercicio no planificado.

La sustitución no es un mecanismo propio: es omitir el ejercicio planificado y
agregar uno no planificado.

La desviación se señala con un indicador de color. Nunca bloquea al usuario ni
produce un error.

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

## Correctness

El temporizador no depende de un intervalo en ejecución. Se almacena el instante
de finalización de la serie y el tiempo restante se calcula contra el reloj.

Esto lo mantiene correcto aunque:

- se bloquee el teléfono;
- la PWA pase a segundo plano;
- el navegador suspenda temporizadores.

## Screen Wake Lock

Durante una sesión activa se solicita `Screen Wake Lock`. Donde no este
disponible, se degrada en silencio.

## Notifications

Fuera del MVP. La entrega de notificaciones en PWAs instaladas depende
fuertemente de plataforma y versión, y debe verificarse en dispositivo antes de
diseñar sobre ella.

En primer plano se utiliza vibración y sonido segun configuración.

---

# 11.7 Set Logging

Cada set terminado debe almacenar:

```text
weight
unit
weightKg
reps
rir
timestamp
```

Tambien:

```text
setNumber
exerciseSessionId
```

El peso se guarda tal como fue introducido, junto con su unidad, y además
convertido a kilogramos. Toda comparación, gráfico y progresión utiliza el valor
en kilogramos.

La unidad es propia del ejercicio: una máquina en libras no cambia de unidad
entre series.

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

## Derived, never stored

El motor es una función pura sobre el historial. No existe un
`currentWorkingWeight` almacenado ni estado que actualizar al terminar una
sesión.

## Scope

El historial se consulta por `exerciseId`, no por `plannedExerciseId`.

Cada importación crea `PlannedExercise` nuevos; consultar por plantilla
reiniciaría la progresión cada vez que se corrige un archivo.

Solo las sesiones `completed` alimentan el motor. Las parciales son visibles en
el historial pero se ignoran.

Un ejercicio no planificado no recibe sugerencia.

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

Un ejercicio a la vez, a lo largo del tiempo. El selector ofrece sólo los
ejercicios que se han entrenado; lo que no tiene historial no tiene línea que
dibujar.

MVP:

- carga — la serie superior de cada sesión;
- repeticiones — todas las de la sesión, a cualquier carga;
- volumen — `Σ carga × repeticiones`;
- mejor serie.

Las tres primeras son tres unidades distintas (kg, repeticiones, kg·rep) y
DESIGN.md prohíbe un segundo eje Y, así que son **un gráfico con un conmutador
de métrica**, no tres gráficos apilados. La mejor serie es una cifra sobre el
gráfico, la misma que calcula `summarizeExercise` para §11.10: una función
llamada dos veces, que por eso no pueden discrepar.

Todo se traza en kilogramos, incluso para un ejercicio registrado en libras
(§11.7).

Esta pantalla es la **forma** del registro; §11.10 es el registro — cada sesión
y cada serie, en palabras. No hay lista de sesiones aquí.

Después del MVP entraron dos métricas más, §39 A·1 y A·2:

- **1RM estimado** — Epley sobre repeticiones **y RIR**,
  `weightKg × (1 + (reps + rir) / 30)`. El RIR entra porque §30 lo guarda como
  resultado real y prohibe descartarlo: una serie parada a dos repeticiones del
  fallo demuestra la capacidad de una serie dos repeticiones más larga. Es el
  máximo entre **todas** las series de la sesión, no el de la serie superior por
  carga — 100 kg × 5 estima más que 110 kg × 1, y leerlo de la segunda tiraría
  ese día a la basura. Cuarta métrica del conmutador.
- **Récords** — una sesión es récord cuando su 1RM estimado supera **estrictamente**
  al de todas las anteriores. Un empate no lo es, y la primera sesión nunca se
  marca: no tiene nada que batir. Es un récord de 1RM estimado, no de carga; los
  dos difieren, y el estimado es el que ve la mejora de repetir la misma carga
  con más repeticiones o menos RIR.

Posteriormente, con los nombres que usa §39 — esta lista y aquella son la
misma, y escrita de dos formas se construye dos veces:

- workout volume;
- workout adherence;
- muscle volume.

---

# 11.12 Exercise Catalog

La aplicación incluye un catálogo base de ejercicios.

El catálogo se distribuye **dentro del build**, como recurso estatico. No se
descarga desde la red.

Consecuencias:

- disponible sin conexion desde el primer arranque;
- no requiere infraestructura (ver G5);
- se actualiza publicando una nueva versión de la PWA.

Cada ejercicio del catálogo tiene un identificador estable:

```text
front-squat
weighted-pull-up
romanian-deadlift
```

Ese identificador es el que puede referenciar el archivo YAML mediante
`exercise_id`.

---

# 12. Routine Template

## Structure

Un archivo declara **una** rutina.

```text
routine
  └── workouts (ordered list)
          └── exercises
```

El orden de la lista define la rotación.

No existen claves por día de la semana ni `start_date`. Los días son una
sugerencia declarada por Workout.

## Example

```yaml
version: 1

routine:
  name: "Hybrid Strength - September"
  weeks: 4

  workouts:
    - name: "Push - Quad + Shoulder Strength"
      suggested_days: [monday, friday]

      exercises:

        - name: "Front Squat"
          exercise_id: "front-squat"
          category: "quadriceps"
          goal: "strength"
          unit: "kg"

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

## Field Notes

### `weeks`

Duracion prevista de la rutina. Determina cuántas `Placements` se generan.
Cuando el calendario se agota, el usuario sabe que debe cambiar de programa.

### `suggested_days`

Lista de días sugeridos. Se lee **una sola vez**, durante la importación, para
proponer las `Placements`. Después no vuelve a consultarse.

Un Workout puede sugerir varios días.

Dos Workouts no pueden compartir un día sugerido: el asistente lo señala y
bloquea `Accept` hasta corregirlo.

### `exercise_id`

Opcional. Referencia al catálogo. Si falta, el ejercicio se resuelve por nombre
normalizado.

### `unit`

Opcional. Unidad del ejercicio, `kg` o `lb`. Si falta, se usa la preferencia del
usuario. `increment` se expresa en esta misma unidad.

### Campos ausentes por diseño

```text
start_date          las rutinas no tienen fecha de inicio
monday / tuesday    los días no son estructura
workouts: 4         el conteo se deriva de la lista
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
weeks
status
createdAt
```

No tiene fecha de inicio ni de fin. `weeks` es la duración prevista y determina
cuántas `Placements` se generan al aceptar la importación.

---

# 14.3 Workout

Unidad reutilizable de programación dentro de una rutina. No tiene fecha.

```text
Workout

id
routineId
name
suggestedDays
order
```

`order` define la rotación.

`suggestedDays` solo se utiliza durante la importación.

Sustituye a `RoutineDay`, que asumía identidad por día de la semana.

---

# 14.4 Planned Exercise

Define lo programado.

```text
PlannedExercise

id
workoutId
exerciseId

sets

minReps
maxReps

minRir
maxRir

restSeconds

unit

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

# 14.6 Session

Representa un entrenamiento real.

```text
Session

id

routineId
workoutId

startedAt
completedAt

status
```

No existe `scheduledDate`. La fecha de una sesión es la fecha en que ocurrió.

La intencion de entrenar vive en `Placement` (14.9), que es una entidad
independiente y puede no existir.

---

# 14.7 Exercise Session

```text
ExerciseSession

id
sessionId
exerciseId
plannedExerciseId   (nullable)

plannedSets
plannedMinReps
plannedMaxReps
plannedMinRir
plannedMaxRir
plannedRestSeconds

order
status
```

Los campos `planned*` son una copia tomada al iniciar el ejercicio. El historial
no depende de la plantilla.

`plannedExerciseId` es nulo cuando el ejercicio no estaba programado.

---

# 14.8 Completed Set

Unidad básica del historial.

```text
CompletedSet

id

exerciseSessionId

setNumber

weight
unit
weightKg

reps
rir

completedAt
```

`weight` y `unit` conservan lo introducido. `weightKg` es el valor derivado que
utilizan comparaciones, gráficos y progresión.

---

# 14.9 Placement

Asignación de un Workout a una fecha concreta. Pertenece al usuario.

```text
Placement

id
routineId
workoutId
date
```

Se generan en el asistente de importación y luego pueden moverse o eliminarse
libremente.

No existe recurrencia: cada `Placement` es una fila independiente.

Una `Placement` no crea una `Session`. Una `Session` no requiere una
`Placement`.

Dos `Placements` pueden compartir fecha: después del asistente, el calendario
describe la realidad.

---

# 15. Data Relationships

```text
Routine
   │
   ├── Workout
   │      │
   │      └── PlannedExercise
   │              │
   │              └── ProgressionRule
   │
   ├── Placement          (Workout + date)
   │
   └── Session
           │
           └── ExerciseSession
                   │
                   └── CompletedSet
```

`Placement` y `Session` son independientes entre si. Ninguna referencia a la
otra.

---

# 16. Planned vs Actual

Este principio debe conservarse explícitamente.

```text
PLANNED

Front Squat
4 × 4-6
RIR 1-2
Rest 3:30
       |
       | snapshot al iniciar
       ↓
ACTUAL

75 × 6 @2
75 × 6 @2
75 × 5 @1
75 × 5 @1
```

Nunca modificar lo programado para representar automáticamente lo realizado.

Son entidades diferentes.

El mecanismo que lo garantiza es el snapshot: al iniciar un ejercicio, sus
objetivos se copian dentro de la `ExerciseSession`. Editar una plantilla más
tarde no puede reescribir lo que una sesión pasada afirma haber planificado.

---

# 17. Backup Architecture

Debido a que no existe servidor, el backup es una funcionalidad critica.

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
  "workouts": [],
  "plannedExercises": [],
  "placements": [],
  "exercises": [],
  "sessions": [],
  "exerciseSessions": [],
  "completedSets": [],
  "settings": {}
}
```

`exercises` incluye únicamente los ejercicios creados por el usuario. El
catálogo base no se exporta: viaja dentro del build.

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

## Scope

`Restore` reemplaza:

```text
routines
workouts
plannedExercises
placements
sessions
exerciseSessions
completedSets
user-created exercises
```

No reemplaza:

```text
bundled catalog
settings
```

## Versions

El backup declara `version`.

```text
version < actual    migrar hacia adelante
version = actual    restaurar
version > actual    rechazar
```

Un backup más nuevo se rechaza con un mensaje explicito. Ignorar campos
desconocidos perdería datos de forma permanente.

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

Los errores estructurales rechazan la importación; los errores semánticos se
corrigen dentro del asistente.

## FR-04

El usuario puede editar valores, eliminar y reordenar ejercicios durante la
importación.

## FR-05

El usuario puede editar los días sugeridos y el número de semanas durante la
importación.

## FR-06

La rutina aceptada se almacena en IndexedDB.

## FR-07

La aplicación genera las `Placements` correspondientes al aceptar.

## FR-08

El usuario puede mover o eliminar una `Placement`.

## FR-09

El usuario puede activar una rutina.

## FR-10

El usuario puede iniciar una sesión desde la `Placement` del día o desde
cualquier Workout de la rutina activa.

## FR-11

La aplicación copia los objetivos planificados dentro de la sesión al iniciar
cada ejercicio.

## FR-12

La aplicación muestra la sesión anterior del ejercicio.

## FR-13

El usuario puede registrar peso, reps y RIR.

## FR-14

El usuario puede agregar series adicionales, registrar menos series, omitir un
ejercicio y reordenar ejercicios.

## FR-15

El usuario puede agregar un ejercicio no planificado.

## FR-16

La aplicación puede iniciar el temporizador de descanso y mantenerlo correcto
tras bloquear el teléfono.

## FR-17

El usuario puede modificar una serie.

## FR-18

El usuario puede eliminar una serie registrada accidentalmente.

## FR-19

El usuario puede finalizar un entrenamiento.

## FR-20

La aplicación almacena el entrenamiento completado.

## FR-21

El historial permanece disponible offline.

## FR-22

El usuario puede consultar progreso por ejercicio.

## FR-23

La aplicación deriva la carga sugerida a partir del historial del ejercicio.

## FR-24

El usuario puede exportar toda la información.

## FR-25

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

La información histórica de agosto debe permanecer exactamente como fue
realizada.

Cada importación crea una rutina nueva. Las rutinas no se versionan, y después de
aceptarlas sólo admiten agregados: nada de lo guardado se reescribe ni se borra.

Esto es posible porque el historial no depende de la plantilla: los objetivos se
copian dentro de la sesión al iniciarla (ver 14.7 y 16). Es el snapshot, y no la
inmutabilidad, lo que mantiene el pasado intacto — por eso agregar es seguro.

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

Así el historial de `Front Squat` puede consultarse a traves de múltiples
rutinas.

## Resolution

Al importar, cada ejercicio se resuelve así:

```text
¿Trae exercise_id?
        ↓ sí
buscar en catálogo

        ↓ no
buscar por nombre normalizado
(trim, minúsculas, espacios colapsados)

        ↓ sín coincidencia
crear ejercicio de usuario
```

Consecuencia aceptada: renombrar un ejercicio en el YAML, sin `exercise_id`,
crea un ejercicio nuevo y separa su historial. `exercise_id` es la vía para
evitarlo.

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

## Sesiones que no coinciden con el plan

La sesión real puede tener más o menos series que las programadas.

```text
N = series planificadas

evaluar las primeras N series
ignorar las adicionales
menos de N series → objetivo no alcanzado
```

Se eligió esta regla porque puede explicarse en una frase. Evaluar todas las
series penalizaría una serie extra; evaluar las mejores N inflaría la carga de
forma difícil de predecir.

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
best set
metric switch  load / reps / volume
chart
```

El historial completo del ejercicio se abre desde aquí, en §11.10. El *PR
timeline* está en la lista de «Posteriormente» de §11.11; lo que el MVP muestra
es la mejor serie.

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
timer
screen
```

---

# 32. Settings

Initial settings:

```text
Default weight unit
kg / lb

Default RIR
optional

Timer vibration
on / off

Timer sound
on / off

Keep screen awake during workout
on / off
```

La unidad de configuración es solo el valor por defecto. Cada ejercicio conserva
la suya.

Cada ajuste es un valor por defecto y ninguno actúa hacia atrás: cambiar la
unidad no convierte ninguna serie ya registrada.

**Sin control de tema.** El modo oscuro fue rechazado desde la escena de uso
(DESIGN.md, la No-Dark-Variant Rule): la aplicación declara una sola paleta y no
hay nada que un selector de tema pueda elegir. Esta lista tenía una fila
`Theme system / light / dark`; se eliminó al implementar §32 porque contradecía
el sistema de diseño.

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
Detect active session
    ↓
Resume Session
```

Una sesión activa debe persistir después de cada serie.

El temporizador de descanso se reconstruye desde la marca de tiempo almacenada,
no desde un contador en memoria.

---

# 36. Session State

Estados posibles:

```text
in_progress

completed

partial
```

`scheduled` y `skipped` no existen como estado almacenado.

La intencion de entrenar es una `Placement`. Un día perdido es una `Placement`
pasada sin `Session`, y se deriva al consultar.

Una sesión `in_progress` debe poder recuperarse después de:

- cerrar la PWA;
- bloquear el teléfono;
- reiniciar navegador.

---

# 37. Data Safety

Antes de operaciones destructivas:

```text
Delete Routine
Delete Session
Delete Placement
Restore Backup
Clear Data
```

se debe realizar confirmacion explicita.

`Delete Routine` se rechaza si existen `Sessions` asociadas. La alternativa
ofrecida es archivar.

El `Restore Backup` debe permitir:

```text
replace existing data
```

y posteriormente podria incluir:

```text
merge
```

No implementar `merge` en MVP.

---

# 38. MVP Scope

## MVP 0.1

Estado verificado contra el código el 2026-08-21 (rama `master`).
Leyenda: ✅ hecho · 🟡 parcial · ⬜ pendiente.
Al cerrar un cambio en `docs/changes/`, actualizar esta tabla en el mismo commit.

| Área | Ítem | Estado | Evidencia |
| --- | --- | --- | --- |
| Routine | YAML import | ✅ | `domain/routine-file/`, `features/import/FileStep.tsx` |
| Routine | Structural + semantic validation | ✅ | `routine-file/schema.ts`, `routine-file/validate.ts` |
| Routine | Import wizard (exercises, days, weeks) | ✅ | `features/import/` |
| Routine | Routine storage | ✅ | `db/repositories/routines.ts`, `import.ts` |
| Routine | Activate routine | ✅ | `activateRoutine` → `RoutinesScreen.tsx` |
| Routine | Archive routine | ✅ | `archiveRoutine` → `RoutinesScreen.tsx` |
| Schedule | Placement generation | ✅ | `domain/scheduling/generatePlacements` |
| Schedule | Move placement | ✅ | `movePlacement` → `CalendarScreen.tsx` |
| Schedule | Delete placement | ✅ | `deletePlacement` → `CalendarScreen.tsx` |
| Calendar | Placements | ✅ | `features/calendar/` |
| Calendar | Completed sessions | ✅ | `dayState` |
| Calendar | Derived missed days | ✅ | `isMissed`, nunca almacenado |
| Workout | Start session | ✅ | `domain/session/startSession`, `startWorkout` |
| Workout | Snapshot planned targets | ✅ | `startPlannedExercise` (ADR 0002) |
| Workout | Weight + unit / reps / RIR | ✅ | `SetLogger.tsx`, `domain/units.ts` |
| Workout | Completed sets | ✅ | `logSet`, `db/repositories/completedSets.ts` |
| Workout | Extra / fewer sets | ✅ | `logSet`, `removeSet`, `editSet` |
| Workout | Skip exercise | ✅ | `skipExercise` → `SessionScreen.tsx` |
| Workout | Reorder exercises | ✅ | `moveExerciseSession`, `ExerciseReorder.tsx` |
| Workout | Unplanned exercises | ✅ | `startUnplannedExercise`, `ExercisePicker.tsx` |
| Workout | Rest timer | ✅ | `RestTimer.tsx`, `useWakeLock.ts` + vibración; las notificaciones que faltan son las que §11.6 declara fuera del MVP |
| Workout | Previous results | ✅ | `PreviousPanel.tsx` |
| Workout | Finish session | ✅ | `finishSession`, `deriveSessionStatus` |
| History | Sessions | ✅ | `listAllSessions` → `features/history/SessionHistoryScreen.tsx`, `SessionDetailScreen.tsx`; rutas `/sessions` y `/sessions/:sessionId` |
| History | Exercise history | ✅ | `features/history/ExerciseHistoryScreen.tsx` |
| Progression | Manual | ✅ | `suggestLoad` → `ExerciseView.tsx` |
| Progression | Double progression | ✅ | `domain/progression/index.ts` (§29) |
| Data | Bundled exercise catalog | ✅ | `domain/catalog/data.ts` |
| Data | IndexedDB | ✅ | `db/schema.ts`, `db/repositories/` |
| Data | Backup | ✅ | `domain/backup/document.ts`, `exportBackup` → `features/more/MoreScreen.tsx` |
| Data | Restore | ✅ | `parseBackup` valida, `restoreBackup` reemplaza en una transacción; confirmación en `MoreScreen.tsx` |
| Data | CSV export | ✅ | `domain/backup/csv.ts`, `listSetsForCsv`; columnas §19 + `unit` |
| Data | Settings | ✅ | `db/repositories/settings.ts`, sección **settings** en `features/more/MoreScreen.tsx` (§32, sin tema) |
| Platform | Responsive | ✅ | `features/shell/` (mobile-first) |
| Platform | PWA | ✅ | `pwa/config.ts` (manifest §33 + iconos) montado en `vite.config.ts` |
| Platform | Offline | ✅ | service worker de `vite-plugin-pwa`: precache del shell y de las fuentes, fallback de rutas profundas (§9) |
| Progress | Serie por ejercicio | ✅ | `exerciseSeries` en `domain/history.ts` (carga, repeticiones, volumen), bajo el gate de mutación |
| Progress | Dashboard | ✅ | `features/progress/`, ruta `/progress`; selector sobre `listPerformedExercises` |
| Progress | Gráfico | ✅ | `ExerciseChart.tsx` con Recharts, piel de DESIGN.md §Charts |
| Progress | Mejor serie | ✅ | `summarizeExercise().bestSet`, la misma que §11.10 |

`Progress` entró en la navegación y `Routines` bajó a `More` (§10): la barra
tiene cuatro pestañas y no admite una quinta.

Nada queda pendiente de MVP 0.1. Exercise Catalog como pantalla (§11.12) era el
único ítem que la tabla marcaba fuera de alcance; se construyó después, como
primer ítem de V1.0 — `features/exercises/ExerciseCatalogScreen.tsx`, ruta
`/exercises`, `groupExercises` en `domain/catalog/index.ts`.

---

# 39. V1.0

Después del MVP. Mismo convenio que §38: ✅ hecho · 🟡 parcial · ⬜ pendiente.
Al cerrar un cambio en `docs/changes/`, actualizar esta tabla en el mismo commit.

Cuatro grupos, en orden de ejecución. El corte que importa está entre B y C:
los ocho primeros no tocan la base de datos, y del 9 en adelante todos la tocan
— schema, migración y `BACKUP_VERSION`.

## A — Métricas derivadas

Funciones puras sobre el historial, más la pantalla de §11.11. Sin datos nuevos,
sin schema, sin migración. Cada una es un cambio pequeño e independiente.

| # | Ítem | Estado | Nota |
| --- | --- | --- | --- |
| 1 | estimated 1RM | ✅ | `estimateOneRepMaxKg` en `domain/history.ts` — Epley sobre reps + RIR (§30); `ExercisePoint.estimatedOneRepMaxKg` es el máximo de la sesión; cuarta métrica del gráfico. |
| 2 | PR detection | ✅ | `ExercisePoint.isRecord` — máximo acumulado sobre la serie ordenada, estrictamente mayor, nunca la primera sesión. |
| 3 | workout volume | ⬜ | El volumen por sesión ya existe en el MVP; falta agregarlo por semana. |
| 4 | workout adherence | ⬜ | Un `Placement` pasado sin `Session` ya se deriva (ADR 0001). |
| 5 | calendar statistics | ⬜ | Mismo insumo que adherence, otra pantalla. |
| 6 | advanced charts | ⬜ | Última del grupo: es el contenedor de 1–5, no un requisito propio. Sigue rigiendo §11.11 — un gráfico con conmutador de métrica, nunca un segundo eje Y. |
| 15 | session effort | ✅ | `SessionSummary.effort` — RPE medio (`10 − RIR`) × minutos, la carga de sesión de Foster. Es del grupo A por naturaleza (función pura, sin schema); numerado al final para no renumerar 7–14. Existe porque el volumen en kg·reps no ve una carrera ni un hold, y un programa híbrido necesita una cifra que sí. |

## B — Identidad del ejercicio

| # | Ítem | Estado | Nota |
| --- | --- | --- | --- |
| 7 | exercise management | 🟡 | **Crear** está hecho: la pantalla de §11.12 acuña Exercises, y el asistente los ofrece junto al catálogo. Faltan **renombrar** y **borrar**, que son los que arrastran §26 de verdad — un emparejamiento por nombre mal resuelto parte un historial en dos. Ver `docs/changes/2026-08-24-routine-authoring/`. |
| 8 | muscle volume | ⬜ | **Depende del 7.** Agrupa por `category`, y hoy un archivo de rutina escribe ahí lo que quiera — el schema no lo valida. Medir sobre vocabulario sucio da cifras falsas. |

## C — Modelo de ejecución

Aquí empieza el coste real: cada uno cambia qué es una serie, o qué es un
ejercicio dentro de una sesión.

| # | Ítem | Estado | Nota |
| --- | --- | --- | --- |
| 9 | warm-up sets | ⬜ | Una serie que no cuenta para progresión: un campo en `CompletedSet` y una regla en §29. El más barato del grupo. |
| 10 | supersets | ⬜ | `ExerciseSession` tiene `order`, no agrupación. Es estructura nueva. |
| 11 | drop sets | ⬜ | Series encadenadas dentro de una serie. Mismo tipo de cambio que 10. |
| 12 | deload support | ⬜ | Toca progresión y planificación a la vez. |

## D — Invariantes que hay que revocar

No se empiezan sin una decisión de producto escrita antes.

| # | Ítem | Estado | Decisión previa |
| --- | --- | --- | --- |
| 13 | custom progression strategies | ⬜ | §27–29 sólo definen `manual` y `double_progression`. Abrirlo es definir un contrato de estrategias. |
| 14 | routine editor | 🟡 | **Agregar** está hecho: una rutina activa admite un Workout nuevo, y cualquiera de sus Workouts un Planned Exercise. Faltan los verbos destructivos — renombrar, reordenar, borrar, reprogramar objetivos. **Corrección:** la inmutabilidad *no* sostiene el snapshot de ADR 0002; es al revés. El propio ADR lo dice en sus Consequences («Templates become safely editable»), y el código lo confirma: ningún camino de lectura reconstruye una sesión pasada uniendo contra `plannedExercises`. Por eso agregar no necesitó versionado. Ver `docs/changes/2026-08-24-routine-authoring/`. |

Exercise Catalog como pantalla (§11.12) salió de esta lista al construirse; fue
el primer ítem de V1.0. Ver `docs/changes/2026-08-21-exercise-catalog/`.

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

El MVP se considera funcional cuando puede realizarse este flujo completamente
offline:

```text
1. Install PWA

2. Import:
   september.yaml

3. Review exercises
   in the wizard

4. Confirm suggested days
   and weeks

5. Accept

6. Placements appear
   in the calendar

7. Open Today

8. Start Pull workout

9. See:
   Weighted Pull-Up
   4 × 4-6
   RIR 1-2
   Rest 3:00

10. See previous performance

11. Enter:
    +7.5 kg
    6 reps
    RIR 2

12. Complete set

13. Rest timer starts

14. Lock the phone
    for two minutes

15. Reopen - the timer
    is still correct

16. Finish all exercises

17. Complete workout

18. Close application

19. Reopen without internet

20. Workout history still exists

21. Move next week's Pull
    placement to another day

22. That session shows
    previous results

23. Progression engine
    calculates next target

24. Export complete backup
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

3. Bundled exercise catalog

4. YAML specification

5. YAML parser + validator

6. Import wizard - step 1

7. Import wizard - step 2

8. Placement generation

9. Routine viewer

10. Calendar

11. Today resolution
    (placement, else rotation)

12. Session creation
    + target snapshot

13. Set logging
    (weight + unit)

14. Rest timer
    (timestamp-based)

15. Session completion

16. Deviation
    (extra sets, skip, unplanned)

17. Previous performance

18. Exercise history

19. Progression engine

20. Backup / Restore

21. PWA offline behavior

22. Charts

23. UX polish
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
Placements
      ↓
query routine
```

El segundo flujo fundamental será:

```text
PlannedExercise
      ↓
Start Workout
      ↓
snapshot targets
      ↓
ExerciseSession
      ↓
CompletedSet
      ↓
IndexedDB
      ↓
Session History
      ↓
Progression (derived)
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
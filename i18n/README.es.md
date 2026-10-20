<div align="center">

<img src="../images/banner.png" alt="Bansur Router" width="880"/>

**Un único endpoint para todos los proveedores de IA.**

[![npm](https://img.shields.io/npm/v/bansur-router.svg)](https://www.npmjs.com/package/bansur-router)
[![Downloads](https://img.shields.io/npm/dm/bansur-router.svg)](https://www.npmjs.com/package/bansur-router)
[![Docker Pulls](https://img.shields.io/docker/pulls/bansur/router.svg?logo=docker&label=Docker%20pulls)](https://hub.docker.com/r/bansur/router)
[![Docker Version](https://img.shields.io/docker/v/bansur/router?logo=docker&label=Docker%20version)](https://hub.docker.com/r/bansur/router)
[![GHCR](https://img.shields.io/badge/GHCR-mas-ajam%2Fbansur-router-blue?logo=github)](https://github.com/mas-ajam/bansur-router/pkgs/container/bansur-router)
[![License](https://img.shields.io/npm/l/bansur-router.svg)](https://github.com/mas-ajam/bansur-router/blob/main/LICENSE)

[Inicio rápido](#inicio-rápido) · [Características principales](#características-principales) · [Proveedores](#proveedores-compatibles) · [Guía de configuración](#guía-de-configuración) · [Documentación](https://bansur-router.pages.dev)

[🇧🇷 Português (Brasil)](./README.pt-BR.md) • [🇻🇳 Tiếng Việt](./README.vi.md) • [🇨🇳 中文](./README.zh-CN.md) • [🇯🇵 日本語](./README.ja-JP.md) • [🇷🇺 Русский](./README.ru.md) • [🇹🇭 ไทย](./README.th.md) • [🇮🇷 فارسی](./README.fa_IR.md) • [🇮🇩 Indonesia](./README.id-ID.md) • [🇪🇸 Español](./README.es.md) • [🇫🇷 Français](./README.fr.md)

</div>

---

# Bansur Router

Bansur Router es una puerta de enlace de IA local para herramientas de programación. Se ejecuta en tu propia máquina y presenta un único endpoint compatible con OpenAI — `http://localhost:667/v1` — frente a todos los proveedores que conectes a él.

Configura tu herramienta una sola vez. A partir de ahí, Bansur Router gestiona las conexiones con los proveedores detrás de ese endpoint: qué cuenta responde a una solicitud, cómo se traduce el formato de la solicitud, cuánta cuota queda y qué ocurre cuando un proveedor dice que no. Las suscripciones que ya pagas se usan primero, las API más baratas toman el relevo cuando se agotan, y los niveles gratuitos mantienen la sesión activa al final de la cadena.

El panel se ejecuta en `http://localhost:667/dashboard`, donde conectas proveedores, creas combinaciones de modelos y consultas el uso. Las claves permanecen en tu máquina, el tráfico se enruta localmente, y la puerta de enlace se distribuye como un paquete npm y una imagen Docker construidos sobre una aplicación Next.js que se ejecuta en Node.js.

- **Un endpoint, una clave** — todos los proveedores conectados, accesibles desde cualquier herramienta
- **Más de 800 modelos** — listados en vivo mediante `GET /v1/models`
- **Respaldo en 3 niveles** — Suscripción, luego Económico, luego Gratuito
- **Ahorro de tokens integrado** — las salidas de las herramientas se comprimen antes de llegar al modelo
- **Local ante todo** — tus claves y tu tráfico permanecen en tu máquina

Versión actual: v1.0.5. Requiere Node.js 20.9 o posterior.

---

## ¿Por qué Bansur Router?

| Problema | Qué hace Bansur Router |
| --- | --- |
| La cuota de la suscripción caduca sin usarse cada mes | Registra la cuota por cuenta y la gasta antes de que se reinicie |
| Un límite de velocidad te detiene en mitad de una sesión de programación | Retrocede automáticamente: Suscripción → Económico → Gratuito |
| Las salidas de herramientas como `git diff`, `grep` y `ls` consumen tokens | Comprime los resultados de las herramientas con RTK, ahorrando entre un 20–40% de tokens por solicitud |
| Cada proveedor quiere $20–50 al mes | Dirige el trabajo a los niveles económicos y gratuitos cuando son suficientes |
| Cambiar de proveedor a mano, por separado para cada herramienta | Ofrece a cada herramienta un único endpoint y una única clave, con rotación round-robin entre varias cuentas detrás |

---

## Inicio rápido

### 1. Instalar y ejecutar

```bash
npm install -g bansur-router
bansur-router
```

El panel se abre en `http://localhost:667`.

### 2. Conecta un proveedor

Abre **Panel → Proveedores → Conectar**.

No necesitas una cuenta de pago para empezar. Conecta **Kiro AI** para un nivel gratuito de unos 50 créditos al mes, que incluye Claude 4.5, GLM-5 y MiniMax, o conecta **OpenCode Free**, que no requiere ninguna autenticación. Si ya tienes suscripciones o claves API, conecta esas en su lugar — o además.

### 3. Apunta tu herramienta a Bansur Router

```text
Endpoint: http://localhost:667/v1
API Key:  copy it from the dashboard
Model:    kr/claude-sonnet-4.5
```

Eso es toda la configuración. La herramienta ahora llega a todos los proveedores conectados a través del único endpoint, y Bansur Router decide adónde va cada solicitud.

Otras formas de ejecutar Bansur Router — Docker y la compilación desde el código fuente — se tratan en la [Guía de configuración](#guía-de-configuración).

---

## Cómo funciona

Cada solicitud llega en el formato que envía tu herramienta, pasa por la puerta de enlace y sale en el formato que espera el proveedor seleccionado.

```text
Your CLI tool
  Claude Code, Codex, Cursor, Cline, ...
        |
        |  http://localhost:667/v1
        v
Bansur Router
  - RTK token saver (compress tool results)
  - Format translation (OpenAI <-> Claude <-> Gemini)
  - Quota tracking per account
  - Automatic OAuth token refresh
        |
        +--> Tier 1: SUBSCRIPTION
        |    Claude Code, Codex, GitHub Copilot
        |    (used first, while quota lasts)
        |
        +--> Tier 2: CHEAP
        |    GLM ($0.6 / 1M tokens), MiniMax ($0.20 / 1M tokens)
        |    (takes over when subscription quota runs out)
        |
        +--> Tier 3: FREE
             Kiro, OpenCode Free, Vertex AI ($300 credits
             for new Google Cloud accounts)
             (keeps the session running at no cost)
```

El respaldo es automático. Cuando el nivel activo devuelve un error de cuota o un límite de velocidad, la solicitud desciende por la cadena en lugar de fallar en tu editor.

---

## Características principales

| Característica | Qué hace |
| --- | --- |
| Ahorro de tokens RTK | Comprime las salidas de las herramientas — `git diff`, `grep`, `ls` y resultados similares — antes de enviarlas al modelo, ahorrando entre un 20–40% de tokens por solicitud |
| Ahorro de tokens Headroom | Aplica una compresión adicional al contexto de las solicitudes, reduciendo aún más los tokens que consume una sesión larga |
| Respaldo inteligente en 3 niveles | Enruta cada solicitud Suscripción → Económico → Gratuito, cambiando de nivel automáticamente al agotarse la cuota o ante límites de velocidad |
| Seguimiento de cuota en tiempo real | Muestra el uso en vivo y el momento de reinicio por cuenta, para que la cuota de la suscripción se gaste antes de que caduque en lugar de después |
| Traducción de formatos | Traduce entre los formatos de solicitud de OpenAI, Claude y Gemini, de modo que una herramienta creada para una API puede usar proveedores creados para otra |
| Compatibilidad con varias cuentas | Mantiene varias cuentas por proveedor y distribuye las solicitudes entre ellas con enrutamiento round-robin |
| Actualización automática de tokens | Actualiza los tokens OAuth automáticamente, para que los proveedores conectados permanezcan conectados sin inicios de sesión repetidos |
| Combos personalizados | Agrupa modelos de distintos proveedores y niveles en combinaciones con nombre que seleccionas como un único modelo en tu herramienta |
| Registro de solicitudes | Registra las solicitudes y respuestas para su inspección, lo que hace visibles los problemas de enrutamiento y de proveedores en lugar de silenciosos |
| Sincronización en la nube | Sincroniza tu configuración entre máquinas, para que un segundo equipo parta de los mismos proveedores y combos |
| Análisis de uso | Desglosa el uso de tokens a lo largo del tiempo por proveedor, cuenta y modelo |
| Despliega en cualquier lugar | Se ejecuta en local, en Docker o en un VPS, con el mismo panel y endpoint en cada caso |

---

## Herramientas CLI compatibles

Cualquier herramienta que acepte un endpoint personalizado compatible con OpenAI puede usar Bansur Router. Las herramientas siguientes se admiten directamente, y la mayoría pueden configurarse desde la sección CLI Tools del panel en lugar de editar archivos de configuración a mano.

- Claude Code
- OpenAI Codex
- Cursor
- Cline
- OpenCode
- Antigravity
- GitHub Copilot
- OpenClaw
- Continue
- RooCode

Para cada herramienta, la configuración son los mismos tres valores: el endpoint `http://localhost:667/v1`, la clave API copiada del panel y el modelo o combo que quieras que use esa herramienta.

---

## Proveedores compatibles

Los proveedores conectados exponen más de 800 modelos a través de un único endpoint. Llama a `GET /v1/models` contra una instancia en ejecución para ver la lista exacta disponible para tus conexiones.

### Proveedores OAuth

Conéctalos iniciando sesión desde el panel. Bansur Router almacena la sesión, actualiza sus tokens automáticamente y registra su cuota.

- Claude Code
- Codex
- GitHub Copilot
- Antigravity
- Gemini
- iFlow
- Windsurf
- Kiro

### Proveedores gratuitos

Estos niveles no requieren ningún pago, lo que los convierte en la forma más rápida de lograr una primera solicitud que funcione.

| Proveedor | Qué te ofrece el nivel gratuito |
| --- | --- |
| Kiro AI | Unos 50 créditos al mes gratis, incluyendo Claude 4.5, GLM-5 y MiniMax |
| OpenCode Free | Acceso sin autenticación |
| Vertex AI | $300 en créditos para cuentas nuevas de Google Cloud |

### Proveedores con clave API

Más de 40 proveedores se conectan con una clave API, incluidos servicios de estilo OpenAI y Anthropic y una amplia gama de alojamientos de modelos. Las opciones de bajo coste más usadas como segundo nivel son:

| Proveedor | Precio |
| --- | --- |
| GLM | $0.6 per 1M tokens |
| MiniMax | $0.20 per 1M tokens |
| Kimi | $9 per month flat |

### Proveedores autoalojados

Cualquier endpoint que hable el formato compatible con OpenAI puede conectarse como proveedor, de modo que los modelos que sirves tú mismo quedan en la misma cadena de enrutamiento — y en los mismos combos — que los proveedores alojados.

---

## Referencia de API

Bansur Router expone una API compatible con OpenAI en su endpoint local. Autentícate con la clave API que se muestra en el panel.

### Listar modelos

```text
GET /v1/models
```

Devuelve todos los modelos disponibles en tus proveedores conectados — más de 800 modelos una vez conectados los proveedores habituales.

### Crear una finalización de chat

```text
POST /v1/chat/completions
Authorization: Bearer <dashboard API key>
```

```bash
curl http://localhost:667/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "kr/claude-sonnet-4.5",
    "messages": [
      { "role": "user", "content": "Explain what this function does." }
    ]
  }'
```

Las formas de la solicitud y la respuesta siguen el formato de finalizaciones de chat de OpenAI. Bansur Router las traduce al formato nativo del proveedor que seleccione la cadena de enrutamiento.

URL clave en una instalación predeterminada:

- Panel: `http://localhost:667/dashboard`
- Base de la API: `http://localhost:667/v1`

---

## Guía de configuración

### Ejecutar con Docker

Desde una copia de este repositorio:

```bash
docker compose up -d
```

Las imágenes publicadas están disponibles como `bansur/router` en Docker Hub y como `ghcr.io/mas-ajam/bansur-router` en el GitHub Container Registry. El panel y la API se sirven en el puerto 667, igual que en una instalación local.

### Ejecutar desde el código fuente

```bash
cp .env.example .env
npm install
npm run build
PORT=667 HOSTNAME=0.0.0.0 NEXT_PUBLIC_BASE_URL=http://localhost:667 npm run start
```

### Conecta un proveedor

1. Inicia Bansur Router y abre `http://localhost:667/dashboard`.
2. Ve a **Proveedores** y elige **Conectar** en el proveedor que quieras.
3. Para proveedores OAuth, completa el inicio de sesión en la ventana que se abre. Para proveedores con clave API, pega la clave emitida por ese proveedor.
4. Envía una solicitud. La cuota y el uso del proveedor aparecen en el panel a medida que se enrutan las solicitudes.

Empieza con un proveedor gratuito si solo quieres verificar la configuración: Kiro AI y OpenCode Free funcionan sin un plan de pago.

### Crear un combo

Un combo es una lista ordenada de modelos tratada como un único modelo seleccionable. Pon primero tu modelo de suscripción, segundo un modelo económico y último un modelo gratuito, y luego selecciona el combo en tu herramienta. Cuando el primer modelo no está disponible — cuota agotada, límite de velocidad alcanzado o en error — la solicitud pasa automáticamente a la siguiente entrada.

### Cambiar el puerto

El puerto 667 es el predeterminado, no un requisito.

```bash
bansur-router --port 8080
```

La forma corta `-p` también funciona, y la variable de entorno `PORT` define el puerto para despliegues desde el código fuente, Docker y servidor. Si cambias el puerto, actualiza el endpoint en tus herramientas para que coincida, por ejemplo `http://localhost:8080/v1`. Separar el puerto es también la forma más sencilla de ejecutar Bansur Router junto a otro servicio local que ya ocupe el 667.

---

## Preguntas frecuentes

### ¿Qué es Bansur Router?

Una puerta de enlace de IA local para herramientas de programación. Coloca un único endpoint compatible con OpenAI frente a todos tus proveedores de IA y enruta cada solicitud al mejor disponible, de modo que tus herramientas mantienen una única configuración mientras los proveedores, las cuentas y las cuotas cambian detrás.

### ¿Es gratuito?

Sí. Bansur Router en sí es gratuito y de código abierto bajo la licencia MIT. Lo que cuesta una solicitud depende del proveedor al que se enrute: los niveles gratuitos como Kiro AI y OpenCode Free no cuestan nada, y para el resto aportas tus propias suscripciones y claves API y pagas a esos proveedores directamente, exactamente como lo harías sin la puerta de enlace.

### ¿Dónde viven mis datos?

En tu máquina. Bansur Router es local ante todo: las claves de los proveedores se almacenan localmente, las solicitudes se enrutan desde tu propia instalación, y el trabajo de la puerta de enlace es reenviarlas al proveedor que seleccionaste. No hay ninguna cuenta aparte que crear antes de la primera solicitud.

### ¿Qué puerto usa?

El 667 de forma predeterminada, tanto para el panel como para la API. Cámbialo con `--port` (o `-p`) al iniciar la CLI, o con la variable de entorno `PORT`.

### ¿Con qué herramientas funciona?

Claude Code, OpenAI Codex, Cursor, Cline, OpenCode, Antigravity, GitHub Copilot, OpenClaw, Continue y RooCode se admiten directamente. Cualquier otra herramienta que te permita definir un endpoint personalizado compatible con OpenAI y una clave API puede usarlo con los mismos tres valores.

### Una nota para usuarios de Windows

Detén la instancia de Bansur Router en ejecución antes de actualizar el paquete npm global. Windows bloquea los archivos de una instalación en ejecución, por lo que una actualización intentada mientras la puerta de enlace sigue funcionando fallará hasta que el proceso se detenga.

---

## Solución de problemas

### El puerto ya está en uso

Algo en tu máquina ya está escuchando en el 667, a menudo un proceso anterior de Bansur Router que sigue en ejecución. Detén ese proceso, o inicia en un puerto diferente y apunta tus herramientas a él:

```bash
bansur-router --port 8080
```

### Un proveedor no se conecta

Vuelve a conectarlo desde el panel: **Proveedores → Conectar** para ese proveedor, y completa de nuevo el inicio de sesión o la introducción de la clave. Una conexión nueva sustituye la sesión almacenada, y la actualización automática de tokens la mantiene válida a partir de ahí.

### La actualización falla en Windows

Detén primero la instancia en ejecución y luego ejecuta la actualización de nuevo. Una instalación en ejecución bloquea sus propios archivos de programa en Windows, lo que impide que el paquete npm global se reemplace.

### Las solicitudes fallan después de cambiar el puerto

Tu herramienta sigue apuntando a la dirección antigua. Actualiza su endpoint al nuevo puerto — por ejemplo `http://localhost:8080/v1` — y confirma que la clave API es la que se muestra en el panel de la instancia que ahora se está ejecutando.

---

## Soporte

Informa de errores y solicita funciones a través de [GitHub Issues](https://github.com/mas-ajam/bansur-router/issues) en el repositorio `mas-ajam/bansur-router`. Incluye la versión que estás ejecutando, cómo se inició Bansur Router (npm, Docker o código fuente) y el registro de la solicitud relevante cuando se trate de un problema de enrutamiento.

La documentación completa está en [bansur-router.pages.dev](https://bansur-router.pages.dev).

---

## Licencia

Bansur Router se publica bajo la [Licencia MIT](../LICENSE).

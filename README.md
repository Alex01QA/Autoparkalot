# Autoparkalot

## Ejecución automática desde GitHub

El workflow `.github/workflows/reservar.yml` está programado **todos los días a las 11:50 a. m. de Costa Rica** (`50 17 * * *` en UTC). Se ejecuta con Chromium sin interfaz y cierra el navegador al terminar. Conserva el orden 132 → 129 → otros disponibles de Parqueo Norte.

Para activarlo:

1. Sube este proyecto a un repositorio de GitHub, incluyendo `package-lock.json` y `.github/workflows/reservar.yml`, en la rama predeterminada.
2. En **Settings → Secrets and variables → Actions → New repository secret**, agrega `PARKALOT_EMAIL` y `PARKALOT_PASSWORD` con tus credenciales. No subas `.env` ni `.browser-profile/`.
3. Comprueba que GitHub Actions esté habilitado. Puedes ver las ejecuciones en **Actions → Reservar Parkalot**. **Run workflow** inicia una ejecución real y puede reservar un espacio.

GitHub puede retrasar o descartar ejecuciones programadas; las 11:50 son la hora del disparador, no una garantía de inicio. El margen permite instalar dependencias, iniciar sesión y preparar el espacio antes de mediodía. El script espera hasta las 12:00 y comprueba cada 20 ms la habilitación de Reserve para pulsarlo en cuanto la detecta, sin una pausa adicional intencional. La activación depende de Parkalot y el clic está sujeto al tiempo del navegador. Documentación: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule

Esta configuración necesita iniciar sesión de nuevo en cada ejecución. Si Parkalot pide una verificación adicional o bloquea el acceso desde el runner, el job fallará. No persiste la sesión ni sube capturas privadas como artefactos. En repositorios públicos, GitHub desactiva los workflows programados tras 60 días sin actividad.

Abre Google Chrome en `https://app.parkalot.io/#/client`, espera a que inicies sesión, busca la fecha de mañana y pulsa **Details**. Luego abre el dropdown de parqueo y selecciona **Parqueo Norte**. Si hoy es viernes, busca el lunes siguiente. Los sábados y domingos mantiene la regla de buscar mañana. La ventana queda abierta para revisar el resultado. Al mediodía pulsa Reserve del espacio 132 cuando se habilita.

## Uso

Después de seleccionar Parqueo Norte, busca y abre **Parqueo Norte 132**. Al mediodía intenta **132 → 129 → otros espacios de Parqueo Norte**. Usa el buscador de la lista lateral para abrir los espacios; si no hay buscador, conserva el marcador original como alternativa para 132. Solo intenta los otros espacios cuando su botón Reserve está habilitado.

Requiere Node.js 22 o posterior y Google Chrome instalado.

```sh
npm install
npm start
```

Para iniciar sesión automáticamente, copia `.env.example` a `.env` y completa las credenciales en tu equipo:

```sh
cp .env.example .env
```

```dotenv
PARKALOT_EMAIL="tu-correo@ejemplo.com"
PARKALOT_PASSWORD="tu-contraseña"
```

Después ejecuta `npm start`. Las credenciales se envían una sola vez por ejecución si aparece el formulario de acceso. Si ya hay una sesión activa, continúa directamente. Sin credenciales, puedes iniciar sesión manualmente. Si aparece una verificación adicional o se rechaza el acceso, revisa la ventana; no reintenta automáticamente.

`.env` está excluido de Git y contiene la contraseña en texto plano; mantenlo privado. La sesión se conserva en `.browser-profile/`, un perfil separado de tu Chrome habitual. Cierra la ventana al terminar; no ejecutes dos instancias simultáneas.

Si prefieres Chromium:

```sh
npx playwright install chromium
PARKALOT_BROWSER=chromium npm start
```

Por defecto calcula la fecha objetivo en `America/Costa_Rica` (mañana, o el lunes siguiente si hoy es viernes) y espera hasta cinco minutos. Puedes cambiarlo:

```sh
PARKALOT_TIMEZONE=America/Costa_Rica PARKALOT_TIMEOUT_MS=600000 npm start
```

El reconocimiento admite fechas en inglés y español. Solo pulsa cuando encuentra un único Details asociado a la fecha objetivo. Si la pantalla usa otra estructura o la fecha no está visible, puede necesitar un ajuste; no navega automáticamente por calendarios ni páginas. Ante un error guarda `artifacts/error.png` si la ventana sigue disponible. Esa captura y el perfil pueden contener datos privados: no los compartas ni los subas a Git.

## Verificación

```sh
npm test
```

Las pruebas de clic abren Chrome sin interfaz con páginas locales; comprueban fechas como `9th November` y que se elija el Details correcto. La interacción con la cuenta requiere una comprobación manual con una sesión real de Parkalot.

## Reserva al mediodía

Ejecuta `npm start` antes de las 12:00 y deja la computadora despierta, con conexión y Chrome abierto. Después de abrir Parqueo Norte 132, espera al mediodía de **hoy** en `PARKALOT_TIMEZONE` (por defecto Costa Rica), aunque la reserva corresponda a mañana o al lunes. Usa el reloj del equipo; mantenlo sincronizado.

A partir de las 12:00 comprueba cada 20 ms si Reserve se habilitó. Cada espacio tiene hasta tres segundos para habilitarse; si sigue deshabilitado pasa al siguiente. La búsqueda completa tiene un límite de cinco minutos, contado desde mediodía o desde el inicio de esta etapa si se ejecuta más tarde.

Después de cada clic espera un aviso nuevo de Parkalot: **Successfully reserved** termina el proceso; **Could not reserve** permite probar el siguiente espacio; **Network error** o una espera de 15 segundos sin resultado detiene los intentos para evitar duplicados. No fuerza botones deshabilitados ni repite un espacio. La precisión efectiva depende del navegador, la activación del botón y la conexión. No recarga la página automáticamente. Deja la ventana abierta para revisar la reserva.

# Roles, vínculo banquero–jugador y menú por rol

## Qué se construye

Tres tipos de cuenta con pantallas distintas, y cada jugador atado a un banquero.

### 1. Roles
- Roles: **admin**, **banquero**, **jugador**.
- Quien se registra queda como **jugador** automáticamente.
- El **admin** tiene un panel para ver a los usuarios registrados y darles (o quitarles) el rol de banquero.
- El primer administrador se asigna directamente en la base de datos (me dices cuál correo y lo dejo listo).

### 2. Vínculo banquero–jugador
- Cada banquero recibe un **código de invitación** (ej. `TF-K7M2`) que puede copiar y compartir.
- Al entrar por primera vez, el jugador escribe ese código y queda vinculado a ese banquero.
- El jugador solo ve las carreras y la pizarra de su banquero.
- El banquero solo ve sus carreras, sus jugadores y los tickets de ellos.
- El jugador puede cambiar de banquero metiendo otro código.

### 3. Menú según el rol
Un menú superior común que cambia según quién entra:
- **Admin:** Usuarios y roles.
- **Banquero:** Carreras, tabla fija, tickets, cierre de apuestas, quién cruzó la raya, balance.
- **Jugador:** Pizarra de su banquero, calculadora de pago, y sus tickets.

Al iniciar sesión, cada quien cae directo en su pantalla principal.

## Pantallas
- `/` — portada pública con explicación breve y botón de entrar (ya no muestra la pizarra abierta a cualquiera).
- `/auth` — entrar / registrarse (igual que hoy).
- `/inicio` — redirige según el rol.
- `/admin` — lista de usuarios, su rol actual, botones para aprobar o revocar banquero.
- `/banquero` — panel actual, ahora también con su código de invitación y la lista de sus jugadores.
- `/pizarra` — vista del jugador: carreras de su banquero, multiplicadores, calculadora y sus tickets.
- `/vincular` — donde el jugador mete el código si todavía no tiene banquero.

## Detalles técnicos

**Base de datos (migración):**
- `app_role` enum (`admin`, `banquero`, `jugador`) y tabla `user_roles` (user_id, role) con `has_role(_user_id, _role)` como función security definer — los roles nunca se guardan en el perfil.
- `profiles` (id = auth.users.id, display_name, banquero_id nullable, invite_code único nullable).
- Trigger `on_auth_user_created`: crea el perfil y asigna el rol `jugador`.
- Al otorgar rol banquero se genera su `invite_code`.
- `tickets` gana `player_id uuid` nullable para el historial personal del jugador.
- RLS reescrita: se elimina la lectura pública de `races`/`horses`/`tickets`.
  - `races`/`horses`: lee el dueño, sus jugadores vinculados y los admins.
  - `tickets`: lee el banquero dueño de la carrera, el jugador dueño del ticket y los admins; escribe solo el banquero.
  - `profiles`: cada quien lee/edita el suyo; el banquero lee los perfiles vinculados a él; el admin lee todos.
  - `user_roles`: cada quien lee el suyo; solo admin escribe.
  - GRANTs explícitos a `authenticated` (sin `anon`) en cada tabla nueva.
- Vinculación por código: función security definer `link_to_banquero(_code text)` que busca el `invite_code`, valida que ese dueño sea banquero y actualiza `profiles.banquero_id` del llamante.

**Frontend:**
- `src/lib/session.functions.ts` con `createServerFn` + `requireSupabaseAuth` para leer rol + perfil; hook `useSession` que lo consume con TanStack Query.
- `src/components/AppNav.tsx` — menú por rol + cerrar sesión (cancelar queries, limpiar caché, `signOut`, navegar a `/auth` con replace).
- Gates de rol con layouts sin ruta bajo `_authenticated` (`_admin`, `_banquero`, `_jugador`) que redirigen si el rol no corresponde.
- El panel actual de banquero se mantiene, filtrando carreras/tickets por `owner_id` y agregando código de invitación y lista de jugadores.
- `head()` propio con título y descripción en cada ruta nueva.

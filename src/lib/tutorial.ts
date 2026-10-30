import inicio from "@/assets/tutorial/inicio.webp.asset.json";
import auth from "@/assets/tutorial/auth.webp.asset.json";
import carreras from "@/assets/tutorial/carreras.webp.asset.json";
import pizarra from "@/assets/tutorial/pizarra.webp.asset.json";
import jugadores from "@/assets/tutorial/jugadores.webp.asset.json";
import banquero from "@/assets/tutorial/banquero.webp.asset.json";
import movimientos from "@/assets/tutorial/movimientos.webp.asset.json";
import depositos from "@/assets/tutorial/depositos.webp.asset.json";
import retiros from "@/assets/tutorial/retiros.webp.asset.json";
import admin from "@/assets/tutorial/admin.webp.asset.json";
import vincular from "@/assets/tutorial/vincular.webp.asset.json";

export const tutorialSteps = [
  { title: "Bienvenida", group: "Primeros pasos", audience: "Todos", path: "/", image: inicio.url, script: "Bienvenido a Tabla Fija Solutorres. Desde esta pantalla puedes entrar o crear tu cuenta. Cada persona verá las opciones correspondientes a su función dentro de la plataforma." },
  { title: "Entrar o registrarse", group: "Primeros pasos", audience: "Todos", path: "/auth", image: auth.url, script: "Escribe tu correo y clave para entrar, o crea una cuenta nueva. También puedes continuar con Google. Las cuentas nuevas comienzan como jugadores; un administrador puede aprobar a un usuario como banquero." },
  { title: "Tu panel de entrada", group: "Primeros pasos", audience: "Todos", path: "/inicio", image: carreras.url, script: "Al iniciar sesión, la plataforma te dirige automáticamente a tu pantalla principal. El administrador llega a Carreras, el banquero a Vender y el jugador a Pizarra. El menú cambia según tu rol." },
  { title: "Programar carreras", group: "Carreras y jugadas", audience: "Administrador", path: "/carreras", image: carreras.url, script: "En Carreras, el administrador monta la programación, asigna números y ejemplares y establece los valores de la tabla fija. Puede filtrar por fecha, cerrar las apuestas y declarar cuál caballo cruzó la raya. Solo el administrador controla estos resultados." },
  { title: "Consultar la pizarra", group: "Carreras y jugadas", audience: "Jugador", path: "/pizarra", image: pizarra.url, script: "En la pizarra, el jugador consulta las carreras de su banquero y filtra por fecha. Al abrir una carrera puede revisar los ejemplares y sus valores, elegir una jugada y consultar sus tickets. Solo puede jugar si tiene saldo suficiente y la carrera admite apuestas." },
  { title: "Vender y validar", group: "Carreras y jugadas", audience: "Banquero", path: "/banquero", image: banquero.url, script: "El banquero usa Vender para registrar tickets y revisar únicamente sus ventas. Selecciona un jugador vinculado, una carrera y un ejemplar. Las solicitudes de depósito o retiro aparecen aquí para su revisión; los movimientos de saldo deben confirmarse antes de reflejarse." },
  { title: "Mis jugadores", group: "Participantes", audience: "Banquero", path: "/jugadores", image: jugadores.url, script: "En Mis jugadores, el banquero comparte su código de invitación y consulta a las personas vinculadas a él. Aquí puede revisar sus saldos y gestionar abonos o descuentos autorizados." },
  { title: "Vincular banquero", group: "Participantes", audience: "Jugador", path: "/vincular", image: vincular.url, script: "El jugador solicita el código de invitación a su banquero y lo escribe en Mi banquero. La vinculación determina qué pizarra y carreras verá. Si cambia de banquero, debe ingresar el nuevo código." },
  { title: "Recargar saldo", group: "Saldo y movimientos", audience: "Jugador", path: "/depositos", image: depositos.url, script: "Para recargar, entra en Depósitos, realiza el pago móvil a los datos de tu banquero y reporta el monto y la referencia. El depósito queda pendiente hasta que el banquero lo aprueba. Reportarlo por sí solo no añade saldo." },
  { title: "Solicitar un retiro", group: "Saldo y movimientos", audience: "Jugador", path: "/retiros", image: retiros.url, script: "En Retiros puedes consultar el saldo disponible y solicitar una transferencia. Indica el monto y los datos de destino. El banquero revisa la solicitud; puedes consultar su estado en esta misma pantalla." },
  { title: "Revisar movimientos", group: "Saldo y movimientos", audience: "Jugador", path: "/movimientos", image: movimientos.url, script: "Movimientos reúne el historial de jugadas, depósitos y retiros. Usa los filtros de tipo y fecha para localizar una operación y comprobar su estado y monto." },
  { title: "Administrar banqueros", group: "Administración", audience: "Administrador", path: "/admin", image: admin.url, script: "En Administración, el administrador revisa los usuarios registrados y aprueba o revoca el rol de banquero. Cada administrador gestiona sus propios banqueros. Desde Carreras puede consultar las ventas y el balance de su red." },
] as const;

export const tutorialGroups = ["Primeros pasos", "Carreras y jugadas", "Participantes", "Saldo y movimientos", "Administración"] as const;

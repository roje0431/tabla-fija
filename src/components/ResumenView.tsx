import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppNav } from "@/components/AppNav";
import { useSession } from "@/hooks/useSession";
import { bs } from "@/lib/tabla";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Mode = "admin" | "banquero";
type Entity = { id: string; name: string };
type TicketRow = {
  id: string; code: string; player_name: string; amount: number; payout: number;
  status: string; created_at: string; banquero_id: string | null; player_id: string | null; race_id: string;
};
type MoveRow = { id: string; player_id: string; amount: number; reason: string; created_at: string };
type CashRow = { id: string; player_id: string; amount: number; status: string | null; created_at: string; kind: "Depósito" | "Retiro" };

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
const inRange = (iso: string, from: string, to: string) => {
  const d = iso.slice(0, 10);
  return (!from || d >= from) && (!to || d <= to);
};

export function ResumenView({ mode }: { mode: Mode }) {
  const { data: session } = useSession();
  const uid = session?.userId;
  const [from, setFrom] = useState(daysAgo(7));
  const [to, setTo] = useState(today());
  const [entity, setEntity] = useState("todos");

  const entityLabel = mode === "admin" ? "Banquero" : "Jugador";

  const q = useQuery({
    queryKey: ["resumen", mode, uid],
    enabled: !!uid,
    refetchInterval: 30_000,
    queryFn: async () => {
      const entCol = mode === "admin" ? "admin_id" : "banquero_id";
      const { data: ents, error: e1 } = await supabase
        .from("profiles").select("id, display_name, email").eq(entCol, uid!);
      if (e1) throw e1;
      const entities: Entity[] = (ents ?? []).map((p) => ({ id: p.id, name: p.display_name || p.email || "—" }));

      let players: Entity[] = entities;
      if (mode === "admin" && entities.length) {
        const { data: pl } = await supabase.from("profiles").select("id, display_name, email, banquero_id")
          .in("banquero_id", entities.map((e) => e.id));
        players = (pl ?? []).map((p) => ({ id: p.id, name: p.display_name || p.email || "—", banquero: p.banquero_id } as Entity & { banquero: string }));
      }

      let tq = supabase.from("tickets")
        .select("id, code, player_name, amount, payout, status, created_at, banquero_id, player_id, race_id")
        .order("created_at", { ascending: false }).limit(2000);
      tq = mode === "admin" ? tq.in("race_id", (await supabase.from("races").select("id").eq("owner_id", uid!)).data?.map((r) => r.id) ?? ["00000000-0000-0000-0000-000000000000"]) : tq.eq("banquero_id", uid!);
      const { data: tickets, error: e2 } = await tq;
      if (e2) throw e2;

      const pids = players.map((p) => p.id);
      const moves: MoveRow[] = pids.length
        ? ((await supabase.from("balance_movements").select("id, player_id, amount, reason, created_at")
            .in("player_id", pids).order("created_at", { ascending: false }).limit(2000)).data ?? []) as MoveRow[]
        : [];

      let cash: CashRow[] = [];
      if (mode === "banquero") {
        const [d, r] = await Promise.all([
          supabase.from("depositos").select("id, player_id, amount, status, created_at").eq("banquero_id", uid!),
          supabase.from("retiros").select("id, player_id, amount, status, created_at").eq("banquero_id", uid!),
        ]);
        cash = [
          ...(d.data ?? []).map((x) => ({ ...x, kind: "Depósito" as const })),
          ...(r.data ?? []).map((x) => ({ ...x, kind: "Retiro" as const })),
        ].sort((a, b) => b.created_at.localeCompare(a.created_at));
      }
      return { entities, players: players as (Entity & { banquero?: string })[], tickets: (tickets ?? []) as TicketRow[], moves, cash };
    },
  });

  const data = q.data;
  const view = useMemo(() => {
    if (!data) return null;
    const playerIdsForEntity = (id: string) =>
      mode === "admin" ? data.players.filter((p) => p.banquero === id).map((p) => p.id) : [id];
    const allowedPlayers = entity === "todos" ? null : new Set(playerIdsForEntity(entity));
    const tickets = data.tickets.filter((t) => inRange(t.created_at, from, to) &&
      (entity === "todos" || (mode === "admin" ? t.banquero_id === entity : t.player_id === entity)));
    const moves = data.moves.filter((m) => inRange(m.created_at, from, to) && (!allowedPlayers || allowedPlayers.has(m.player_id)));
    const cash = data.cash.filter((c) => inRange(c.created_at, from, to) && (!allowedPlayers || allowedPlayers.has(c.player_id)));
    const valid = tickets.filter((t) => t.status !== "void" && t.status !== "cancelled");
    const vendido = valid.reduce((s, t) => s + Number(t.amount), 0);
    const pagado = valid.reduce((s, t) => s + Number(t.payout || 0), 0);
    const recargas = moves.filter((m) => Number(m.amount) > 0 && /recarga|abono|deposit/i.test(m.reason)).reduce((s, m) => s + Number(m.amount), 0);
    const depAprob = cash.filter((c) => c.kind === "Depósito" && c.status === "approved").reduce((s, c) => s + Number(c.amount), 0);
    const retAprob = cash.filter((c) => c.kind === "Retiro" && c.status === "approved").reduce((s, c) => s + Number(c.amount), 0);

    const groupKey = (t: TicketRow) => (mode === "admin" ? t.banquero_id : t.player_id) ?? "calle";
    const byEntity = new Map<string, { vendido: number; pagado: number; tickets: number }>();
    valid.forEach((t) => {
      const k = groupKey(t);
      const g = byEntity.get(k) ?? { vendido: 0, pagado: 0, tickets: 0 };
      g.vendido += Number(t.amount); g.pagado += Number(t.payout || 0); g.tickets++;
      byEntity.set(k, g);
    });
    const nameOf = (id: string) => data.entities.find((e) => e.id === id)?.name ?? data.players.find((p) => p.id === id)?.name ?? (id === "calle" ? "Sin cuenta" : "—");
    const rows = [...byEntity.entries()].map(([id, g]) => ({ id, name: nameOf(id), ...g, neto: g.vendido - g.pagado }))
      .sort((a, b) => b.vendido - a.vendido);
    return { tickets, moves, cash, vendido, pagado, neto: vendido - pagado, recargas, depAprob, retAprob, rows, nameOf };
  }, [data, entity, from, to, mode]);

  function shareWhatsApp() {
    if (!view) return;
    const ent = entity === "todos" ? "Todos" : view.nameOf(entity);
    const lines = [
      `🏇 *Resumen Tabla Fija* (${mode === "admin" ? "Administrador" : "Banquero"})`,
      `📅 ${from || "inicio"} → ${to || "hoy"}`,
      `👤 ${entityLabel}: ${ent}`,
      "",
      `🎟️ Tickets: ${view.tickets.length}`,
      `💰 Vendido: Bs ${bs(view.vendido)}`,
      `🏆 Pagado: Bs ${bs(view.pagado)}`,
      `📊 Neto: Bs ${bs(view.neto)}`,
      ...(mode === "banquero" ? [`⬆️ Depósitos aprobados: Bs ${bs(view.depAprob)}`, `⬇️ Retiros aprobados: Bs ${bs(view.retAprob)}`] : [`🔋 Recargas a jugadores: Bs ${bs(view.recargas)}`]),
      "",
      `*Detalle por ${entityLabel.toLowerCase()}:*`,
      ...view.rows.slice(0, 20).map((r) => `• ${r.name}: Bs ${bs(r.vendido)} / neto Bs ${bs(r.neto)}`),
    ];
    const text = lines.map(encodeURIComponent).join("%0A");
    window.open(`https://wa.me/?text=${text}`, "_blank");
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 pb-16">
      <AppNav title="Resumen" />

      <section className="mb-4 grid gap-2 rounded-2xl border bg-card p-3 sm:grid-cols-3">
        <label className="space-y-1 text-[11px] uppercase tracking-widest text-muted-foreground">
          Desde<Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="space-y-1 text-[11px] uppercase tracking-widest text-muted-foreground">
          Hasta<Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label className="space-y-1 text-[11px] uppercase tracking-widest text-muted-foreground">
          {entityLabel}
          <select value={entity} onChange={(e) => setEntity(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm normal-case tracking-normal text-foreground">
            <option value="todos">Todos</option>
            {(data?.entities ?? []).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </label>
        <div className="flex gap-2 sm:col-span-3">
          <Button variant="secondary" size="sm" onClick={() => { setFrom(today()); setTo(today()); }}>Hoy</Button>
          <Button variant="secondary" size="sm" onClick={() => { setFrom(daysAgo(7)); setTo(today()); }}>7 días</Button>
          <Button variant="secondary" size="sm" onClick={() => { setFrom(daysAgo(30)); setTo(today()); }}>30 días</Button>
          <Button size="sm" className="ml-auto" onClick={shareWhatsApp} disabled={!view}>Compartir por WhatsApp</Button>
        </div>
      </section>

      {q.isPending && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {q.error && <p className="text-sm text-destructive">No se pudo cargar el resumen.</p>}

      {view && (
        <>
          <section className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["Tickets", String(view.tickets.length)],
              ["Vendido", `Bs ${bs(view.vendido)}`],
              ["Pagado", `Bs ${bs(view.pagado)}`],
              ["Neto", `Bs ${bs(view.neto)}`],
              ...(mode === "banquero"
                ? [["Depósitos aprob.", `Bs ${bs(view.depAprob)}`], ["Retiros aprob.", `Bs ${bs(view.retAprob)}`]]
                : [["Recargas", `Bs ${bs(view.recargas)}`]]),
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border bg-card p-3">
                <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{k}</p>
                <p className="font-mono text-lg font-semibold">{v}</p>
              </div>
            ))}
          </section>

          <Table title={`Ventas por ${entityLabel.toLowerCase()}`} head={[entityLabel, "Tickets", "Vendido", "Pagado", "Neto"]}
            rows={view.rows.map((r) => [r.name, String(r.tickets), bs(r.vendido), bs(r.pagado), bs(r.neto)])} />
          <Table title="Tickets" head={["Fecha", "Código", "Jugador", "Monto", "Estado", "Premio"]}
            rows={view.tickets.slice(0, 100).map((t) => [t.created_at.slice(0, 10), t.code, t.player_name, bs(Number(t.amount)), t.status, bs(Number(t.payout || 0))])} />
          {mode === "banquero" && (
            <Table title="Depósitos y retiros" head={["Fecha", "Tipo", "Jugador", "Monto", "Estado"]}
              rows={view.cash.map((c) => [c.created_at.slice(0, 10), c.kind, view.nameOf(c.player_id), bs(Number(c.amount)), c.status ?? "pending"])} />
          )}
          <Table title="Movimientos de saldo" head={["Fecha", "Jugador", "Motivo", "Monto"]}
            rows={view.moves.slice(0, 100).map((m) => [m.created_at.slice(0, 10), view.nameOf(m.player_id), m.reason, bs(Number(m.amount))])} />
        </>
      )}
    </main>
  );
}

function Table({ title, head, rows }: { title: string; head: string[]; rows: string[][] }) {
  return (
    <section className="mb-4 rounded-2xl border bg-card p-3">
      <h2 className="mb-2 text-xl">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin datos en este rango.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr>{head.map((h) => <th key={h} className="whitespace-nowrap px-2 py-1 text-left text-[11px] uppercase text-muted-foreground">{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t">
                  {r.map((c, j) => <td key={j} className={`whitespace-nowrap px-2 py-1 ${j > 0 && /^-?[\d.,]+$/.test(c) ? "text-right font-mono" : ""}`}>{c}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

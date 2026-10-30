export type RaceStatus = "open" | "closed" | "settled";

export type Race = {
  id: string;
  owner_id: string;
  track: string;
  race_number: number;
  race_date: string;
  status: RaceStatus;
  winner_horse_id: string | null;
  created_at: string;
};

export type Horse = {
  id: string;
  race_id: string;
  number: number;
  name: string;
  multiplier: number;
  retired: boolean;
  blocked: boolean;
};

export type Ticket = {
  id: string;
  race_id: string;
  horse_id: string;
  code: string;
  player_name: string;
  amount: number;
  multiplier: number;
  status: "pending" | "won" | "lost";
  payout: number;
  created_at: string;
  player_id: string | null;
  banquero_id: string | null;
};

export const bs = (n: number) =>
  new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    Number.isFinite(n) ? n : 0,
  );

export const statusLabel: Record<RaceStatus, string> = {
  open: "Apuestas abiertas",
  closed: "Apuestas cerradas",
  settled: "Cruzó la raya",
};

export function newTicketCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

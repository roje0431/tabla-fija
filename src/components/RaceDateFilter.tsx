import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function RaceDateFilter({
  value,
  onChange,
  count,
}: {
  value: string;
  onChange: (v: string) => void;
  count: number;
}) {
  return (
    <section className="mb-4 rounded-2xl border bg-card p-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
        <div className="space-y-1.5">
          <label
            htmlFor="filtro-fecha"
            className="text-[11px] uppercase tracking-widest text-muted-foreground"
          >
            Filtrar por fecha
          </label>
          <Input
            id="filtro-fecha"
            type="date"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
        <Button type="button" variant="secondary" onClick={() => onChange("")} disabled={!value}>
          Todas
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {count === 0
          ? "No hay carreras en esa fecha."
          : `${count} carrera${count === 1 ? "" : "s"} en la lista.`}
      </p>
    </section>
  );
}

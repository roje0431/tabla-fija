import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ExternalLink, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tutorialGroups, tutorialSteps } from "@/lib/tutorial";
import { useSession } from "@/hooks/useSession";

export const Route = createFileRoute("/tutorial")({
  head: () => ({ meta: [
    { title: "Tutorial guiado — Tabla Fija Solutorres" },
    { name: "description", content: "Recorre las pantallas de Tabla Fija Solutorres con imágenes reales, subtítulos y narración opcional." },
    { property: "og:title", content: "Tutorial guiado — Tabla Fija Solutorres" },
    { property: "og:description", content: "Guía visual de carreras, jugadas, saldos y administración de Tabla Fija Solutorres." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: TutorialPage,
});

const STEP_SECONDS = 18;
type Target = (typeof tutorialSteps)[number]["path"];

function TutorialPage() {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [voice, setVoice] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [voiceAvailable, setVoiceAvailable] = useState(false);
  const { data: session } = useSession();
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  const step = tutorialSteps[index] ?? tutorialSteps[0];
  const last = index === tutorialSteps.length - 1;
  const canOpen = step.audience === "Todos" || session?.role === "admin" || (step.audience === "Banquero" && session?.role === "banquero") || (step.audience === "Jugador" && session?.role === "jugador");

  useEffect(() => { setVoiceAvailable("speechSynthesis" in window); }, []);
  useEffect(() => {
    setElapsed(0);
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    if (!playing || !voice || !voiceAvailable) return;
    const speech = new SpeechSynthesisUtterance(step.script);
    speech.lang = "es-VE";
    speech.rate = 0.95;
    utterance.current = speech;
    window.speechSynthesis.speak(speech);
    return () => { window.speechSynthesis.cancel(); utterance.current = null; };
  }, [index, playing, voice, voiceAvailable, step.script]);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setElapsed((current) => {
        if (current + 1 >= STEP_SECONDS) {
          if (last) setPlaying(false);
          else setIndex((i) => i + 1);
          return 0;
        }
        return current + 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [playing, last]);
  useEffect(() => () => { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); }, []);

  function select(i: number) { setIndex(i); setElapsed(0); }
  function togglePlay() {
    if (playing && "speechSynthesis" in window) window.speechSynthesis.cancel();
    if (last && elapsed === 0 && !playing) { setIndex(0); setPlaying(true); return; }
    setPlaying((v) => !v);
  }
  function toggleVoice() {
    if (voice && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setVoice((v) => !v);
  }

  return (
    <main className="min-h-screen bg-background pb-16">
      <div className="border-b border-border bg-card/60 px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <Link to={session ? "/inicio" : "/"} className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4 shrink-0" /><span className="truncate">Tabla Fija Solutorres</span></Link>
          <span className="shrink-0 text-xs font-semibold uppercase text-primary">Guía interactiva</span>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 pt-7 sm:px-8 sm:pt-10">
        <div className="mb-7 border-b border-border pb-6">
          <p className="text-xs font-semibold uppercase text-primary">Aprende a usar la plataforma</p>
          <h1 className="mt-1 text-4xl sm:text-5xl">Tutorial guiado</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Tabla Fija Solutorres · Jugadores, banqueros y administradores</p>
        </div>
        <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start">
          <div className="min-w-0">
            <div className="overflow-hidden rounded-md border border-border bg-card">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 py-3">
                <div className="min-w-0"><p className="text-xs uppercase text-primary">{step.group} · {step.audience}</p><h2 className="truncate text-2xl sm:text-3xl">{step.title}</h2></div>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{String(index + 1).padStart(2, "0")} / {tutorialSteps.length}</span>
              </div>
              <div className="relative mx-auto flex aspect-[4/3] max-h-[570px] justify-center overflow-hidden bg-background sm:aspect-[16/10]">
                <img key={step.image} src={step.image} alt={`Captura de la pantalla ${step.title} de Tabla Fija Solutorres`} className="h-full w-full object-contain" />
                <span className="absolute bottom-3 left-3 rounded-sm bg-background/90 px-2 py-1 text-xs text-foreground">Captura de la plataforma</span>
              </div>
              <div className="h-1 bg-muted" role="progressbar" aria-label="Progreso del paso" aria-valuenow={elapsed} aria-valuemin={0} aria-valuemax={STEP_SECONDS}><div className="h-full bg-primary transition-[width] duration-1000 motion-reduce:transition-none" style={{ width: `${(elapsed / STEP_SECONDS) * 100}%` }} /></div>
              <div className="p-4 sm:p-6">
                <p className="text-xs font-semibold uppercase text-primary">Guion · {step.path}</p>
                <p aria-live="polite" className="mt-2 min-h-20 text-base leading-relaxed text-foreground">{step.script}</p>
                <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
                  <Button onClick={togglePlay} aria-label={playing ? "Pausar" : "Reproducir"} title={playing ? "Pausar" : "Reproducir"} size="icon">{playing ? <Pause /> : <Play />}</Button>
                  <Button onClick={toggleVoice} disabled={!voiceAvailable} aria-label={voice ? "Silenciar narración" : "Activar narración"} title={voice ? "Silenciar narración" : "Activar narración"} variant="outline" size="icon">{voice ? <Volume2 /> : <VolumeX />}</Button>
                  <span className="mr-auto text-xs text-muted-foreground">{voiceAvailable ? (voice ? "Narración activada" : "Subtítulos activados") : "Subtítulos"}</span>
                  <Button onClick={() => select(index - 1)} disabled={index === 0} aria-label="Anterior" title="Anterior" variant="outline" size="icon"><ArrowLeft /></Button>
                  <Button onClick={() => select(index + 1)} disabled={last} aria-label="Siguiente" title="Siguiente" size="icon"><ArrowRight /></Button>
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 text-sm text-muted-foreground">
              <span>Vista: {step.path}</span>
              {canOpen ? <Button asChild variant="link" className="px-0"><Link to={step.path as Target}>Abrir pantalla <ExternalLink className="size-4" /></Link></Button> : <span>Disponible para {step.audience.toLowerCase()}</span>}
            </div>
          </div>
          <aside className="border-t border-border pt-5 lg:border-t-0 lg:border-l lg:pl-6 lg:pt-0" aria-label="Módulos del tutorial">
            <p className="mb-4 text-xs font-semibold uppercase text-muted-foreground">Ir a un módulo</p>
            {tutorialGroups.map((group) => <div key={group} className="mb-5">
              <h3 className="mb-2 text-lg text-primary">{group}</h3>
              <div className="space-y-1">{tutorialSteps.map((item, i) => item.group === group && <Button key={item.path} variant={index === i ? "secondary" : "ghost"} onClick={() => select(i)} className="h-auto w-full justify-start whitespace-normal px-3 py-2 text-left text-sm"><span className="w-6 shrink-0 text-xs tabular-nums text-muted-foreground">{String(i + 1).padStart(2, "0")}</span><span className="min-w-0">{item.title}</span></Button>)}</div>
            </div>)}
          </aside>
        </div>
      </div>
    </main>
  );
}

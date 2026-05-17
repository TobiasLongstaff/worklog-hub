import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { SettingsAPI, AISettingsAPI } from "@/lib/api";
import { IS_TAURI } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { NgrokSettings, NgrokState, AISettings } from "@/lib/types";
import { NgrokStatusPanel } from "./NgrokStatusPanel";
import { Skeleton } from "@/components/ui/skeleton";
import { FadeIn } from "@/components/shared/FadeIn";
import {
  CheckCircle2,
  XCircle,
  ChevronDown,
  ExternalLink,
  Settings2,
  Clipboard,
  Check,
  BookOpen,
  FlaskConical,
  Circle,
  Cpu,
} from "lucide-react";

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

const DEFAULT_SETTINGS: NgrokSettings = {
  ngrokAuthtokenConfigured: false,
  ngrokAuthtoken: "",
  ngrokDevDomain: "",
  ngrokAutostart: false,
  ngrokBinaryPath: "",
  chatgptProjectUrl: "",
};

const DEFAULT_AI: AISettings = {
  aiProvider: "",
  openaiApiKeyConfigured: false,
  openaiApiKey: "",
  openaiModel: "gpt-4o-mini",
  anthropicApiKeyConfigured: false,
  anthropicApiKey: "",
  anthropicModel: "claude-sonnet-4-6",
};

const DEFAULT_STATE: NgrokState = {
  status: "NOT_CONFIGURED",
  publicUrl: null,
  errorMessage: null,
  pid: null,
};

function Toggle({
  checked,
  onChange,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  id: string;
}) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        checked ? "bg-primary" : "bg-input"
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block size-4 rounded-full bg-background shadow-sm ring-0 transition-transform duration-200",
          checked ? "translate-x-4" : "translate-x-0"
        )}
      />
    </button>
  );
}

function Prereq({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[12px]">
      {ok ? (
        <CheckCircle2 className="size-3.5 text-success shrink-0" />
      ) : (
        <XCircle className="size-3.5 text-muted-foreground shrink-0" />
      )}
      <span className={ok ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}

export function ChatGptSettings() {
  const [settings, setSettings] = useState<NgrokSettings>(DEFAULT_SETTINGS);
  const [state, setState] = useState<NgrokState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");
  const [domain, setDomain] = useState("");
  const [autostart, setAutostart] = useState(false);
  const [binary, setBinary] = useState("");
  const [projectUrl, setProjectUrl] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  const [showWhereToPlace, setShowWhereToPlace] = useState(false);
  const [copiedInstructions, setCopiedInstructions] = useState(false);
  const [copiedTestPrompt, setCopiedTestPrompt] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiSettings, setAiSettings] = useState<AISettings>(DEFAULT_AI);
  const [aiProvider, setAiProvider] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [openaiModel, setOpenaiModel] = useState("gpt-4o-mini");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [anthropicModel, setAnthropicModel] = useState("claude-sonnet-4-6");
  const [savingAI, setSavingAI] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const localMcpUrl = IS_TAURI
    ? "http://localhost:3131/mcp"
    : `${window.location.origin}/mcp`;

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const st = await SettingsAPI.getNgrokStatus();
        setState(st);
        if (st.status !== "STARTING") stopPolling();
      } catch {}
    }, 2000);
  }, [stopPolling]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, ns] = await Promise.all([SettingsAPI.getSettings(), SettingsAPI.getNgrokStatus()]);
      setSettings(s);
      setState(ns);
      setToken(s.ngrokAuthtoken ?? "");
      setDomain(s.ngrokDevDomain ?? "");
      setAutostart(!!s.ngrokAutostart);
      setBinary(s.ngrokBinaryPath ?? "");
      setProjectUrl(s.chatgptProjectUrl ?? "");
      if (ns.status === "STARTING") startPolling();
      const ai = await AISettingsAPI.get();
      setAiSettings(ai);
      setAiProvider(ai.aiProvider ?? "");
      setOpenaiKey(ai.openaiApiKey ?? "");
      setOpenaiModel(ai.openaiModel ?? "gpt-4o-mini");
      setAnthropicKey(ai.anthropicApiKey ?? "");
      setAnthropicModel(ai.anthropicModel ?? "claude-sonnet-4-6");
    } catch (e) {
      console.error("Error cargando settings:", e);
    } finally {
      setLoading(false);
    }
  }, [startPolling]);

  useEffect(() => { load(); return () => stopPolling(); }, [load, stopPolling]);

  async function saveAndActivate() {
    if (!domain.trim()) {
      toast.error("Completá el dominio estático antes de activar");
      return;
    }
    setSaving(true);
    try {
      const updated = await SettingsAPI.saveSettings({
        ngrokAuthtoken: token,
        ngrokDevDomain: domain.trim(),
        ngrokAutostart: autostart,
        ngrokBinaryPath: binary.trim(),
        chatgptProjectUrl: projectUrl.trim(),
      });
      setSettings(updated);
      toast.info("Configuración guardada, activando túnel…");
      const st = await SettingsAPI.startNgrok();
      setState(st);
      startPolling();
    } catch (e) {
      toast.error(`Error: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  async function saveOnly() {
    setSaving(true);
    try {
      const updated = await SettingsAPI.saveSettings({
        ngrokAuthtoken: token,
        ngrokDevDomain: domain.trim(),
        ngrokAutostart: autostart,
        ngrokBinaryPath: binary.trim(),
        chatgptProjectUrl: projectUrl.trim(),
      });
      setSettings(updated);
      toast.success("Configuración guardada");
    } catch (e) {
      toast.error(`Error al guardar: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  async function startTunnel() {
    setState({ status: "STARTING", publicUrl: null, errorMessage: null, pid: null });
    try {
      const st = await SettingsAPI.startNgrok();
      setState(st);
      startPolling();
    } catch (e) {
      setState({ status: "ERROR", publicUrl: null, errorMessage: (e as Error).message, pid: null });
    }
  }

  async function stopTunnel() {
    stopPolling();
    try {
      const st = await SettingsAPI.stopNgrok();
      setState(st);
    } catch (e) {
      toast.error(`Error al detener: ${(e as Error).message}`);
    }
  }

  async function saveAI() {
    setSavingAI(true);
    try {
      const updated = await AISettingsAPI.save({
        aiProvider: aiProvider.trim(),
        openaiApiKey: openaiKey,
        openaiModel: openaiModel.trim() || "gpt-4o-mini",
        anthropicApiKey: anthropicKey,
        anthropicModel: anthropicModel.trim() || "claude-sonnet-4-6",
      });
      setAiSettings(updated);
      setOpenaiKey(updated.openaiApiKey ?? "");
      setAnthropicKey(updated.anthropicApiKey ?? "");
      toast.success("Configuración de IA guardada");
    } catch (e) {
      toast.error(`Error: ${(e as Error).message}`);
    } finally {
      setSavingAI(false);
    }
  }

  async function copyInstructions() {
    try {
      await navigator.clipboard.writeText(PROJECT_INSTRUCTIONS);
      setCopiedInstructions(true);
      toast.success("Instrucciones copiadas. Pegalas en las Project Instructions de ChatGPT.");
      setTimeout(() => setCopiedInstructions(false), 2000);
    } catch {
      toast.error("No se pudo copiar");
    }
  }

  async function copyTestPrompt() {
    try {
      await navigator.clipboard.writeText(TEST_PROMPT);
      setCopiedTestPrompt(true);
      toast.success("Prueba copiada. Pegala en un chat del Project con la app Worklog Hub activada.");
      setTimeout(() => setCopiedTestPrompt(false), 2000);
    } catch {
      toast.error("No se pudo copiar");
    }
  }

  const hasToken = settings.ngrokAuthtokenConfigured || token.length > 4;
  const hasDomain = domain.trim().length > 4;
  const isConfigured = hasToken && hasDomain;
  const tunnelActive = state.status === "ACTIVE";

  if (loading) {
    return (
      <div className="p-6 space-y-4 max-w-2xl mx-auto">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">

      {/* ── 1. Guía para ChatGPT (colapsable, abierta por defecto) ────── */}
      <FadeIn delay={0}>
        <Card>
          <button
            type="button"
            className="w-full"
            onClick={() => setShowGuide((v) => !v)}
          >
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Cómo conectar ChatGPT con Worklog Hub</CardTitle>
                <motion.span
                  animate={{ rotate: showGuide ? 180 : 0 }}
                  transition={{ duration: 0.2, ease: EASE }}
                  className="text-muted-foreground"
                >
                  <ChevronDown className="size-4" />
                </motion.span>
              </div>
            </CardHeader>
          </button>

          <AnimatePresence initial={false}>
            {showGuide && (
              <motion.div
                key="guide"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: EASE }}
                className="overflow-hidden"
              >
                <CardContent className="pt-0 space-y-4">
                  <Separator />
                  {STEPS.map((step) => (
                    <div key={step.n} className="flex gap-3">
                      <div className="shrink-0 size-6 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-bold">
                        {step.n}
                      </div>
                      <div className="flex-1 pt-0.5">
                        <div className="font-semibold text-sm">{step.title}</div>
                        <div
                          className="text-sm text-muted-foreground mt-0.5 leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: step.desc }}
                        />
                        {step.code ? (
                          <code className="block text-xs font-mono bg-muted px-2 py-1.5 rounded-lg mt-1.5 break-all border border-border/40">
                            {step.code}
                          </code>
                        ) : null}
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2.5 leading-relaxed">
                    El dominio estático es permanente: configurás el conector en ChatGPT una sola vez y funciona siempre que Worklog Hub esté abierto.
                  </p>
                </CardContent>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </FadeIn>

      {/* ── 2. Estado actual ───────────────────────────────────────────── */}
      <FadeIn delay={0.06}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Estado de la conexión</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Servidor local siempre activo */}
            <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
              <div className="flex items-center gap-2 min-w-0">
                <span className="relative flex size-2 shrink-0">
                  <span className="animate-ping absolute inline-flex size-full rounded-full bg-success opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-success" />
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-medium">MCP local activo</div>
                  <code className="text-[11px] text-muted-foreground font-mono truncate block">{localMcpUrl}</code>
                </div>
              </div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">Solo red local</span>
            </div>

            {/* Túnel remoto (ngrok) */}
            <NgrokStatusPanel state={state} onStart={startTunnel} onStop={stopTunnel} />
          </CardContent>
        </Card>
      </FadeIn>

      {/* ── 3. Configuración ───────────────────────────────────────────── */}
      <FadeIn delay={0.14}>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-sm">Configurar acceso remoto</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Necesitás una cuenta gratuita en{" "}
                  <a
                    href="https://ngrok.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline-offset-2 hover:underline inline-flex items-center gap-0.5"
                  >
                    ngrok.com <ExternalLink className="size-2.5" />
                  </a>
                  {" "}y ngrok instalado en tu PC.
                </p>
              </div>
              {/* Checklist de requisitos */}
              <div className="flex flex-col gap-1 shrink-0 pt-0.5">
                <Prereq ok={hasToken} label="Token configurado" />
                <Prereq ok={hasDomain} label="Dominio configurado" />
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Aviso de instalación si no está configurado */}
            {!isConfigured && (
              <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5">
                <div className="text-xs text-foreground/90 leading-relaxed">
                  <strong>Paso previo:</strong> descargá e instalá ngrok desde{" "}
                  <a
                    href="https://ngrok.com/download"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline-offset-2 hover:underline inline-flex items-center gap-0.5 font-medium"
                  >
                    ngrok.com/download <ExternalLink className="size-2.5" />
                  </a>
                  . Es gratis y tarda 2 minutos.
                </div>
              </div>
            )}

            {/* Authtoken */}
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label>Token de autenticación</Label>
                <a
                  href="https://dashboard.ngrok.com/get-started/your-authtoken"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-primary flex items-center gap-0.5 hover:underline"
                >
                  Cómo obtenerlo <ExternalLink className="size-2.5" />
                </a>
              </div>
              <Input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={
                  settings.ngrokAuthtokenConfigured
                    ? "Ya configurado — pegá uno nuevo solo si querés cambiarlo"
                    : "Pegá tu authtoken de ngrok.com"
                }
                autoComplete="off"
                className="font-mono text-sm"
              />
              {settings.ngrokAuthtokenConfigured && (
                <p className="text-[11px] text-success flex items-center gap-1">
                  <CheckCircle2 className="size-3" /> Token guardado correctamente
                </p>
              )}
            </div>

            {/* Dominio estático */}
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label>Dominio estático</Label>
                <a
                  href="https://dashboard.ngrok.com/cloud-edge/domains"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-primary flex items-center gap-0.5 hover:underline"
                >
                  Ver en ngrok.com <ExternalLink className="size-2.5" />
                </a>
              </div>
              <Input
                value={domain}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
                  setDomain(cleaned);
                }}
                placeholder="algo-random.ngrok-free.app"
                className="font-mono text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                En ngrok.com → <strong>Cloud Edge → Domains</strong>. Solo el hostname, sin <code className="bg-muted px-1 rounded">https://</code>.
              </p>
            </div>

            {/* URL del Project de ChatGPT */}
            <div className="grid gap-1.5">
              <Label>URL del Project de ChatGPT <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <Input
                value={projectUrl}
                onChange={(e) => setProjectUrl(e.target.value)}
                placeholder="https://chatgpt.com/g/..."
                className="text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                Para acceder rápido desde Worklog Hub al Project donde tenés Worklog Hub configurado.
              </p>
            </div>

            <Separator />

            {/* Autostart */}
            <div className="flex items-center gap-3">
              <Toggle id="ngrok-autostart" checked={autostart} onChange={setAutostart} />
              <Label htmlFor="ngrok-autostart" className="cursor-pointer text-sm text-foreground font-normal">
                Activar el túnel automáticamente al abrir Worklog Hub
              </Label>
            </div>

            {/* Opciones avanzadas */}
            <div>
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <Settings2 className="size-3.5" />
                Opciones avanzadas
                <motion.span
                  animate={{ rotate: showAdvanced ? 180 : 0 }}
                  transition={{ duration: 0.2, ease: EASE }}
                >
                  <ChevronDown className="size-3.5" />
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {showAdvanced && (
                  <motion.div
                    key="advanced"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: EASE }}
                    className="overflow-hidden"
                  >
                    <div className="grid gap-1.5 mt-3 pt-3 border-t border-border/50">
                      <Label className="text-muted-foreground font-normal">
                        Ruta al ejecutable de ngrok{" "}
                        <span className="text-muted-foreground/60">(opcional)</span>
                      </Label>
                      <Input
                        value={binary}
                        onChange={(e) => setBinary(e.target.value)}
                        placeholder="ngrok   (se busca en PATH por defecto)"
                        className="font-mono text-sm"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Solo completar si ngrok está en una ubicación no estándar.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Acciones */}
            <div className="flex gap-2 pt-1">
              <Button
                onClick={saveAndActivate}
                disabled={saving}
                className="flex-1"
              >
                {saving ? "Guardando…" : tunnelActive ? "Guardar cambios" : "Guardar y activar túnel"}
              </Button>
              <Button
                variant="outline"
                onClick={saveOnly}
                disabled={saving}
              >
                Solo guardar
              </Button>
            </div>
          </CardContent>
        </Card>
      </FadeIn>
      {/* ── 4. Project Instructions ────────────────────────────────────── */}
      <FadeIn delay={0.2}>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start gap-3">
              <div className="shrink-0 mt-0.5 size-7 rounded-full bg-primary/15 text-primary flex items-center justify-center">
                <BookOpen className="size-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <CardTitle className="text-sm">Paso final: enseñarle a ChatGPT cuándo registrar pendientes</CardTitle>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Conectar Worklog Hub por MCP habilita las herramientas.{" "}
                  <strong className="text-foreground/80">Para que ChatGPT detecte automáticamente</strong>{" "}
                  bugs, deuda técnica o features postergadas durante tus conversaciones,
                  pegá estas instrucciones en el Project de ChatGPT donde trabajás.
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Distinción clave MCP vs Instructions */}
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-lg border border-success/30 bg-success/5 px-3 py-2.5">
                <div className="font-semibold text-success mb-0.5">MCP conectado</div>
                <div className="text-muted-foreground leading-relaxed">ChatGPT tiene herramientas disponibles para leer y escribir en Worklog Hub.</div>
              </div>
              <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5">
                <div className="font-semibold text-primary mb-0.5">Project Instructions configuradas</div>
                <div className="text-muted-foreground leading-relaxed">ChatGPT sabe qué comportamiento seguir de forma sostenida dentro del Project.</div>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground">
              Necesitás <strong>ambas cosas</strong> para tener la experiencia completa de detección activa.
            </p>

            <Separator />

            {/* Bloque de instrucciones */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Project Instructions recomendadas</Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={copyInstructions}
                  className="gap-1.5 h-7 text-xs"
                >
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={copiedInstructions ? "check" : "copy"}
                      initial={{ opacity: 0, scale: 0.7 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.7 }}
                      transition={{ duration: 0.15 }}
                      className="flex items-center gap-1.5"
                    >
                      {copiedInstructions ? <Check className="size-3" /> : <Clipboard className="size-3" />}
                      {copiedInstructions ? "Copiado" : "Copiar instrucciones"}
                    </motion.span>
                  </AnimatePresence>
                </Button>
              </div>
              <textarea
                readOnly
                value={PROJECT_INSTRUCTIONS}
                rows={10}
                className="w-full resize-none rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 font-mono text-[11px] leading-relaxed text-foreground/80 focus:outline-none"
              />
            </div>

            {/* Ver dónde pegarlas (colapsable) */}
            <div>
              <button
                type="button"
                onClick={() => setShowWhereToPlace((v) => !v)}
                className="flex items-center gap-1.5 text-[12px] text-primary hover:text-primary/80 transition-colors"
              >
                Ver dónde pegarlas
                <motion.span
                  animate={{ rotate: showWhereToPlace ? 180 : 0 }}
                  transition={{ duration: 0.2, ease: EASE }}
                >
                  <ChevronDown className="size-3.5" />
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {showWhereToPlace && (
                  <motion.div
                    key="where"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: EASE }}
                    className="overflow-hidden"
                  >
                    <ol className="mt-3 space-y-2 pl-1">
                      {WHERE_TO_PLACE_STEPS.map((s, i) => (
                        <li key={i} className="flex gap-2.5 text-xs">
                          <span className="shrink-0 size-4 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-[10px] font-bold mt-0.5">
                            {i + 1}
                          </span>
                          <span
                            className="text-muted-foreground leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: s }}
                          />
                        </li>
                      ))}
                    </ol>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <p className="text-[11px] text-muted-foreground bg-muted/30 rounded-lg px-3 py-2 leading-relaxed">
              Estas instrucciones aplican dentro del Project donde las pegues. Si trabajás con varios proyectos, podés usar variantes adaptadas para cada uno.
            </p>
          </CardContent>
        </Card>
      </FadeIn>

      {/* ── 0. Configuración de IA (para Resumen diario) ──────────────── */}
      <FadeIn delay={0}>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start gap-3">
              <div className="shrink-0 mt-0.5 size-7 rounded-full bg-primary/15 text-primary flex items-center justify-center">
                <Cpu className="size-3.5" />
              </div>
              <div>
                <CardTitle className="text-sm">Configuración de IA — Resumen diario</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Usada para generar el resumen diario automático desde la app.
                  El costo corre por tu cuenta según el modelo elegido.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Provider selector */}
            <div className="grid gap-1.5">
              <Label>Proveedor</Label>
              <div className="flex gap-2">
                {[
                  { val: "openai", label: "OpenAI" },
                  { val: "anthropic", label: "Anthropic" },
                ].map(({ val, label }) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setAiProvider(val)}
                    className={cn(
                      "flex-1 rounded-lg border px-3 py-2 text-sm transition-colors cursor-pointer",
                      aiProvider === val
                        ? "border-primary bg-primary/5 text-primary font-medium"
                        : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/60"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* OpenAI fields */}
            {aiProvider === "openai" && (
              <div className="space-y-3">
                <div className="grid gap-1.5">
                  <div className="flex items-center justify-between">
                    <Label>OpenAI API Key</Label>
                    <a
                      href="https://platform.openai.com/api-keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-primary flex items-center gap-0.5 hover:underline"
                    >
                      Obtener key <ExternalLink className="size-2.5" />
                    </a>
                  </div>
                  <Input
                    type="password"
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    placeholder={
                      aiSettings.openaiApiKeyConfigured
                        ? "Ya configurada — pegá una nueva solo si querés cambiarla"
                        : "sk-..."
                    }
                    autoComplete="off"
                    className="font-mono text-sm"
                  />
                  {aiSettings.openaiApiKeyConfigured && (
                    <p className="text-[11px] text-success flex items-center gap-1">
                      <CheckCircle2 className="size-3" /> API key guardada correctamente
                    </p>
                  )}
                </div>
                <div className="grid gap-1.5">
                  <Label>Modelo</Label>
                  <Input
                    value={openaiModel}
                    onChange={(e) => setOpenaiModel(e.target.value)}
                    placeholder="gpt-4o-mini"
                    className="font-mono text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Recomendado: <code className="bg-muted px-1 rounded">gpt-4o-mini</code> (económico) o <code className="bg-muted px-1 rounded">gpt-4o</code> (mayor calidad).
                  </p>
                </div>
              </div>
            )}

            {/* Anthropic fields */}
            {aiProvider === "anthropic" && (
              <div className="space-y-3">
                <div className="grid gap-1.5">
                  <div className="flex items-center justify-between">
                    <Label>Anthropic API Key</Label>
                    <a
                      href="https://console.anthropic.com/settings/keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-primary flex items-center gap-0.5 hover:underline"
                    >
                      Obtener key <ExternalLink className="size-2.5" />
                    </a>
                  </div>
                  <Input
                    type="password"
                    value={anthropicKey}
                    onChange={(e) => setAnthropicKey(e.target.value)}
                    placeholder={
                      aiSettings.anthropicApiKeyConfigured
                        ? "Ya configurada — pegá una nueva solo si querés cambiarla"
                        : "sk-ant-..."
                    }
                    autoComplete="off"
                    className="font-mono text-sm"
                  />
                  {aiSettings.anthropicApiKeyConfigured && (
                    <p className="text-[11px] text-success flex items-center gap-1">
                      <CheckCircle2 className="size-3" /> API key guardada correctamente
                    </p>
                  )}
                </div>
                <div className="grid gap-1.5">
                  <Label>Modelo</Label>
                  <Input
                    value={anthropicModel}
                    onChange={(e) => setAnthropicModel(e.target.value)}
                    placeholder="claude-sonnet-4-6"
                    className="font-mono text-sm"
                  />
                </div>
              </div>
            )}

            {!aiProvider && (
              <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
                Seleccioná un proveedor para ver los campos de configuración.
              </p>
            )}

            <Button onClick={saveAI} disabled={savingAI || !aiProvider} size="sm">
              {savingAI ? "Guardando…" : "Guardar configuración de IA"}
            </Button>
          </CardContent>
        </Card>
      </FadeIn>

      {/* ── 5. Prueba de integración completa ─────────────────────────── */}
      <FadeIn delay={0.26}>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start gap-3">
              <div className="shrink-0 mt-0.5 size-7 rounded-full bg-warning/15 text-warning flex items-center justify-center">
                <FlaskConical className="size-3.5" />
              </div>
              <div>
                <CardTitle className="text-sm">Probar la integración completa</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Validá el circuito de punta a punta antes de empezar a usar Worklog Hub en producción.
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Checklist previo */}
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Antes de probar, confirmá que:</p>
              <ul className="space-y-1.5">
                {PRE_TEST_CHECKLIST.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <Circle className="size-3 text-muted-foreground/50 shrink-0 mt-0.5" />
                    <span className="text-muted-foreground leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <Separator />

            {/* Prompt de prueba */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Mensaje de prueba para ChatGPT</Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={copyTestPrompt}
                  className="gap-1.5 h-7 text-xs"
                >
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={copiedTestPrompt ? "check" : "copy"}
                      initial={{ opacity: 0, scale: 0.7 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.7 }}
                      transition={{ duration: 0.15 }}
                      className="flex items-center gap-1.5"
                    >
                      {copiedTestPrompt ? <Check className="size-3" /> : <Clipboard className="size-3" />}
                      {copiedTestPrompt ? "Copiado" : "Copiar prueba para ChatGPT"}
                    </motion.span>
                  </AnimatePresence>
                </Button>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5">
                <p className="font-mono text-[11px] leading-relaxed text-foreground/80 whitespace-pre-wrap">{TEST_PROMPT}</p>
              </div>
            </div>

            {/* Resultado esperado */}
            <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-3 space-y-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Qué debería pasar</p>
              <ol className="space-y-1.5">
                {EXPECTED_RESULT.map((step, i) => (
                  <li key={i} className="flex gap-2.5 text-xs">
                    <span className="shrink-0 size-4 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-muted-foreground leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Verificación final */}
            <p className="text-[11px] text-muted-foreground bg-success/5 border border-success/20 rounded-lg px-3 py-2.5 leading-relaxed">
              Después de aprobar la creación, volvé a Worklog Hub y verificá que el pendiente aparezca en <strong>Backlog Vivo → Detectados</strong>.
            </p>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}

const PROJECT_INSTRUCTIONS = `Cuando trabajemos sobre este proyecto, actuá también como detector de pendientes conversacionales.

Cada vez que durante la conversación aparezca algo que:
- queda sin cerrar,
- se pospone,
- se menciona como bug, deuda técnica o mejora futura,
- se implementa pero no queda probado,
- queda ambiguo,
- requiere validación posterior,
- o podría olvidarse al avanzar con otro tema,

debes evaluar si corresponde registrarlo en Worklog Hub.

Antes de proponer crear un nuevo pendiente:
1. Consultá Worklog Hub para verificar si ya existe uno equivalente o muy similar.
2. Si ya existe y sigue abierto, avisá que ese pendiente ya está registrado.
3. Si existe pero está marcado como verificado o descartado, avisá que podría tratarse de una regresión, un caso distinto o algo ya resuelto.
4. Si no existe, proponé crear un nuevo pendiente en Worklog Hub.

No crees pendientes sin confirmación explícita del usuario.

Cuando propongas uno nuevo, resumilo con:
- título,
- tipo,
- módulo o área,
- por qué surgió,
- por qué importa,
- próximo paso sugerido.

Si el usuario confirma, usá la herramienta de Worklog Hub para registrarlo.

Worklog Hub es la fuente de verdad del estado de los pendientes. No dependas solo de memoria interna para saber si algo sigue abierto, fue descartado o ya se verificó.`;

const TEST_PROMPT = `Estoy probando la integración de Worklog Hub. Durante esta conversación, detectá si este asunto debe registrarse como pendiente y proponeme cargarlo si corresponde:

"Revisar que la pantalla de configuración de integraciones muestre un error claro cuando ngrok no logra iniciar correctamente".`;

const WHERE_TO_PLACE_STEPS = [
  "Abrí tu <strong>Project</strong> en ChatGPT.",
  "Hacé clic en el menú de <strong>tres puntos</strong> del Project.",
  'Entrá a <strong>Project settings</strong>.',
  'Pegá el texto completo en el campo <strong>Project Instructions</strong>.',
  "Guardá. Listo — aplica a todos los chats de ese Project.",
];

const PRE_TEST_CHECKLIST = [
  "Worklog Hub está abierto.",
  "El MCP local aparece como activo en Estado de la conexión.",
  "El túnel ngrok aparece como activo.",
  "El conector de Worklog Hub ya fue creado en ChatGPT (Developer Mode).",
  "En el chat de ChatGPT seleccionaste la app Worklog Hub desde el menú de herramientas.",
  "Las Project Instructions ya fueron pegadas en el Project.",
];

const EXPECTED_RESULT = [
  "ChatGPT detecta que el asunto parece un pendiente.",
  "Antes de crear nada, te propone registrarlo en Worklog Hub.",
  'Respondés "sí".',
  "ChatGPT solicita confirmación de la acción de escritura si corresponde.",
  'El ítem aparece en Backlog Vivo → Detectados con source=CHATGPT.',
];

const STEPS = [
  {
    n: 1,
    title: "Instalá ngrok",
    desc: 'Descargá e instalá ngrok gratis desde <a href="https://ngrok.com/download" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline inline-flex items-center gap-0.5 font-medium">ngrok.com/download</a>. Creá una cuenta gratuita si todavía no tenés.',
  },
  {
    n: 2,
    title: "Copiá tu Authtoken",
    desc: 'En el dashboard de ngrok → <strong>Getting Started → Your Authtoken</strong>. Copiá el token y pegalo en el campo de arriba.',
  },
  {
    n: 3,
    title: "Copiá tu Dominio estático",
    desc: 'En ngrok → <strong>Cloud Edge → Domains</strong>. Si no tenés ninguno, creá uno gratis (un dominio por cuenta en el plan gratuito). Copiá el dominio y pegalo arriba.',
    code: "algo-random.ngrok-free.app",
  },
  {
    n: 4,
    title: "Guardá y activá el túnel",
    desc: 'Completá los dos campos y hacé clic en <strong>"Guardar y activar túnel"</strong>. Cuando el estado muestre "Activo", copiá la URL MCP.',
  },
  {
    n: 5,
    title: "Configurá el conector en ChatGPT",
    desc: 'En ChatGPT → <strong>Settings → Apps &amp; Connectors → Advanced settings → Developer mode → Create connector</strong>. Pegá la URL MCP pública. Solo necesitás hacerlo una vez.',
  },
];

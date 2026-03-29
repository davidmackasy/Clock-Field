import { useState, useRef, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

export interface SigCapture {
  signatureType: "drawn" | "typed";
  signatureDataUrl: string | null;
}

interface Props {
  name: string;
  onChangeName: (n: string) => void;
  onChange: (v: SigCapture) => void;
  nameLabel?: string;
  namePlaceholder?: string;
}

export function ReportSignaturePad({ name, onChangeName, onChange, nameLabel = "Full Name", namePlaceholder = "Type your full name to sign..." }: Props) {
  const [mode, setMode] = useState<"draw" | "type">("draw");
  const [drawnUrl, setDrawnUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const hasStrokes = useRef(false);
  const initialized = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || initialized.current) return;
    initialized.current = true;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    function getPos(e: PointerEvent) {
      const r = canvas!.getBoundingClientRect();
      const scaleX = canvas!.width / r.width / dpr;
      const scaleY = canvas!.height / r.height / dpr;
      return { x: (e.clientX - r.left) * scaleX, y: (e.clientY - r.top) * scaleY };
    }

    function start(e: PointerEvent) {
      canvas!.setPointerCapture(e.pointerId);
      drawing.current = true;
      const pos = getPos(e);
      lastPos.current = pos;
      const c = canvas!.getContext("2d")!;
      c.beginPath();
      c.arc(pos.x, pos.y, 1, 0, Math.PI * 2);
      c.fillStyle = "#1e293b";
      c.fill();
    }
    function move(e: PointerEvent) {
      if (!drawing.current) return;
      e.preventDefault();
      const pos = getPos(e);
      const c = canvas!.getContext("2d")!;
      c.beginPath();
      if (lastPos.current) c.moveTo(lastPos.current.x, lastPos.current.y);
      c.lineTo(pos.x, pos.y);
      c.stroke();
      lastPos.current = pos;
      hasStrokes.current = true;
    }
    function stop() {
      if (!drawing.current) return;
      drawing.current = false;
      lastPos.current = null;
      if (hasStrokes.current) {
        const url = canvas!.toDataURL("image/png");
        setDrawnUrl(url);
        onChange({ signatureType: "drawn", signatureDataUrl: url });
      }
    }

    canvas.addEventListener("pointerdown", start, { passive: false });
    canvas.addEventListener("pointermove", move, { passive: false });
    canvas.addEventListener("pointerup", stop);
    canvas.addEventListener("pointercancel", stop);
    return () => {
      canvas.removeEventListener("pointerdown", start);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", stop);
      canvas.removeEventListener("pointercancel", stop);
    };
  }, []);

  function clearCanvas() {
    const canvas = canvasRef.current!;
    const dpr = window.devicePixelRatio || 1;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    hasStrokes.current = false;
    setDrawnUrl(null);
    onChange({ signatureType: "drawn", signatureDataUrl: null });
  }

  function handleModeChange(m: string) {
    const newMode = m as "draw" | "type";
    setMode(newMode);
    onChange({
      signatureType: newMode === "type" ? "typed" : "drawn",
      signatureDataUrl: newMode === "type" ? null : drawnUrl,
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">{nameLabel}</label>
        <Input
          value={name}
          onChange={e => onChangeName(e.target.value)}
          placeholder={namePlaceholder}
          data-testid="input-signer-name"
          className="text-sm"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Signature</label>
        <Tabs value={mode} onValueChange={handleModeChange}>
          <TabsList className="h-8 mb-2">
            <TabsTrigger value="draw" className="text-xs px-4" data-testid="tab-draw-signature">Draw</TabsTrigger>
            <TabsTrigger value="type" className="text-xs px-4" data-testid="tab-type-signature">Type</TabsTrigger>
          </TabsList>
          <TabsContent value="draw">
            <div
              className="relative rounded-md border-2 border-dashed border-muted bg-muted/30 touch-none overflow-hidden"
              style={{ height: 110 }}
            >
              <canvas
                ref={canvasRef}
                className="w-full h-full cursor-crosshair"
                style={{ touchAction: "none", display: "block" }}
                data-testid="canvas-signature-draw"
              />
              <p className="absolute inset-x-0 bottom-1 text-center text-[10px] text-muted-foreground pointer-events-none select-none">
                Draw your signature above
              </p>
            </div>
            <Button variant="ghost" size="sm" type="button" onClick={clearCanvas} className="text-xs mt-1 h-7 px-2">
              <RotateCcw className="w-3 h-3 mr-1" />Clear
            </Button>
          </TabsContent>
          <TabsContent value="type">
            {name.trim() ? (
              <div className="rounded-md border bg-muted/20 px-4 py-3">
                <p className="text-[10px] text-muted-foreground mb-1">Signature preview</p>
                <p
                  className="text-3xl text-foreground leading-tight"
                  style={{ fontFamily: "'Dancing Script', cursive", fontWeight: 600 }}
                  data-testid="text-typed-signature-preview"
                >
                  {name}
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mt-2 px-1">
                Enter your full name above to see your typed signature preview.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

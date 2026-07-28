import { useState, useRef, useEffect } from "react";
import {
  useListStudents,
  useSimulateScan,
  useGetFaceIdRegisterOptions,
  useCompleteFaceIdRegister,
  useCompleteFaceIdAuth,
  getListAttendanceQueryKey,
  getGetAttendanceStatsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  ScanFace,
  ShieldCheck,
  KeyRound,
  Camera,
  CameraOff,
  Video,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { formatTime } from "@/lib/utils";
import {
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";

// ── Face ID Biometric Scanner ────────────────────────────────────────────────

type FaceState = "idle" | "working" | "success" | "warning" | "error";

function FaceIdSection() {
  const [selectedStudent, setSelectedStudent] = useState<string>("");
  const [faceState, setFaceState] = useState<FaceState>("idle");
  const [lastResult, setLastResult] = useState<any>(null);
  const [mode, setMode] = useState<"scan" | "register">("scan");
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const { data: students } = useListStudents();
  const regOptionsMutation  = useGetFaceIdRegisterOptions();
  const regCompleteMutation = useCompleteFaceIdRegister();
  const authMutation        = useCompleteFaceIdAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const reset = (delay = 3500) => setTimeout(() => { setFaceState("idle"); setLastResult(null); }, delay);

  const toggleCamera = async () => {
    if (isCameraActive) {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
      setIsCameraActive(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        mediaStreamRef.current = stream;
        setIsCameraActive(true);
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        }, 100);
      } catch (err: any) {
        toast({
          title: "Camera Access Failed",
          description: "Could not access webcam feed. You can still use standard Face ID scan.",
          variant: "destructive",
        });
      }
    }
  };

  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // ── SCAN (authenticate) ──────────────────────────────────────────────────
  const handleFaceIdScan = async () => {
    setFaceState("working");
    setLastResult(null);
    try {
      // 1. Get auth options (challenge + allowed credentials list)
      const optionsRes = await fetch(
        `${import.meta.env.BASE_URL}api/webauthn/auth-options`,
        { credentials: "include" }
      );
      if (!optionsRes.ok) throw new Error("Could not fetch authentication options.");
      const options = (await optionsRes.json()) as PublicKeyCredentialRequestOptionsJSON;

      // 2. Invoke the platform authenticator (Face ID / Touch ID)
      const credential = await startAuthentication({ optionsJSON: options });

      // 3. Verify + record attendance
      authMutation.mutate({ data: { credential: credential as any } }, {
        onSuccess: (data) => {
          queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetAttendanceStatsQueryKey() });
          if ("message" in data && (data.message as string).toLowerCase().includes("already")) {
            setFaceState("warning");
            setLastResult({ type: "already-scanned", record: data.record });
          } else {
            setFaceState("success");
            setLastResult({ type: "new-scan", record: data });
          }
          reset();
        },
        onError: (err: any) => {
          setFaceState("error");
          toast({ title: "Face ID Failed", description: err.error || "Authentication failed.", variant: "destructive" });
          reset(2000);
        },
      });
    } catch (e: any) {
      setFaceState("error");
      const msg = e?.message ?? "Face ID was cancelled or is unavailable.";
      toast({ title: "Face ID Error", description: msg, variant: "destructive" });
      reset(2000);
    }
  };

  // ── REGISTER ─────────────────────────────────────────────────────────────
  const handleRegister = async () => {
    if (!selectedStudent) {
      toast({ title: "Select a student", description: "Choose the student to link this device to.", variant: "destructive" });
      return;
    }
    setFaceState("working");
    setLastResult(null);
    try {
      // 1. Get registration options
      regOptionsMutation.mutate(
        { data: { studentId: parseInt(selectedStudent) } },
        {
          onSuccess: async (options) => {
            try {
              // 2. Invoke platform authenticator
              const credential = await startRegistration({ optionsJSON: options as unknown as PublicKeyCredentialCreationOptionsJSON });

              // 3. Complete registration
              regCompleteMutation.mutate(
                { data: { studentId: parseInt(selectedStudent), credential: credential as any } },
                {
                  onSuccess: () => {
                    setFaceState("success");
                    setLastResult({ type: "registered" });
                    reset();
                  },
                  onError: (err: any) => {
                    setFaceState("error");
                    toast({ title: "Registration Failed", description: err.error || "Could not save Face ID.", variant: "destructive" });
                    reset(2000);
                  },
                }
              );
            } catch (e: any) {
              setFaceState("error");
              toast({ title: "Face ID Error", description: e?.message ?? "Registration cancelled.", variant: "destructive" });
              reset(2000);
            }
          },
          onError: (err: any) => {
            setFaceState("error");
            toast({ title: "Registration Failed", description: err.error || "Could not get options.", variant: "destructive" });
            reset(2000);
          },
        }
      );
    } catch (e: any) {
      setFaceState("error");
      toast({ title: "Face ID Error", description: e?.message ?? "Unexpected error.", variant: "destructive" });
      reset(2000);
    }
  };

  const faceIcon = () => {
    if (faceState === "success")  return <ShieldCheck className="w-20 h-20" />;
    if (faceState === "warning")  return <AlertCircle className="w-20 h-20" />;
    if (faceState === "error")    return <XCircle className="w-20 h-20" />;
    if (mode === "register")      return <KeyRound className={`w-20 h-20 ${faceState === "working" ? "animate-pulse" : ""}`} />;
    return <ScanFace className={`w-20 h-20 ${faceState === "working" ? "animate-pulse" : ""}`} />;
  };

  const faceRing: Record<FaceState, string> = {
    working: "text-primary ring-primary/50 shadow-[0_0_40px_-10px_var(--color-primary)]",
    success: "text-success ring-success/50 shadow-[0_0_40px_-10px_var(--color-success)] bg-success/10",
    warning: "text-warning ring-warning/50 shadow-[0_0_40px_-10px_var(--color-warning)] bg-warning/10",
    error:   "text-destructive ring-destructive/50 shadow-[0_0_40px_-10px_var(--color-destructive)] bg-destructive/10",
    idle:    "text-muted-foreground ring-border hover:text-primary hover:ring-primary/30 bg-card",
  };

  const canScan     = faceState === "idle" && mode === "scan";
  const canRegister = faceState === "idle" && mode === "register" && !!selectedStudent;

  return (
    <Card className="border-2 shadow-lg overflow-hidden relative">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ScanFace className="w-5 h-5 text-muted-foreground" />
            <CardTitle className="text-base">Face ID / Biometric Terminal</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleCamera}
              className="gap-1.5 text-xs h-8"
            >
              {isCameraActive ? <CameraOff className="w-3.5 h-3.5 text-destructive" /> : <Camera className="w-3.5 h-3.5 text-primary" />}
              {isCameraActive ? "Stop Camera" : "Live Camera HUD"}
            </Button>
            <Badge variant="secondary" className="text-xs">WebAuthn</Badge>
          </div>
        </div>
        <CardDescription>Authenticate via device Face ID sensor with real-time video stream</CardDescription>
      </CardHeader>

      {faceState === "working" && (
        <div className="absolute top-0 left-0 w-full h-1 bg-primary/20">
          <div className="h-full bg-primary animate-pulse w-1/3" />
        </div>
      )}

      <CardContent className="p-4 sm:p-8 flex flex-col items-center space-y-4 sm:space-y-6">

        {/* Live Camera Viewport */}
        {isCameraActive && (
          <div className="relative w-full max-w-md aspect-video rounded-xl overflow-hidden border-2 border-primary/40 bg-black shadow-inner flex items-center justify-center mb-2">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
            
            {/* Biometric HUD Target Overlay */}
            <div className="absolute inset-0 border-2 border-primary/20 pointer-events-none flex items-center justify-center">
              <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-primary" />
              <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-primary" />
              <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-primary" />
              <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-primary" />
              
              <div className={`w-28 h-28 sm:w-36 sm:h-36 rounded-full border-2 border-dashed ${faceState === "working" ? "border-primary animate-spin" : "border-primary/60 animate-pulse"} flex items-center justify-center`}>
                <ScanFace className="w-10 h-10 sm:w-12 sm:h-12 text-primary/80" />
              </div>
            </div>

            <div className="absolute bottom-2 inset-x-2 bg-black/60 backdrop-blur-md rounded-md p-2 flex items-center justify-between text-white text-xs">
              <span className="flex items-center gap-1.5 text-success font-medium">
                <span className="w-2 h-2 rounded-full bg-success animate-ping" />
                LIVE STREAM
              </span>
              <span className="font-mono text-[10px] text-muted-foreground uppercase">HUD TARGETING ACTIVE</span>
            </div>
          </div>
        )}

        {/* Mode tabs */}
        <div className="flex rounded-lg border overflow-hidden w-full max-w-sm">
          <button
            onClick={() => setMode("scan")}
            disabled={faceState !== "idle"}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              mode === "scan" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"
            }`}
          >
            Scan In
          </button>
          <button
            onClick={() => setMode("register")}
            disabled={faceState !== "idle"}
            className={`flex-1 py-2 text-sm font-medium transition-colors border-l ${
              mode === "register" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"
            }`}
          >
            Register Device
          </button>
        </div>

        {/* Student picker — only needed for register */}
        {mode === "register" && (
          <div className="w-full max-w-sm space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block text-center">
              Link device to student
            </label>
            <Select value={selectedStudent} onValueChange={setSelectedStudent} disabled={faceState !== "idle"}>
              <SelectTrigger className="h-12 text-base">
                <SelectValue placeholder="Select student…" />
              </SelectTrigger>
              <SelectContent>
                {students?.map(s => (
                  <SelectItem key={s.id} value={s.id.toString()}>
                    {s.name} <span className="text-muted-foreground ml-2">({s.className})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Big biometric button */}
        <button
          onClick={mode === "scan" ? handleFaceIdScan : handleRegister}
          disabled={mode === "scan" ? !canScan : !canRegister}
          className={`
            relative group rounded-full p-6 sm:p-10 transition-all duration-500 ease-out
            ring-4 ring-offset-8 ring-offset-background outline-none
            ${faceRing[faceState]}
            ${(canScan || canRegister) ? "cursor-pointer active:scale-95" : "opacity-40 cursor-not-allowed"}
          `}
        >
          <div className="relative z-10 transition-transform duration-500 group-hover:scale-105">
            {faceIcon()}
          </div>
        </button>

        {/* Hint text */}
        {faceState === "idle" && (
          <p className="text-xs text-muted-foreground text-center max-w-xs leading-relaxed">
            {mode === "scan"
              ? "Tap to authenticate with your device's biometric sensor. Your device must have a registered credential."
              : "Tap to enroll your device's biometric for the selected student. They can then scan in without selecting a name."}
          </p>
        )}

        {/* Status / result */}
        <div className="h-16 w-full flex items-center justify-center">
          {faceState === "working" && (
            <p className="text-base font-medium text-primary animate-pulse tracking-widest uppercase">
              {mode === "scan" ? "Verifying…" : "Registering…"}
            </p>
          )}
          {lastResult && faceState !== "working" && (
            <div className="text-center animate-in fade-in slide-in-from-bottom-2">
              {lastResult.type === "registered" && (
                <div className="space-y-0.5">
                  <p className="text-base font-bold text-success">Device Registered!</p>
                  <p className="text-sm text-muted-foreground">This device can now scan in directly.</p>
                </div>
              )}
              {lastResult.type === "already-scanned" && (
                <div className="space-y-0.5">
                  <p className="text-base font-bold text-warning">Already Scanned Today</p>
                  <p className="text-sm text-muted-foreground font-mono">Recorded at {formatTime(lastResult.record.timestamp)}</p>
                </div>
              )}
              {lastResult.type === "new-scan" && (
                <div className="space-y-0.5">
                  <p className="text-base font-bold text-success">Attendance Recorded</p>
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <span className="font-medium">{lastResult.record.studentName}</span>
                    <span className="text-muted-foreground border-l pl-2 font-mono">{formatTime(lastResult.record.timestamp)}</span>
                    <span className={`border-l pl-2 uppercase text-[10px] font-bold tracking-wider ${lastResult.record.status === "on-time" ? "text-success" : "text-warning"}`}>
                      {lastResult.record.status.replace("-", " ")}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ScanSimulator() {
  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pt-4">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Face ID Attendance Terminal</h1>
        <p className="text-muted-foreground">Scan your face to mark daily attendance instantly</p>
      </div>

      <FaceIdSection />
    </div>
  );
}

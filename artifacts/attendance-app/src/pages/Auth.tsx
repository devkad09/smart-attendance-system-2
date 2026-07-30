import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScanFace, Lock, Mail, User, Building2, Eye, EyeOff, ShieldCheck, KeyRound } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

const DEPARTMENTS = [
  "Computer Science",
  "Electrical Engineering",
  "Information Technology",
  "Mathematics & Statistics",
  "Business & Information Systems",
  "Mechanical Engineering",
];

export default function AuthPage() {
  const { login, signup } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Login Form
  const [loginEmail, setLoginEmail] = useState("lecturer@university.edu");
  const [loginPassword, setLoginPassword] = useState("password123");

  // Signup Form
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupDepartment, setSignupDepartment] = useState("Computer Science");
  const [signupPassword, setSignupPassword] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login({ email: loginEmail, password: loginPassword });
      toast({
        title: "Welcome back!",
        description: "Authenticated successfully as Lecturer.",
      });
      setLocation("/");
    } catch (err: any) {
      toast({
        title: "Login Failed",
        description: err.message || "Invalid credentials",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await signup({
        name: signupName,
        email: signupEmail,
        department: signupDepartment,
        password: signupPassword,
      });
      toast({
        title: "Account Created! 🎉",
        description: "Your Lecturer account is ready.",
      });
      setLocation("/");
    } catch (err: any) {
      toast({
        title: "Sign Up Failed",
        description: err.message || "Could not register account",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-background via-sidebar/30 to-background p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-md space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-primary/10 text-primary mb-2 shadow-inner">
            <ScanFace className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">SmartAccess</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Attendance & Biometric Management for Academic Staff
          </p>
          <div className="flex items-center justify-center gap-1.5 pt-1">
            <Badge variant="outline" className="text-[11px] gap-1 px-2.5 py-0.5 border-primary/30">
              <ShieldCheck className="w-3 h-3 text-primary" />
              Lecturer Portal Only
            </Badge>
          </div>
        </div>

        {/* Tabbed Auth Card */}
        <Card className="border-border/60 shadow-xl backdrop-blur-xs bg-card/95">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
            <CardHeader className="pb-3 border-b border-border/40">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login" className="font-semibold text-xs sm:text-sm">
                  Lecturer Sign In
                </TabsTrigger>
                <TabsTrigger value="signup" className="font-semibold text-xs sm:text-sm">
                  Create Account
                </TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent className="pt-6">
              {/* LOGIN TAB */}
              <TabsContent value="login" className="mt-0">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="login-email">Lecturer Email</Label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="lecturer@university.edu"
                        className="pl-9"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="login-password">Password</Label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                      <Input
                        id="login-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        className="pl-9 pr-9"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <Button type="submit" className="w-full gap-2 font-semibold" disabled={isLoading}>
                    <KeyRound className="w-4 h-4" />
                    {isLoading ? "Signing In..." : "Sign In to Control Room"}
                  </Button>

                  <div className="pt-2 text-center text-xs text-muted-foreground">
                    Demo credentials: <span className="font-mono text-foreground">lecturer@university.edu</span> / <span className="font-mono text-foreground">password123</span>
                  </div>
                </form>
              </TabsContent>

              {/* SIGNUP TAB */}
              <TabsContent value="signup" className="mt-0">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-name">Full Name & Title</Label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                      <Input
                        id="signup-name"
                        placeholder="Dr. Sarah Jenkins"
                        className="pl-9"
                        value={signupName}
                        onChange={(e) => setSignupName(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="signup-email">Institutional Email</Label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="s.jenkins@university.edu"
                        className="pl-9"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="signup-dept">Academic Department</Label>
                    <div className="relative">
                      <Building2 className="w-4 h-4 absolute left-3 top-3 text-muted-foreground z-10" />
                      <Select value={signupDepartment} onValueChange={setSignupDepartment}>
                        <SelectTrigger className="pl-9">
                          <SelectValue placeholder="Select Department" />
                        </SelectTrigger>
                        <SelectContent>
                          {DEPARTMENTS.map((dept) => (
                            <SelectItem key={dept} value={dept}>
                              {dept}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="signup-password">Create Password</Label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                      <Input
                        id="signup-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Min 6 characters"
                        className="pl-9 pr-9"
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <Button type="submit" className="w-full gap-2 font-semibold" disabled={isLoading}>
                    <ShieldCheck className="w-4 h-4" />
                    {isLoading ? "Creating Account..." : "Register Lecturer Account"}
                  </Button>
                </form>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}

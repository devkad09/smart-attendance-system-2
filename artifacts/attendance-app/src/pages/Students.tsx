import { useState, useMemo } from "react";
import { 
  useListStudents, 
  useEnrollStudent, 
  useDeleteStudent, 
  useGetStudent, 
  getListStudentsQueryKey,
  useGetFaceIdRegisterOptions,
  useCompleteFaceIdRegister
} from "@workspace/api-client-react";
import { startRegistration, type PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/browser";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Search, UserPlus, Trash2, Shield, Eye, Calendar, User, LayoutGrid, ScanFace, CheckCircle2, KeyRound } from "lucide-react";
import { format } from "date-fns";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const formSchema = z.object({
  studentId: z.string().min(1, "Student ID is required"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  className: z.string().min(1, "Class is required"),
});

function StudentDetailsDialog({ studentId, open, onOpenChange }: { studentId: number | null, open: boolean, onOpenChange: (o: boolean) => void }) {
  const { data: student, isLoading } = useGetStudent(studentId || 0, { query: { enabled: !!studentId } } as any);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Student Profile</DialogTitle>
          <DialogDescription>Detailed view of the student's enrollment record.</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {isLoading || !student ? (
            <div className="flex justify-center p-8"><Shield className="w-8 h-8 opacity-20 animate-pulse" /></div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                  <User className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">{student.name}</h3>
                  <Badge variant="outline" className="mt-1 font-mono text-xs">{student.studentId}</Badge>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1 p-3 bg-muted/30 rounded-md border border-border/50">
                  <span className="text-xs text-muted-foreground flex items-center gap-1"><LayoutGrid className="w-3 h-3"/> Class</span>
                  <span className="font-medium">{student.className}</span>
                </div>
                <div className="flex flex-col gap-1 p-3 bg-muted/30 rounded-md border border-border/50">
                  <span className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3"/> Enrolled</span>
                  <span className="font-medium">{format(new Date(student.enrolledAt), 'MMM d, yyyy')}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Students() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isEnrollOpen, setIsEnrollOpen] = useState(false);
  const [isScanningFace, setIsScanningFace] = useState(false);
  const [viewStudentId, setViewStudentId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canUseWebAuthn = typeof window !== "undefined" && window.isSecureContext && "PublicKeyCredential" in window;

  const { data: students, isLoading } = useListStudents();
  const enrollMutation = useEnrollStudent();
  const deleteMutation = useDeleteStudent();
  const regOptionsMutation = useGetFaceIdRegisterOptions();
  const regCompleteMutation = useCompleteFaceIdRegister();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema as any),
    defaultValues: {
      studentId: "",
      name: "",
      className: "",
    },
  });

  const filteredStudents = useMemo(() => {
    if (!Array.isArray(students)) return [];
    const query = searchQuery.toLowerCase();
    return students.filter(
      (s) => 
        s.name.toLowerCase().includes(query) || 
        s.studentId.toLowerCase().includes(query) ||
        s.className.toLowerCase().includes(query)
    );
  }, [students, searchQuery]);

  const registerFaceIdForStudent = async (studentId: number, studentName: string, closeDialog = false) => {
    setIsScanningFace(true);
    regOptionsMutation.mutate(
      { data: { studentId } },
      {
        onSuccess: async (options) => {
          try {
            const credential = await startRegistration({
              optionsJSON: options as unknown as PublicKeyCredentialCreationOptionsJSON,
            });
            regCompleteMutation.mutate(
              { data: { studentId, credential: credential as any } },
              {
                onSuccess: () => {
                  setIsScanningFace(false);
                  toast({
                    title: "Face ID Registered! 🎉",
                    description: `Face ID passkey successfully paired to ${studentName}.`,
                  });
                  queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() });
                  if (closeDialog) {
                    setIsEnrollOpen(false);
                    form.reset();
                  }
                },
                onError: (err: any) => {
                  setIsScanningFace(false);
                  toast({
                    title: "Face ID Registration Failed",
                    description: err?.error || "Could not save Face ID credential.",
                    variant: "destructive",
                  });
                  if (closeDialog) {
                    setIsEnrollOpen(false);
                    form.reset();
                  }
                },
              }
            );
          } catch (e: any) {
            setIsScanningFace(false);
            toast({
              title: "Face ID Scan Cancelled",
              description: e?.message || "Biometric prompt was cancelled.",
            });
            if (closeDialog) {
              setIsEnrollOpen(false);
              form.reset();
            }
          }
        },
        onError: (err: any) => {
          setIsScanningFace(false);
          const msg = typeof err?.error === "string" ? err.error : typeof err?.message === "string" ? err.message : err?.error?.error || "Could not fetch WebAuthn registration options.";
          toast({
            title: "Registration Failed",
            description: msg,
            variant: "destructive",
          });
          if (closeDialog) {
            setIsEnrollOpen(false);
            form.reset();
          }
        },
      }
    );
  };

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    enrollMutation.mutate({ data: values }, {
      onSuccess: (newStudent) => {
        queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() });
        setIsEnrollOpen(false);
        form.reset();
        toast({
          title: "Student Enrolled! 🎉",
          description: `${values.name} (${values.studentId}) was enrolled successfully.`,
        });
        if (canUseWebAuthn) {
          registerFaceIdForStudent(newStudent.id, newStudent.name, false);
        }
      },
      onError: (error: any) => {
        toast({
          title: "Enrollment Failed",
          description: error?.response?.data?.error || error?.error || error?.message || "An unknown error occurred.",
          variant: "destructive",
        });
      }
    });
  };

  const handleDelete = (id: number, name: string) => {
    if (confirm(`Are you sure you want to remove ${name}?`)) {
      deleteMutation.mutate({ id }, {
        onSuccess: () => {
          toast({
            title: "Student Removed",
            description: `${name} has been removed from the system.`,
          });
          queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() });
        }
      });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Student Directory</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Manage enrolled students and credentials</p>
        </div>
        
        <Dialog open={isEnrollOpen} onOpenChange={setIsEnrollOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 self-start sm:self-auto">
              <UserPlus className="w-4 h-4" />
              Enroll Student
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle>Enroll New Student</DialogTitle>
              <DialogDescription>
                Register a new student credential in the system.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                <FormField
                  control={form.control}
                  name="studentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Student ID</FormLabel>
                      <FormControl>
                        <Input placeholder="STU-001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Alex Johnson" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="className"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Class Assignment</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 10-A" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end pt-4 gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsEnrollOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={enrollMutation.isPending || isScanningFace} className="gap-2">
                    <ScanFace className="w-4 h-4" />
                    {enrollMutation.isPending ? "Saving..." : isScanningFace ? "Scanning Face ID..." : canUseWebAuthn ? "Save & Register Face ID" : "Save Student"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <StudentDetailsDialog 
        studentId={viewStudentId} 
        open={!!viewStudentId} 
        onOpenChange={(open) => !open && setViewStudentId(null)} 
      />

      <Card>
        <CardHeader className="pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search by name, ID, or class..." 
              className="pl-9 max-w-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-[120px]">Student ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Enrolled Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    Loading directory...
                  </TableCell>
                </TableRow>
              ) : filteredStudents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center">
                      <Shield className="w-8 h-8 mb-2 opacity-20" />
                      <p>No students found matching your search.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredStudents.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell className="font-mono text-xs font-medium text-muted-foreground">
                      {student.studentId}
                    </TableCell>
                    <TableCell className="font-medium">
                      {student.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono text-[10px] tracking-widest">
                        {student.className}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(student.enrolledAt), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => registerFaceIdForStudent(student.id, student.name)}
                          disabled={isScanningFace}
                          className="gap-1 text-xs h-8 text-primary border-primary/30 hover:bg-primary/10"
                          title="Register Face ID for this student"
                        >
                          <ScanFace className="w-3.5 h-3.5" />
                          Register Face ID
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => setViewStudentId(student.id)}
                          className="text-muted-foreground hover:text-foreground"
                          title="View student profile"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDelete(student.id, student.name)}
                          disabled={deleteMutation.isPending}
                          className="text-muted-foreground hover:text-destructive"
                          title="Delete student"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

import { useMemo } from "react";
import { 
  useGetAttendanceStats, 
  useListAttendance, 
  useGetWeeklyAttendance, 
  useGetAttendanceByClass 
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, UserCheck, UserX, Clock, AlertCircle } from "lucide-react";
import { formatTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts";

export default function Dashboard() {
  const queryOptions = { query: { refetchInterval: 10000 } } as any;
  
  const { data: stats } = useGetAttendanceStats({}, queryOptions);
  const { data: logs } = useListAttendance({}, queryOptions);
  const { data: weekly } = useGetWeeklyAttendance(queryOptions);
  const { data: classStats } = useGetAttendanceByClass({}, queryOptions);

  const tardyWatchlist = useMemo(() => {
    if (!Array.isArray(logs)) return [];
    const counts = new Map<number, { name: string; className: string; lateCount: number }>();
    logs.forEach((log) => {
      if (log.status === "late") {
        const existing = counts.get(log.studentId) || { name: log.studentName, className: log.className, lateCount: 0 };
        existing.lateCount += 1;
        counts.set(log.studentId, existing);
      }
    });
    return Array.from(counts.values()).sort((a, b) => b.lateCount - a.lateCount).slice(0, 5);
  }, [logs]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Today's Overview</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Live metrics auto-updating every 10 seconds</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-success"></span>
          </span>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Live</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <StatCard title="Total Enrolled" value={stats?.totalStudents ?? 0} icon={Users} color="text-primary" />
        <StatCard title="Present" value={stats?.present ?? 0} icon={UserCheck} color="text-success" />
        <StatCard title="Absent" value={stats?.absent ?? 0} icon={UserX} color="text-destructive" />
        <StatCard title="On Time" value={stats?.onTime ?? 0} icon={Clock} color="text-success" />
        <StatCard title="Late" value={stats?.late ?? 0} icon={AlertCircle} color="text-warning" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Charts */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Weekly Trend</CardTitle>
              <CardDescription>Attendance over the last 7 days</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={Array.isArray(weekly) ? weekly : []} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                      tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { weekday: 'short' })}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: "hsl(var(--card))", borderRadius: "8px", border: "1px solid hsl(var(--border))" }}
                      labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600, marginBottom: "4px" }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                    <Line type="monotone" name="Present" dataKey="present" stroke="hsl(var(--chart-2))" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    <Line type="monotone" name="Late" dataKey="late" stroke="hsl(var(--chart-4))" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Attendance by Class</CardTitle>
              <CardDescription>Present vs Absent breakdown for today</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={Array.isArray(classStats) ? classStats : []} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="className" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <Tooltip 
                      cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                      contentStyle={{ backgroundColor: "hsl(var(--card))", borderRadius: "8px", border: "1px solid hsl(var(--border))" }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="present" name="Present" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="absent" name="Absent" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Weekly Attendance Trend</CardTitle>
              <CardDescription>Daily present vs late check-in counts over the last 7 days</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={Array.isArray(weekly) ? weekly : []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="day" />
                    <YAxis allowDecimals={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} 
                    />
                    <Legend />
                    <Line type="monotone" dataKey="present" stroke="hsl(var(--success))" strokeWidth={2} name="Present" dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="late" stroke="hsl(var(--warning))" strokeWidth={2} name="Late" dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <Card className="flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Live Scan Log</CardTitle>
              <CardDescription>Real-time student arrival events</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 p-0">
              <div className="overflow-y-auto max-h-[360px]">
                <Table>
                  <TableHeader className="bg-muted/50 sticky top-0 backdrop-blur-sm z-10">
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.isArray(logs) && logs.length > 0 ? (
                      logs.slice(0, 10).map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            <div className="font-medium text-xs">{log.studentName}</div>
                            <div className="text-[10px] text-muted-foreground">{log.className}</div>
                          </TableCell>
                          <TableCell className="font-mono text-xs whitespace-nowrap">
                            {formatTime(log.timestamp)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={log.status === "on-time" ? "default" : "secondary"} className="uppercase text-[9px] px-1.5 py-0.5">
                              {log.status.replace('-', ' ')}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={3} className="h-24 text-center text-muted-foreground text-xs">
                          No scans recorded today
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Tardy Watchlist Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-warning" />
                <CardTitle className="text-base">Tardy Watchlist</CardTitle>
              </div>
              <CardDescription>Students with frequent late check-ins</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead className="text-right">Late Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tardyWatchlist.length > 0 ? (
                    tardyWatchlist.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <div className="font-medium text-xs">{item.name}</div>
                          <div className="text-[10px] text-muted-foreground">Class {item.className}</div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className="text-warning border-warning/40 font-mono text-xs">
                            {item.lateCount} late
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={2} className="h-20 text-center text-xs text-muted-foreground">
                        No tardiness flags recorded
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }: { title: string, value: number, icon: any, color: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex flex-col items-center justify-center text-center space-y-2">
        <div className={`p-3 rounded-full bg-muted/50 ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="text-3xl font-bold font-mono tracking-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

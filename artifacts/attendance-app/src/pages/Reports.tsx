import { useState, useMemo } from "react";
import { useListAttendance, useListStudents } from "@workspace/api-client-react";
import { format, isToday, subDays, startOfMonth, isAfter } from "date-fns";
import { 
  FileSpreadsheet, 
  Printer, 
  Search, 
  Filter, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  Users, 
  TrendingUp,
  Download
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

type DateRangeFilter = "today" | "week" | "month" | "all";

export default function Reports() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClass, setSelectedClass] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRangeFilter>("all");
  const { toast } = useToast();

  const { data: attendanceLogs, isLoading: isLogsLoading } = useListAttendance();
  const { data: students } = useListStudents();

  // Extract unique class names
  const availableClasses = useMemo(() => {
    if (!Array.isArray(students)) return [];
    const classes = new Set<string>();
    students.forEach((s) => classes.add(s.className));
    return Array.from(classes).sort();
  }, [students]);

  // Filtered attendance data
  const filteredLogs = useMemo(() => {
    if (!Array.isArray(attendanceLogs)) return [];

    const now = new Date();
    const query = searchQuery.toLowerCase();

    return attendanceLogs.filter((log) => {
      // 1. Search Query filter
      const matchesSearch = 
        log.studentName.toLowerCase().includes(query) ||
        log.studentId.toString().includes(query) ||
        log.className.toLowerCase().includes(query);

      if (!matchesSearch) return false;

      // 2. Class filter
      if (selectedClass !== "all" && log.className !== selectedClass) {
        return false;
      }

      // 3. Status filter
      if (selectedStatus !== "all" && log.status !== selectedStatus) {
        return false;
      }

      // 4. Date Range filter
      const logDate = new Date(log.timestamp);
      if (dateRange === "today") {
        if (!isToday(logDate)) return false;
      } else if (dateRange === "week") {
        const sevenDaysAgo = subDays(now, 7);
        if (!isAfter(logDate, sevenDaysAgo)) return false;
      } else if (dateRange === "month") {
        const firstOfMonth = startOfMonth(now);
        if (!isAfter(logDate, firstOfMonth)) return false;
      }

      return true;
    });
  }, [attendanceLogs, searchQuery, selectedClass, selectedStatus, dateRange]);

  // Metric Summaries
  const metrics = useMemo(() => {
    const total = filteredLogs.length;
    if (total === 0) {
      return { total: 0, onTime: 0, late: 0, onTimeRate: "0%", uniqueStudents: 0 };
    }
    const onTime = filteredLogs.filter((l) => l.status === "on-time").length;
    const late = filteredLogs.filter((l) => l.status === "late").length;
    const uniqueStudents = new Set(filteredLogs.map((l) => l.studentId)).size;
    const onTimeRate = `${Math.round((onTime / total) * 100)}%`;

    return { total, onTime, late, onTimeRate, uniqueStudents };
  }, [filteredLogs]);

  // CSV Export Handler
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      toast({
        title: "No Data to Export",
        description: "Adjust your filters to display records before exporting.",
        variant: "destructive",
      });
      return;
    }

    const headers = ["Record ID", "Student ID", "Student Name", "Class", "Date", "Time", "Status"];
    const rows = filteredLogs.map((log) => [
      log.id,
      log.studentId,
      `"${log.studentName}"`,
      `"${log.className}"`,
      log.date,
      format(new Date(log.timestamp), "hh:mm:ss a"),
      log.status.toUpperCase(),
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Attendance_Report_${format(new Date(), "yyyy-MM-dd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Report Exported",
      description: `Exported ${filteredLogs.length} attendance records to CSV.`,
    });
  };

  // Print Report Handler
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Attendance Reports</h1>
          <p className="text-muted-foreground text-sm">
            Filter, inspect, and export comprehensive school attendance logs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
            <Printer className="w-4 h-4" />
            Print Report
          </Button>
          <Button size="sm" onClick={handleExportCSV} className="gap-2">
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Analytics Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Scans</p>
              <h3 className="text-2xl font-bold mt-1">{metrics.total}</h3>
            </div>
            <div className="p-2.5 bg-primary/10 text-primary rounded-lg">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">On-Time Rate</p>
              <h3 className="text-2xl font-bold text-success mt-1">{metrics.onTimeRate}</h3>
            </div>
            <div className="p-2.5 bg-success/10 text-success rounded-lg">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Late Arrivals</p>
              <h3 className="text-2xl font-bold text-warning mt-1">{metrics.late}</h3>
            </div>
            <div className="p-2.5 bg-warning/10 text-warning rounded-lg">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Unique Students</p>
              <h3 className="text-2xl font-bold mt-1">{metrics.uniqueStudents}</h3>
            </div>
            <div className="p-2.5 bg-accent text-accent-foreground rounded-lg">
              <Users className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Controls Bar */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">Filter Logs</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search student or ID..."
                className="pl-9 text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Class Selector */}
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="All Classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {availableClasses.map((cls) => (
                  <SelectItem key={cls} value={cls}>
                    Class {cls}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status Selector */}
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="on-time">On Time Only</SelectItem>
                <SelectItem value="late">Late Only</SelectItem>
              </SelectContent>
            </Select>

            {/* Date Range Selector */}
            <Select value={dateRange} onValueChange={(val: DateRangeFilter) => setDateRange(val)}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">Last 7 Days</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Reports Table */}
      <Card className="border shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead>Student Name</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Check-In Time</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLogsLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    Loading attendance records...
                  </TableCell>
                </TableRow>
              ) : filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    No attendance records match your filters.
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">
                      <div>
                        <span>{log.studentName}</span>
                        <span className="block text-xs font-mono text-muted-foreground">ID: {log.studentId}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono text-[10px]">
                        {log.className}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.date}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {format(new Date(log.timestamp), "hh:mm:ss a")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={log.status === "on-time" ? "default" : "secondary"}
                        className={`capitalize text-xs font-semibold ${
                          log.status === "on-time" 
                            ? "bg-success/15 text-success hover:bg-success/20 border-success/30" 
                            : "bg-warning/15 text-warning hover:bg-warning/20 border-warning/30"
                        }`}
                      >
                        {log.status.replace("-", " ")}
                      </Badge>
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

import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Terminal, Clock, Activity } from "lucide-react";

interface SolverEngineProps {
  isRunning: boolean;
  progress: number;
  logs: { time: string; msg: string; type: 'info' | 'success' | 'warning' }[];
}

export default function SolverEngine({ isRunning, progress, logs }: SolverEngineProps) {
  return (
    <div className="space-y-6">
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50/50 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="text-blue-600" size={20} />
              <CardTitle className="text-lg">Solver Engine</CardTitle>
            </div>
            <Badge variant={isRunning ? "default" : (progress === 100 ? "outline" : "secondary")} className={isRunning ? "bg-blue-600" : ""}>
              {isRunning ? "Engine Running" : (progress === 100 ? "Finished" : "Idle")}
            </Badge>
          </div>
          <CardDescription>
            MILP-based optimization solver for invigilator assignment.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm font-medium">
              <span className="text-slate-500">Constraint Satisfaction Progress</span>
              <span className="text-blue-600">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2 bg-slate-100" />
            <div className="flex justify-between items-center text-xs text-slate-400">
              <div className="flex items-center gap-1">
                <Clock size={12} />
                <span>Estimated Remaining: {isRunning ? `${Math.max(0, 10 - Math.floor(progress/10))}s` : '0s'}</span>
              </div>
              <span>Status: {progress === 100 ? 'Optimal' : (isRunning ? 'Processing...' : 'Ready')}</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Terminal size={16} className="text-slate-400" />
              Solver Execution Log
            </div>
            <ScrollArea className="h-48 w-full rounded-md border bg-slate-950 p-4 font-mono text-xs">
              <div className="space-y-2">
                {logs.length === 0 ? (
                  <div className="text-slate-600 italic">Waiting for execution...</div>
                ) : (
                  logs.map((log, i) => (
                    <div key={i} className="flex gap-3">
                      <span className="text-slate-500 shrink-0">[{log.time}]</span>
                      <span className={
                        log.type === 'success' ? 'text-green-400' : 
                        log.type === 'warning' ? 'text-amber-400' : 
                        'text-slate-300'
                      }>
                        {log.msg}
                      </span>
                    </div>
                  ))
                )}
                {isRunning && (
                  <div className="flex gap-2 items-center text-blue-400">
                    <span className="animate-pulse">_</span>
                    <span className="text-[10px]">Processing matrix row {Math.floor(progress * 1.5)}...</span>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

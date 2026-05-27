import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Settings2, Save, Baby } from "lucide-react";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agePriority: boolean;
  setAgePriority: (val: boolean) => void;
  optimizationMode: 'fairness' | 'distance' | 'complexity';
  setOptimizationMode: (val: 'fairness' | 'distance' | 'complexity') => void;
  sameDayDiffFacilityWeight: number;
  setSameDayDiffFacilityWeight: (val: number) => void;
  distanceWeight: number;
  setDistanceWeight: (val: number) => void;
  fairnessScheduleWeight: number;
  setFairnessScheduleWeight: (val: number) => void;
  overlapWeight: number;
  setOverlapWeight: (val: number) => void;
}

export default function SettingsModal({
  open,
  onOpenChange,
  agePriority,
  setAgePriority,
  optimizationMode,
  setOptimizationMode,
  sameDayDiffFacilityWeight,
  setSameDayDiffFacilityWeight,
  distanceWeight,
  setDistanceWeight,
  fairnessScheduleWeight,
  setFairnessScheduleWeight,
  overlapWeight,
  setOverlapWeight,
}: SettingsModalProps) {

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
              <Settings2 size={18} className="text-slate-600" />
            </div>
            <DialogTitle className="text-xl">Solver Configuration</DialogTitle>
          </div>
          <DialogDescription>
            Adjust optimization priorities and solver thresholds for the next execution.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">Primary Objective</h4>
            <div className="space-y-2">
                <Label className="text-sm font-medium">Optimization Mode</Label>
                <select
                  value={optimizationMode}
                  onChange={(e) => setOptimizationMode(e.target.value as 'fairness' | 'distance' | 'complexity')}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  {/* <option value="fairness">Maximize Workload Fairness</option>
                  <option value="distance">Minimize Total Travel Distance</option> */}
                  <option value="complexity">Balanced Multi-Objective</option>
                </select>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">Special Constraints</h4>
              <button 
                onClick={() => setAgePriority(!agePriority)}
                className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold transition-all ${agePriority ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}
              >
                <Baby size={12} />
                Age priority {agePriority ? 'ON' : 'OFF'}
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="text-xs">Different facility daily</Label>
                    <Input
                      type="number"
                      value={sameDayDiffFacilityWeight}
                      onChange={(e) => setSameDayDiffFacilityWeight(Number(e.target.value))}
                      className="h-9"
                    />
                </div>
                <div className="space-y-2">
                    <Label className="text-xs">Distance weight</Label>
                    <Input
                      type="number"
                      value={distanceWeight}
                      onChange={(e) => setDistanceWeight(Number(e.target.value))}
                      className="h-9"
                    />
                </div>
                <div className="space-y-2">
                    <Label className="text-xs">Fairness schedule</Label>
                    <Input
                      type="number"
                      value={fairnessScheduleWeight}
                      onChange={(e) => setFairnessScheduleWeight(Number(e.target.value))}
                      className="h-9"
                    />
                </div>
                <div className="space-y-2">
                    <Label className="text-xs">Overlap Penalty</Label>
                    <Input
                      type="number"
                      value={overlapWeight}
                      onChange={(e) => setOverlapWeight(Number(e.target.value))}
                      className="h-9"
                    />
                </div>
            </div>
          </div>

          <div className="bg-amber-50 rounded-lg p-3 border border-amber-100 flex gap-3 text-amber-800">
             <div className="shrink-0 pt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse mt-1" />
             </div>
             <p className="text-[11px] leading-relaxed font-medium">
                Changing weights significantly might increase convergence time or result in an 'Infeasible' status if constraints become too tight.
             </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="bg-blue-600 hover:bg-blue-700 gap-2" onClick={() => onOpenChange(false)}>
            <Save size={14} /> Save Configuration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

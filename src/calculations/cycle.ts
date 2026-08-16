import type { WorkerNode, WorkerPreset } from "../shared/models.js";

export interface CycleCalculation {
  cycleTimeMinutes: number | null;
  workMinutes: number | null;
  travelMinutes: number | null;
  estimated: boolean;
  issues: string[];
}

// Formula follows the old community node-calculator convention:
// work = ceil(totalWorkload / workerWorkSpeed) * 10 minutes.
// travel = ((distance / movementSpeed) * 2) / 60 minutes for round trip.
// Missing workload or distance is surfaced as incomplete instead of invented.
export function calculateCycleTime(node: WorkerNode, worker: WorkerPreset): CycleCalculation {
  const issues: string[] = [];
  if (node.workload == null || node.workload <= 0) issues.push("Workload missing");
  if (node.distance == null || node.distance < 0) issues.push("Worker travel distance missing");
  if (worker.workSpeed <= 0) issues.push("Worker work speed must be positive");
  if (worker.movementSpeed <= 0) issues.push("Worker movement speed must be positive");
  if (issues.length > 0) {
    return { cycleTimeMinutes: null, workMinutes: null, travelMinutes: null, estimated: false, issues };
  }

  const workMinutes = Math.ceil((node.workload as number) / worker.workSpeed) * 10;
  const travelMinutes = (((node.distance as number) / worker.movementSpeed) * 2) / 60;
  return {
    cycleTimeMinutes: workMinutes + travelMinutes,
    workMinutes,
    travelMinutes,
    estimated: node.confidence === "estimated",
    issues
  };
}

export function calculateCyclesPerDay(cycleTimeMinutes: number | null): number | null {
  if (cycleTimeMinutes == null || cycleTimeMinutes <= 0) return null;
  return 1440 / cycleTimeMinutes;
}

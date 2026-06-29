import { getScoutAssignment } from './keys';

export interface ScoutAssignment {
  name: string;
  alliance: 'Red' | 'Blue';
  positionIndex: number;
  slotLabel: string;
}

export const SCOUT_ASSIGNMENTS: ScoutAssignment[] = [];

export const getScoutAssignmentByName = (name: string) =>
  getScoutAssignment(SCOUT_ASSIGNMENTS, { name });

export const getScoutAssignmentBySlot = (slotLabel: string) =>
  getScoutAssignment(SCOUT_ASSIGNMENTS, { slotLabel });

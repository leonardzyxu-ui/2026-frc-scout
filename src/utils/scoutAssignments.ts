import { getScoutAssignment } from './keys';

export interface ScoutAssignment {
  name: string;
  alliance: 'Red' | 'Blue';
  positionIndex: number;
  slotLabel: string;
}

export const SCOUT_ASSIGNMENTS: ScoutAssignment[] = [
  { name: 'Olivia', alliance: 'Red', positionIndex: 0, slotLabel: 'Red 1' },
  { name: 'Eason', alliance: 'Red', positionIndex: 1, slotLabel: 'Red 2' },
  { name: 'Matilda', alliance: 'Red', positionIndex: 2, slotLabel: 'Red 3' },
  { name: 'Sophia', alliance: 'Blue', positionIndex: 0, slotLabel: 'Blue 1' },
  { name: 'Lucas', alliance: 'Blue', positionIndex: 1, slotLabel: 'Blue 2' },
  { name: 'Justin', alliance: 'Blue', positionIndex: 2, slotLabel: 'Blue 3' }
];

export const getScoutAssignmentByName = (name: string) =>
  getScoutAssignment(SCOUT_ASSIGNMENTS, { name });

export const getScoutAssignmentBySlot = (slotLabel: string) =>
  getScoutAssignment(SCOUT_ASSIGNMENTS, { slotLabel });

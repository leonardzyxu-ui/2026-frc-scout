import { PitScoutingV2 } from '../types';

type DistanceUnit = PitScoutingV2['chassisSpeedDistanceUnit'];
type TimeUnit = PitScoutingV2['chassisSpeedTimeUnit'];

const DISTANCE_TO_METERS: Record<Exclude<DistanceUnit, ''>, number> = {
  meters: 1,
  feet: 0.3048,
  miles: 1609.344,
  kilometers: 1000,
  yards: 0.9144
};

const TIME_TO_SECONDS: Record<Exclude<TimeUnit, ''>, number> = {
  seconds: 1,
  minutes: 60,
  hours: 3600
};

function roundToHundredths(value: number) {
  return Math.round(value * 100) / 100;
}

function formatDecimal(value: number) {
  return value.toFixed(2).replace(/\.?0+$/, '');
}

export function convertSpeedToMetersPerSecond(
  value: number,
  distanceUnit: DistanceUnit,
  timeUnit: TimeUnit
) {
  if (!Number.isFinite(value) || value <= 0 || !distanceUnit || !timeUnit) {
    return null;
  }

  const distanceFactor = DISTANCE_TO_METERS[distanceUnit];
  const timeFactor = TIME_TO_SECONDS[timeUnit];

  if (!distanceFactor || !timeFactor) {
    return null;
  }

  return value * distanceFactor / timeFactor;
}

export function normalizePitChassisSpeed(
  value: number,
  distanceUnit: DistanceUnit,
  timeUnit: TimeUnit
): {
  chassisSpeed: number;
  chassisSpeedDistanceUnit: DistanceUnit;
  chassisSpeedTimeUnit: TimeUnit;
} {
  const converted = convertSpeedToMetersPerSecond(value, distanceUnit, timeUnit);

  if (converted === null || converted > 50) {
    return {
      chassisSpeed: 0,
      chassisSpeedDistanceUnit: '',
      chassisSpeedTimeUnit: ''
    };
  }

  return {
    chassisSpeed: roundToHundredths(converted),
    chassisSpeedDistanceUnit: 'meters',
    chassisSpeedTimeUnit: 'seconds'
  };
}

export function formatPitChassisSpeed(pitData: Pick<PitScoutingV2, 'chassisSpeed' | 'chassisSpeedDistanceUnit' | 'chassisSpeedTimeUnit'>) {
  const converted = convertSpeedToMetersPerSecond(
    pitData.chassisSpeed,
    pitData.chassisSpeedDistanceUnit,
    pitData.chassisSpeedTimeUnit
  );

  if (converted === null || converted > 50) {
    return 'N/A';
  }

  return `${formatDecimal(roundToHundredths(converted))} m/s`;
}

export function getShooterLabel(pitData: Pick<PitScoutingV2, 'turretCount' | 'customTurretCount'>) {
  if (pitData.turretCount === 'More' && pitData.customTurretCount) {
    return pitData.customTurretCount;
  }

  return pitData.turretCount || '';
}

export function getTraversalLabel(pitData: Pick<PitScoutingV2, 'canCrossTrench' | 'isBumpOnly'>) {
  if (pitData.canCrossTrench) return 'Trench Capable';
  if (pitData.isBumpOnly) return 'Bump Robot';
  return '';
}

export function getClimbCapabilityLabel(
  pitData: Pick<PitScoutingV2, 'noClimbCapability' | 'canClimbL1' | 'canClimbL2' | 'canClimbL3'>
) {
  if (pitData.noClimbCapability) {
    return 'None';
  }

  const levels = [
    pitData.canClimbL1 ? 'L1' : null,
    pitData.canClimbL2 ? 'L2' : null,
    pitData.canClimbL3 ? 'L3' : null
  ].filter(Boolean);

  return levels.join(', ');
}

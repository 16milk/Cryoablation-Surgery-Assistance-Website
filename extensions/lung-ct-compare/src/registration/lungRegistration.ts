import type { ServicesManager } from '@ohif/core';

/** Patient-space point/vector in millimetres (DICOM LPS), e.g. ImagePositionPatient. */
export type Vec3 = [number, number, number];

/** Context handed to the deformation field on every lookup. */
export interface LungRegistrationContext {
  /** Display set shown in the baseline (left) viewport, if any. */
  baselineDisplaySetInstanceUID: string | null;
  /** Display set shown in the compare (right) viewport, if any. */
  compareDisplaySetInstanceUID: string | null;
  servicesManager?: ServicesManager;
}

/**
 * Deformation / offset field ("偏移场") between the baseline (left) and compare
 * (right) CT volumes.
 *
 * Convention — everything is in patient coordinates (mm, LPS):
 *
 *   compare_point ≈ baseline_point + getDisplacement(baseline_point)
 *
 * This is the single artefact the registration model produces. It is mocked
 * now and swapped for the trained field later via `setLungDeformationField`,
 * without touching the panel or the sync code.
 */
export interface LungDeformationField {
  /** Displacement (mm) carrying a baseline-space point into compare space. */
  getDisplacement(point: Vec3, context: LungRegistrationContext): Vec3;
  /**
   * Inverse displacement (mm) carrying a compare-space point into baseline
   * space (used when the right viewport drives the left). Optional: defaults to
   * the negated forward displacement — exact for pure translations and a fair
   * approximation for small deformations.
   */
  getInverseDisplacement?(point: Vec3, context: LungRegistrationContext): Vec3;
  /** Optional id (e.g. model version) for debugging/telemetry. */
  readonly id?: string;
}

/**
 * >>> MOCK DEFORMATION FIELD — REPLACE WITH TRAINED MODEL OUTPUT <<<
 *
 * Identity registration: zero displacement everywhere. Sliding the left
 * viewport aligns the right viewport by anatomical position only (matching the
 * prior behaviour). Swap in a trained field with `setLungDeformationField` to
 * enable true deformable registration.
 */
export const mockIdentityDeformationField: LungDeformationField = {
  id: 'mock-identity',
  getDisplacement: () => [0, 0, 0],
  getInverseDisplacement: () => [0, 0, 0],
};

/**
 * Helper mock: a constant rigid offset (mm, LPS). Useful for verifying the sync
 * plumbing end-to-end before a real model exists — e.g.
 * `setLungDeformationField(createConstantDeformationField([0, 0, 10]))` shifts
 * the compare side by 10 mm along Z. Not anatomically meaningful.
 */
export function createConstantDeformationField(
  offsetMm: Vec3,
  id = 'mock-constant'
): LungDeformationField {
  return {
    id,
    getDisplacement: () => [offsetMm[0], offsetMm[1], offsetMm[2]],
    getInverseDisplacement: () => [-offsetMm[0], -offsetMm[1], -offsetMm[2]],
  };
}

let activeField: LungDeformationField = mockIdentityDeformationField;

/**
 * Register the deformation field. Pass `null` to reset to the identity mock.
 * Call this once the trained registration field is available.
 */
export function setLungDeformationField(field: LungDeformationField | null): void {
  activeField = field ?? mockIdentityDeformationField;
}

/** Get the currently registered deformation field (identity mock by default). */
export function getLungDeformationField(): LungDeformationField {
  return activeField;
}

/** Map a baseline-space point into compare space using the active field. */
export function mapBaselineToCompare(point: Vec3, context: LungRegistrationContext): Vec3 {
  const d = getLungDeformationField().getDisplacement(point, context);
  return [point[0] + d[0], point[1] + d[1], point[2] + d[2]];
}

/** Map a compare-space point back into baseline space using the active field. */
export function mapCompareToBaseline(point: Vec3, context: LungRegistrationContext): Vec3 {
  const field = getLungDeformationField();
  const d = field.getInverseDisplacement
    ? field.getInverseDisplacement(point, context)
    : (() => {
        const f = field.getDisplacement(point, context);
        return [-f[0], -f[1], -f[2]] as Vec3;
      })();
  return [point[0] + d[0], point[1] + d[1], point[2] + d[2]];
}

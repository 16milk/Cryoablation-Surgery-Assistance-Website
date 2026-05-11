import { metaData } from '@cornerstonejs/core';

/** Slice stacking coordinate along acquisition normal (LPS), mm along axis through origin. */
export function stackCoordinate(
  imagePositionPatient: number[],
  axisNormal: number[]
): number {
  return (
    imagePositionPatient[0] * axisNormal[0] +
    imagePositionPatient[1] * axisNormal[1] +
    imagePositionPatient[2] * axisNormal[2]
  );
}

export function normalizeVec3(v: number[]): number[] {
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  if (len < 1e-6) {
    return [0, 0, 1];
  }
  return [v[0] / len, v[1] / len, v[2] / len];
}

export function crossVec3(a: number[], b: number[]): number[] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

/** Normal points “into” the viewer for axial stacks (cross of row × column). */
export function normalFromImagePlane(imageId: string): number[] | null {
  const plane = metaData.get('imagePlaneModule', imageId) as {
    rowCosines?: ArrayLike<number>;
    columnCosines?: ArrayLike<number>;
  } | null;
  if (!plane?.rowCosines || !plane?.columnCosines) {
    return null;
  }
  const row = Array.from(plane.rowCosines);
  const col = Array.from(plane.columnCosines);
  const n = crossVec3(row, col);
  return normalizeVec3(n);
}

export function findNearestSliceIndexByAxis(
  imageIds: string[],
  axisNormal: number[],
  targetCoord: number
): { index: number; deltaMm: number } {
  let bestIndex = 0;
  let bestDelta = Infinity;

  for (let i = 0; i < imageIds.length; i++) {
    const plane = metaData.get('imagePlaneModule', imageIds[i]) as {
      imagePositionPatient?: ArrayLike<number>;
    } | null;
    const ippRaw = plane?.imagePositionPatient;
    if (!ippRaw || ippRaw.length < 3) {
      continue;
    }
    const ipp = Array.from(ippRaw);
    const coord = stackCoordinate(ipp, axisNormal);
    const delta = Math.abs(coord - targetCoord);
    if (delta < bestDelta) {
      bestDelta = delta;
      bestIndex = i;
    }
  }

  return { index: bestIndex, deltaMm: bestDelta };
}

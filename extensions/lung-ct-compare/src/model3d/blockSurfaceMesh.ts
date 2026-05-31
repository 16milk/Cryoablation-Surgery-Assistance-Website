/**
 * Lightweight block-surface mesher for binary labelmaps.
 *
 * Avoids the polySeg WASM worker (which often fails with "Failed to convert
 * labelmap to surface" in webpack dev builds). Downsamples the volume, emits
 * exposed cube faces, and returns VTK-style { points, polys } for Cornerstone
 * surface geometry.
 */

export interface BlockSurfaceMesh {
  points: Float32Array;
  polys: Uint32Array;
}

const MAX_TRIANGLES = 400_000;

function indexToWorld(
  i: number,
  j: number,
  k: number,
  origin: [number, number, number],
  spacing: [number, number, number],
  direction: number[]
): [number, number, number] {
  const sx = i * spacing[0];
  const sy = j * spacing[1];
  const sz = k * spacing[2];
  return [
    origin[0] + direction[0] * sx + direction[1] * sy + direction[2] * sz,
    origin[1] + direction[3] * sx + direction[4] * sy + direction[5] * sz,
    origin[2] + direction[6] * sx + direction[7] * sy + direction[8] * sz,
  ];
}

/** True when any voxel in the block equals `segmentIndex`. */
function blockOccupied(
  scalar: ArrayLike<number>,
  width: number,
  height: number,
  depth: number,
  segmentIndex: number,
  bx: number,
  by: number,
  bz: number,
  step: number
): boolean {
  const x0 = bx * step;
  const y0 = by * step;
  const z0 = bz * step;
  const x1 = Math.min(width, x0 + step);
  const y1 = Math.min(height, y0 + step);
  const z1 = Math.min(depth, z0 + step);
  const sliceSize = width * height;
  for (let z = z0; z < z1; z++) {
    const zBase = z * sliceSize;
    for (let y = y0; y < y1; y++) {
      const row = zBase + y * width;
      for (let x = x0; x < x1; x++) {
        if (scalar[row + x] === segmentIndex) {
          return true;
        }
      }
    }
  }
  return false;
}

function addQuad(
  points: number[],
  polys: number[],
  a: [number, number, number],
  b: [number, number, number],
  c: [number, number, number],
  d: [number, number, number]
): void {
  const base = points.length / 3;
  points.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], d[0], d[1], d[2]);
  polys.push(3, base, base + 1, base + 2, 3, base, base + 2, base + 3);
}

/**
 * Build a surface mesh for one segment index from a 3D labelmap volume.
 * `step` controls downsampling block size (larger = coarser, faster mesh).
 */
export function buildBlockSurfaceFromSegment(
  scalar: ArrayLike<number>,
  width: number,
  height: number,
  depth: number,
  segmentIndex: number,
  spacing: [number, number, number],
  origin: [number, number, number],
  direction: number[],
  step = 4
): BlockSurfaceMesh | null {
  if (!width || !height || !depth || segmentIndex <= 0) {
    return null;
  }

  const bxCount = Math.ceil(width / step);
  const byCount = Math.ceil(height / step);
  const bzCount = Math.ceil(depth / step);

  const occupied = (bx: number, by: number, bz: number) => {
    if (bx < 0 || by < 0 || bz < 0 || bx >= bxCount || by >= byCount || bz >= bzCount) {
      return false;
    }
    return blockOccupied(scalar, width, height, depth, segmentIndex, bx, by, bz, step);
  };

  const points: number[] = [];
  const polys: number[] = [];

  for (let bz = 0; bz < bzCount; bz++) {
    for (let by = 0; by < byCount; by++) {
      for (let bx = 0; bx < bxCount; bx++) {
        if (!occupied(bx, by, bz)) {
          continue;
        }

        const x0 = bx * step;
        const y0 = by * step;
        const z0 = bz * step;
        const x1 = Math.min(width, (bx + 1) * step);
        const y1 = Math.min(height, (by + 1) * step);
        const z1 = Math.min(depth, (bz + 1) * step);

        const p000 = indexToWorld(x0, y0, z0, origin, spacing, direction);
        const p100 = indexToWorld(x1, y0, z0, origin, spacing, direction);
        const p110 = indexToWorld(x1, y1, z0, origin, spacing, direction);
        const p010 = indexToWorld(x0, y1, z0, origin, spacing, direction);
        const p001 = indexToWorld(x0, y0, z1, origin, spacing, direction);
        const p101 = indexToWorld(x1, y0, z1, origin, spacing, direction);
        const p111 = indexToWorld(x1, y1, z1, origin, spacing, direction);
        const p011 = indexToWorld(x0, y1, z1, origin, spacing, direction);

        if (!occupied(bx - 1, by, bz)) {
          addQuad(points, polys, p000, p010, p011, p001);
        }
        if (!occupied(bx + 1, by, bz)) {
          addQuad(points, polys, p100, p101, p111, p110);
        }
        if (!occupied(bx, by - 1, bz)) {
          addQuad(points, polys, p000, p001, p101, p100);
        }
        if (!occupied(bx, by + 1, bz)) {
          addQuad(points, polys, p010, p110, p111, p011);
        }
        if (!occupied(bx, by, bz - 1)) {
          addQuad(points, polys, p000, p100, p110, p010);
        }
        if (!occupied(bx, by, bz + 1)) {
          addQuad(points, polys, p001, p011, p111, p101);
        }

        if (polys.length / 4 > MAX_TRIANGLES) {
          return {
            points: new Float32Array(points),
            polys: new Uint32Array(polys),
          };
        }
      }
    }
  }

  if (points.length === 0) {
    return null;
  }

  return {
    points: new Float32Array(points),
    polys: new Uint32Array(polys),
  };
}

/** Pick a block step that keeps mesh size reasonable for large lung volumes. */
export function chooseSurfaceStep(voxelCount: number): number {
  if (voxelCount > 80_000_000) {
    return 8;
  }
  if (voxelCount > 20_000_000) {
    return 6;
  }
  if (voxelCount > 5_000_000) {
    return 4;
  }
  return 3;
}

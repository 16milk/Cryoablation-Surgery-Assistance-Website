import type { ServicesManager } from '@ohif/core';

import {
  LungDeformationField,
  LungRegistrationContext,
  Vec3,
  setLungDeformationField,
} from './lungRegistration';
import { LUNG_VIEWPORT_LEFT, LUNG_VIEWPORT_RIGHT } from '../hangingProtocol/lungCtCompare';
import {
  VxmRegistrationField,
  buildVxmRegistrationVolume,
  requestVxmRegistrationField,
} from './vxmRegistrationClient';

function dot(a: number[], b: number[]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function neg(a: Vec3): Vec3 {
  return [-a[0], -a[1], -a[2]];
}

function getViewportImageIds(
  servicesManager: ServicesManager | undefined,
  viewportId: string
): string[] {
  const viewport = servicesManager?.services?.cornerstoneViewportService?.getCornerstoneViewport(
    viewportId
  ) as { getImageIds?: () => string[] } | null;
  return viewport?.getImageIds?.() ?? [];
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

class VxmAsyncDeformationField implements LungDeformationField {
  readonly id = 'cryo-lung-vxm';

  private field: VxmRegistrationField | null = null;
  private key: string | null = null;
  private pending: Promise<void> | null = null;
  private abortController: AbortController | null = null;
  private disabledUntil = 0;

  getDisplacement(point: Vec3, context: LungRegistrationContext): Vec3 {
    this.ensurePrepared(context);
    return this.sample(point) ?? [0, 0, 0];
  }

  getInverseDisplacement(point: Vec3, context: LungRegistrationContext): Vec3 {
    this.ensurePrepared(context);
    // The service returns baseline -> compare offsets. Negating the local field is
    // a stable inverse approximation for interactive slice sync.
    return neg(this.sample(point) ?? [0, 0, 0]);
  }

  dispose(): void {
    this.abortController?.abort();
    this.abortController = null;
    this.pending = null;
    this.field = null;
    this.key = null;
  }

  private ensurePrepared(context: LungRegistrationContext): void {
    const key = `${context.baselineDisplaySetInstanceUID ?? ''}::${
      context.compareDisplaySetInstanceUID ?? ''
    }`;
    if (
      !context.baselineDisplaySetInstanceUID ||
      !context.compareDisplaySetInstanceUID ||
      key === '::'
    ) {
      return;
    }
    if (this.key === key && (this.field || this.pending)) {
      return;
    }
    if (Date.now() < this.disabledUntil) {
      return;
    }

    this.abortController?.abort();
    this.abortController = new AbortController();
    this.key = key;
    this.field = null;

    const baselineImageIds = getViewportImageIds(context.servicesManager, LUNG_VIEWPORT_LEFT);
    const compareImageIds = getViewportImageIds(context.servicesManager, LUNG_VIEWPORT_RIGHT);
    if (!baselineImageIds.length || !compareImageIds.length) {
      return;
    }

    const signal = this.abortController.signal;
    this.pending = (async () => {
      const [baseline, compare] = await Promise.all([
        buildVxmRegistrationVolume(baselineImageIds, signal),
        buildVxmRegistrationVolume(compareImageIds, signal),
      ]);
      if (!baseline || !compare || signal.aborted) {
        return;
      }
      const field = await requestVxmRegistrationField(baseline, compare, signal);
      if (!signal.aborted) {
        this.field = field;
      }
    })()
      .catch(error => {
        if ((error as { name?: string })?.name !== 'AbortError') {
          this.disabledUntil = Date.now() + 30000;
          // eslint-disable-next-line no-console
          console.warn('lung-ct-compare: VXM registration unavailable', error);
        }
      })
      .finally(() => {
        if (this.abortController?.signal === signal) {
          this.pending = null;
        }
      });
  }

  private sample(point: Vec3): Vec3 | null {
    const field = this.field;
    if (!field) {
      return null;
    }

    const [width, height, depth] = field.dimensions;
    const row = field.direction.slice(0, 3);
    const col = field.direction.slice(3, 6);
    const normal = field.direction.slice(6, 9);
    const rel = sub(point, field.origin);
    const gx = dot(rel, row) / field.spacing[0];
    const gy = dot(rel, col) / field.spacing[1];
    const gz = dot(rel, normal) / field.spacing[2];

    if (gx < -1 || gy < -1 || gz < -1 || gx > width || gy > height || gz > depth) {
      return null;
    }

    const x0 = Math.floor(clamp(gx, 0, width - 1));
    const y0 = Math.floor(clamp(gy, 0, height - 1));
    const z0 = Math.floor(clamp(gz, 0, depth - 1));
    const x1 = Math.min(width - 1, x0 + 1);
    const y1 = Math.min(height - 1, y0 + 1);
    const z1 = Math.min(depth - 1, z0 + 1);
    const tx = clamp(gx - x0, 0, 1);
    const ty = clamp(gy - y0, 0, 1);
    const tz = clamp(gz - z0, 0, 1);

    const at = (x: number, y: number, z: number, c: number) =>
      field.flow[((z * height + y) * width + x) * 3 + c] || 0;

    const out: Vec3 = [0, 0, 0];
    for (let c = 0; c < 3; c++) {
      const c00 = at(x0, y0, z0, c) * (1 - tx) + at(x1, y0, z0, c) * tx;
      const c10 = at(x0, y1, z0, c) * (1 - tx) + at(x1, y1, z0, c) * tx;
      const c01 = at(x0, y0, z1, c) * (1 - tx) + at(x1, y0, z1, c) * tx;
      const c11 = at(x0, y1, z1, c) * (1 - tx) + at(x1, y1, z1, c) * tx;
      const c0 = c00 * (1 - ty) + c10 * ty;
      const c1 = c01 * (1 - ty) + c11 * ty;
      out[c] = c0 * (1 - tz) + c1 * tz;
    }
    return out;
  }
}

let instance: VxmAsyncDeformationField | null = null;

export function registerVxmLungRegistration(): VxmAsyncDeformationField {
  if (!instance) {
    instance = new VxmAsyncDeformationField();
  }
  setLungDeformationField(instance);
  return instance;
}

export function unregisterVxmLungRegistration(): void {
  instance?.dispose();
  instance = null;
  setLungDeformationField(null);
}

export { VxmAsyncDeformationField };

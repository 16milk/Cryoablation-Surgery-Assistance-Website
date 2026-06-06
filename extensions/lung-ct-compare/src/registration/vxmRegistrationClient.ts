import { cache, imageLoader, metaData } from '@cornerstonejs/core';

import { firstNumber } from '../segmentation/baseLungSegmentationProvider';

const BASE = '/medsam2';
const GRID_SIZE = 160;

export interface VxmRegistrationVolume {
  dimensions: [number, number, number];
  spacing: [number, number, number];
  origin: [number, number, number];
  direction: [number, number, number, number, number, number, number, number, number];
  huBase64: string;
}

export interface VxmRegistrationField {
  dimensions: [number, number, number];
  spacing: [number, number, number];
  origin: [number, number, number];
  direction: [number, number, number, number, number, number, number, number, number];
  flow: Float32Array;
  model?: string;
  device?: string;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk) as unknown as number[]);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

function dot(a: number[], b: number[]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function normalize(v: number[]): [number, number, number] {
  const len = Math.hypot(v[0], v[1], v[2]);
  if (len < 1e-6) {
    return [0, 0, 1];
  }
  return [v[0] / len, v[1] / len, v[2] / len];
}

function cross(a: number[], b: number[]): [number, number, number] {
  return normalize([
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]);
}

function encodeHu(hu: Int16Array): string {
  return bytesToBase64(new Uint8Array(hu.buffer));
}

function imageToInt16Hu(imageId: string): {
  hu: Int16Array;
  width: number;
  height: number;
} | null {
  const image = cache.getImage(imageId);
  const pixelData = image?.getPixelData?.();
  if (!image || !pixelData) {
    return null;
  }

  const width = firstNumber(image.columns, (image as { width?: number }).width);
  const height = firstNumber(image.rows, (image as { height?: number }).height);
  if (!width || !height) {
    return null;
  }

  const modalityLut = (metaData.get('modalityLutModule', imageId) || {}) as {
    rescaleSlope?: number;
    rescaleIntercept?: number;
  };
  const slope = firstNumber(image.slope, modalityLut.rescaleSlope) ?? 1;
  const intercept = firstNumber(image.intercept, modalityLut.rescaleIntercept) ?? 0;

  const n = width * height;
  const hu = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    let v = Math.round(pixelData[i] * slope + intercept);
    if (v < -32768) {
      v = -32768;
    } else if (v > 32767) {
      v = 32767;
    }
    hu[i] = v;
  }
  return { hu, width, height };
}

async function loadHu(imageId: string): Promise<{
  hu: Int16Array;
  width: number;
  height: number;
} | null> {
  let slice = imageToInt16Hu(imageId);
  if (slice) {
    return slice;
  }
  try {
    await imageLoader.loadAndCacheImage(imageId);
  } catch {
    return null;
  }
  slice = imageToInt16Hu(imageId);
  return slice;
}

function geometryFromImageIds(imageIds: string[]): {
  origin: [number, number, number];
  direction: [number, number, number, number, number, number, number, number, number];
  spacing: [number, number, number];
} | null {
  const firstPlane = metaData.get('imagePlaneModule', imageIds[0]) as {
    imagePositionPatient?: ArrayLike<number>;
    rowCosines?: ArrayLike<number>;
    columnCosines?: ArrayLike<number>;
    rowPixelSpacing?: number;
    columnPixelSpacing?: number;
  } | null;
  if (!firstPlane?.imagePositionPatient || !firstPlane.rowCosines || !firstPlane.columnCosines) {
    return null;
  }

  const origin = Array.from(firstPlane.imagePositionPatient).slice(0, 3) as [
    number,
    number,
    number,
  ];
  const row = normalize(Array.from(firstPlane.rowCosines));
  const col = normalize(Array.from(firstPlane.columnCosines));
  const normal = cross(row, col);

  const lastPlane = metaData.get('imagePlaneModule', imageIds[imageIds.length - 1]) as {
    imagePositionPatient?: ArrayLike<number>;
  } | null;
  const lastIpp = lastPlane?.imagePositionPatient
    ? Array.from(lastPlane.imagePositionPatient)
    : origin;
  const zSpan = Math.abs(
    dot([lastIpp[0] - origin[0], lastIpp[1] - origin[1], lastIpp[2] - origin[2]], normal)
  );
  const sourceZSpacing = imageIds.length > 1 ? zSpan / (imageIds.length - 1) : 1;

  return {
    origin,
    direction: [...row, ...col, ...normal] as [
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
    ],
    spacing: [
      firstPlane.columnPixelSpacing || 1,
      firstPlane.rowPixelSpacing || 1,
      sourceZSpacing || 1,
    ],
  };
}

export async function buildVxmRegistrationVolume(
  imageIds: string[],
  signal?: AbortSignal
): Promise<VxmRegistrationVolume | null> {
  if (imageIds.length === 0) {
    return null;
  }

  const geometry = geometryFromImageIds(imageIds);
  if (!geometry) {
    return null;
  }

  const first = await loadHu(imageIds[0]);
  if (!first) {
    return null;
  }

  const width = GRID_SIZE;
  const height = GRID_SIZE;
  const depth = GRID_SIZE;
  const out = new Int16Array(width * height * depth);
  const xScale = first.width / width;
  const yScale = first.height / height;
  const zScale = imageIds.length / depth;

  for (let z = 0; z < depth; z++) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    const sourceZ = Math.min(
      imageIds.length - 1,
      Math.max(0, Math.round((z + 0.5) * zScale - 0.5))
    );
    const slice = await loadHu(imageIds[sourceZ]);
    if (!slice) {
      continue;
    }
    const base = z * width * height;
    for (let y = 0; y < height; y++) {
      const sy = Math.min(slice.height - 1, Math.max(0, Math.round((y + 0.5) * yScale - 0.5)));
      const srcRow = sy * slice.width;
      const dstRow = base + y * width;
      for (let x = 0; x < width; x++) {
        const sx = Math.min(slice.width - 1, Math.max(0, Math.round((x + 0.5) * xScale - 0.5)));
        out[dstRow + x] = slice.hu[srcRow + sx];
      }
    }
    if (z % 4 === 3) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  return {
    dimensions: [width, height, depth],
    spacing: [
      geometry.spacing[0] * xScale,
      geometry.spacing[1] * yScale,
      geometry.spacing[2] * zScale,
    ],
    origin: geometry.origin,
    direction: geometry.direction,
    huBase64: encodeHu(out),
  };
}

export async function requestVxmRegistrationField(
  baseline: VxmRegistrationVolume,
  compare: VxmRegistrationVolume,
  signal?: AbortSignal,
  timeoutMs = 120000
): Promise<VxmRegistrationField> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  try {
    const resp = await fetch(`${BASE}/registration/field`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseline, compare }),
      signal: controller.signal,
    });
    if (!resp.ok) {
      throw new Error(`VXM registration failed: ${resp.status}`);
    }
    const json = await resp.json();
    if (!json?.flowBase64) {
      throw new Error('VXM registration returned no flow');
    }
    return {
      dimensions: json.dimensions,
      spacing: json.spacing,
      origin: json.origin,
      direction: json.direction,
      flow: new Float32Array(base64ToBytes(json.flowBase64).buffer),
      model: json.model,
      device: json.device,
    };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

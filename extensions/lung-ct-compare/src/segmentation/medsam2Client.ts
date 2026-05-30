/**
 * Thin client for the MedSAM2 inference microservice (see `medsam2_server/`).
 * The browser sends a single CT slice's HU values plus a bounding-box prompt and
 * receives a binary mask. All requests go through the dev proxy at `/medsam2`.
 */

export type MedSam2Box = [number, number, number, number];

export interface MedSam2SegmentRequest {
  width: number;
  height: number;
  /** Base64 of the slice HU values as little-endian Int16, row-major. */
  huBase64: string;
  /** Structure id (informational + lets the server pick a default window). */
  structure: string;
  /** Bounding-box prompt in pixel coords: [x0, y0, x1, y1]. */
  box?: MedSam2Box;
  /** Point prompts in pixel coords with label: [x, y, label] (1=fg, 0=bg). */
  points?: Array<[number, number, number]>;
  /** CT window [center, width] used to normalize HU before inference. */
  window?: [number, number];
}

export interface MedSam2Health {
  ok: boolean;
  modelLoaded: boolean;
  device?: string;
}

const BASE = '/medsam2';

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, i + chunk) as unknown as number[]
    );
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

/** Encode HU values as base64 little-endian Int16 (clamped to int16 range). */
export function encodeHu(hu: Float32Array): string {
  const i16 = new Int16Array(hu.length);
  for (let i = 0; i < hu.length; i++) {
    let v = Math.round(hu[i]);
    if (v < -32768) {
      v = -32768;
    } else if (v > 32767) {
      v = 32767;
    }
    i16[i] = v;
  }
  return bytesToBase64(new Uint8Array(i16.buffer));
}

/** Probe service health. Never throws; returns ok:false on any failure/timeout. */
export async function medsam2Health(timeoutMs = 2500): Promise<MedSam2Health> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(`${BASE}/health`, { signal: controller.signal });
    if (!resp.ok) {
      return { ok: false, modelLoaded: false };
    }
    const json = await resp.json();
    return { ok: true, modelLoaded: Boolean(json?.modelLoaded), device: json?.device };
  } catch {
    return { ok: false, modelLoaded: false };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Run MedSAM2 on one slice. Returns a 0/1 mask (length width*height) or throws
 * if the service is unreachable / errors / returns no mask.
 */
export async function medsam2Segment(
  request: MedSam2SegmentRequest,
  timeoutMs = 20000
): Promise<Uint8Array> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(`${BASE}/segment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    if (!resp.ok) {
      throw new Error(`medsam2 segment failed: ${resp.status}`);
    }
    const json = await resp.json();
    if (!json?.maskBase64) {
      throw new Error('medsam2 segment returned no mask');
    }
    return base64ToBytes(json.maskBase64);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Whether this browser's WebAssembly supports SIMD: the same probe MediaPipe
 * uses to choose between its SIMD and non-SIMD runtimes (a tiny module using
 * one SIMD instruction).
 */
const SIMD_PROBE = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]);

export function wasmSupported(): boolean {
  try {
    return typeof WebAssembly === 'object' && WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]));
  } catch {
    return false;
  }
}

export function simdSupported(): boolean {
  try {
    return wasmSupported() && WebAssembly.validate(SIMD_PROBE);
  } catch {
    return false;
  }
}

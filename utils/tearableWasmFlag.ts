export function shouldUseTearableWasm(scope: Window): boolean {
  try {
    const params = new URLSearchParams(scope.location.search);
    if (params.get('wasmCloth') === '1') return true;
    if (params.get('wasmCloth') === '0') return false;
    const stored = scope.localStorage.getItem('tearableWasm');
    if (stored === '1') return true;
    if (stored === '0') return false;
  } catch {
    return import.meta.env.VITE_TEARABLE_WASM !== '0';
  }
  return import.meta.env.VITE_TEARABLE_WASM !== '0';
}

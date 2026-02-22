// Simple placeholder for API fetch
export async function apiFetch<T = any>(path: string): Promise<T> {
  // Simulate API call
  return new Promise<T>((resolve) => {
    setTimeout(() => {
      resolve({ publicKey: "demo-vapid-key" } as T);
    }, 500);
  });
}

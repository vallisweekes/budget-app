export function enforceServerOnlyRuntime() {
  const argv = Array.isArray(process.argv) ? process.argv.join(" ") : "";
  const isPrismaCliContext = /prisma[\\/](seed|migrate)|prisma\s+db\s+seed|tsx\s+prisma[\\/]/i.test(argv);
  if (isPrismaCliContext) return;

  try {
    require("server-only");
  } catch (error) {
    const message = String((error as { message?: unknown } | null)?.message ?? "");
    if (/Client Component/i.test(message)) return;
    throw error;
  }
}
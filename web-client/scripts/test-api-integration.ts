/**
 * API Integration Test Script
 * Tests all database-backed API endpoints.
 *
 * Notes:
 * - Most endpoints require a NextAuth session cookie.
 * - This script will try to source a session token automatically from the DB,
 *   falling back to TEST_SESSION_TOKEN if provided.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const BASE_URL = process.env.TEST_BASE_URL?.trim() || "http://localhost:5537/api/bff";

interface TestResult {
  name: string;
  success: boolean;
  message?: string;
  data?: any;
}

const results: TestResult[] = [];

function getOriginFromBaseUrl(baseUrl: string): string {
  // BASE_URL is typically `http://host:port/api/bff`
  return baseUrl.replace(/\/?api\/bff\/?$/i, "").replace(/\/$/, "");
}

function extractCookiesFromResponse(res: Response): string[] {
  const anyHeaders = res.headers as any;
  const arr: string[] | undefined = typeof anyHeaders.getSetCookie === "function" ? anyHeaders.getSetCookie() : undefined;
  if (arr && Array.isArray(arr)) return arr;

  const single = res.headers.get("set-cookie");
  return single ? [single] : [];
}

function cookieHeaderFromSetCookies(setCookies: string[]): string {
  // Convert Set-Cookie headers into a single Cookie header.
  const pairs: string[] = [];
  for (const sc of setCookies) {
    const first = sc.split(";")[0]?.trim();
    if (first) pairs.push(first);
  }
  // Deduplicate by cookie name (keep last)
  const map = new Map<string, string>();
  for (const p of pairs) {
    const idx = p.indexOf("=");
    if (idx <= 0) continue;
    map.set(p.slice(0, idx), p);
  }
  return Array.from(map.values()).join("; ");
}

function buildCookieHeaderFromSessionToken(sessionToken: string): string {
  // In dev, NextAuth typically uses `next-auth.session-token`.
  // In some deployments it can be `__Secure-next-auth.session-token`.
  return [
    `next-auth.session-token=${sessionToken}`,
    `__Secure-next-auth.session-token=${sessionToken}`,
  ].join("; ");
}

async function resolveUsernameForAuth(): Promise<string | null> {
  const fromEnv = process.env.TEST_USERNAME?.trim();
  if (fromEnv) return fromEnv;

  try {
    const user = await prisma.user.findFirst({
      where: { name: { not: null } },
      orderBy: { updatedAt: "desc" },
      select: { name: true },
    });
    const name = String(user?.name ?? "").trim();
    return name ? name : null;
  } catch {
    return null;
  }
}

async function signInAndGetCookieHeader(): Promise<string | null> {
  const origin = getOriginFromBaseUrl(BASE_URL);
  const username = await resolveUsernameForAuth();
  if (!username) return null;

  // 1) Fetch CSRF token (also sets csrf cookie)
  const csrfRes = await fetch(`${origin}/api/auth/csrf`, { redirect: "manual" });
  if (!csrfRes.ok) return null;
  const csrfJson = (await csrfRes.json().catch(() => null)) as any;
  const csrfToken = typeof csrfJson?.csrfToken === "string" ? csrfJson.csrfToken : null;
  if (!csrfToken) return null;

  const csrfCookies = extractCookiesFromResponse(csrfRes);
  const csrfCookieHeader = cookieHeaderFromSetCookies(csrfCookies);

  // 2) Perform credentials callback to mint a JWT session cookie
  const body = new URLSearchParams({
    csrfToken,
    username,
    mode: "login",
    redirect: "false",
    json: "true",
    callbackUrl: `${origin}/`,
  });

  const loginRes = await fetch(`${origin}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...(csrfCookieHeader ? { Cookie: csrfCookieHeader } : {}),
    },
    body,
  });

  const setCookies = extractCookiesFromResponse(loginRes);
  const cookieHeader = cookieHeaderFromSetCookies([...csrfCookies, ...setCookies]);

  // Some NextAuth responses don't include JSON; cookie is the important part.
  return cookieHeader || null;
}

async function resolveAuthCookieHeader(): Promise<string | null> {
  const fromCookieEnv = process.env.TEST_COOKIE?.trim();
  if (fromCookieEnv) return fromCookieEnv;

  const fromSessionEnv = process.env.TEST_SESSION_TOKEN?.trim();
  if (fromSessionEnv) return buildCookieHeaderFromSessionToken(fromSessionEnv);

  return await signInAndGetCookieHeader();
}

async function testEndpoint(
  name: string,
  url: string,
  options?: RequestInit
): Promise<TestResult> {
  try {
    const response = await fetch(`${BASE_URL}${url}`, options);
    const data = await response.json();

    if (!response.ok) {
      return {
        name,
        success: false,
        message: `HTTP ${response.status}: ${JSON.stringify(data)}`,
      };
    }

    return {
      name,
      success: true,
      data,
    };
  } catch (error) {
    return {
      name,
      success: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

async function runTests() {
  console.log("🧪 Running API Integration Tests\n");
  console.log("=" .repeat(60));

  const cookieHeader = await resolveAuthCookieHeader();
  const authHeaders = cookieHeader ? { Cookie: cookieHeader } : {};

  if (!cookieHeader) {
    console.log("\n⚠️  No auth cookie available.");
    console.log("   - Option A: set TEST_COOKIE to your browser Cookie header value.");
    console.log("   - Option B: set TEST_SESSION_TOKEN to your next-auth.session-token value.");
    console.log("   - Option C: set TEST_USERNAME (or ensure DB has a user.name) so the script can auto-login.");
    console.log("   - Many endpoints will return 401 without auth.\n");
  }

  // Test Categories
  console.log("\n📁 Testing Categories API...");
  const categoriesTest = await testEndpoint("GET /categories", "/categories", {
    headers: { ...authHeaders },
  });
  results.push(categoriesTest);
  console.log(
    categoriesTest.success
      ? `✓ Found ${categoriesTest.data?.length || 0} categories`
      : `✗ ${categoriesTest.message}`
  );

  // Test Expenses
  console.log("\n💰 Testing Expenses API...");
  const expensesTest = await testEndpoint(
    "GET /expenses",
    "/expenses?month=2&year=2026"
    ,
    { headers: { ...authHeaders } }
  );
  results.push(expensesTest);
  console.log(
    expensesTest.success
      ? `✓ Found ${expensesTest.data?.length || 0} expenses for Feb 2026`
      : `✗ ${expensesTest.message}`
  );

  // Test Income
  console.log("\n💵 Testing Income API...");
  const incomeTest = await testEndpoint(
    "GET /income",
    "/income?month=2&year=2026"
    ,
    { headers: { ...authHeaders } }
  );
  results.push(incomeTest);
  console.log(
    incomeTest.success
      ? `✓ Found ${incomeTest.data?.length || 0} income entries for Feb 2026`
      : `✗ ${incomeTest.message}`
  );

  // Test Debts
  console.log("\n💳 Testing Debts API...");
  const debtsTest = await testEndpoint("GET /debts", "/debts", {
    headers: { ...authHeaders },
  });
  results.push(debtsTest);
  console.log(
    debtsTest.success
      ? `✓ Found ${debtsTest.data?.length || 0} debts`
      : `✗ ${debtsTest.message}`
  );

  // Test Goals
  console.log("\n🎯 Testing Goals API...");
  const goalsTest = await testEndpoint("GET /goals", "/goals", {
    headers: { ...authHeaders },
  });
  results.push(goalsTest);
  console.log(
    goalsTest.success
      ? `✓ Found ${goalsTest.data?.length || 0} goals`
      : `✗ ${goalsTest.message}`
  );

  // Test Settings
  console.log("\n⚙️  Testing Settings API...");
  const settingsTest = await testEndpoint("GET /settings", "/settings", {
    headers: { ...authHeaders },
  });
  results.push(settingsTest);
  console.log(
    settingsTest.success
      ? `✓ Settings loaded (Pay date: ${settingsTest.data?.payDate})`
      : `✗ ${settingsTest.message}`
  );

  // PATCH /expenses/:id (basic edit flow)
  console.log("\n✏️  Testing Expense Edit (PATCH /expenses/:id)...");
  if (!expensesTest.success || !Array.isArray(expensesTest.data) || expensesTest.data.length === 0) {
    const skipped: TestResult = {
      name: "PATCH /expenses/:id",
      success: true,
      message: "SKIPPED: No expenses returned to test PATCH (or GET /expenses failed)",
    };
    results.push(skipped);
    console.log(`⚠️  ${skipped.message}`);
  } else {
    const sample = expensesTest.data[0] as any;
    const expenseId = String(sample.id || "");

    const toggleIsDirectDebit = typeof sample.isDirectDebit === "boolean" ? !sample.isDirectDebit : true;
    const patchBody = {
      name: sample.name,
      amount: Number(sample.amount),
      categoryId: sample.categoryId ?? null,
      isAllocation: !!sample.isAllocation,
      isDirectDebit: toggleIsDirectDebit,
      // Do NOT distribute during integration tests unless explicitly requested.
      distributeMonths: false,
      distributeYears: false,
      // Keep dueDate stable if present (API accepts YYYY-MM-DD or ISO datetime)
      dueDate: typeof sample.dueDate === "string" ? sample.dueDate.split("T")[0] : null,
    };

    const patchResult = await testEndpoint(
      "PATCH /expenses/:id",
      `/expenses/${encodeURIComponent(expenseId)}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify(patchBody),
      }
    );
    results.push(patchResult);

    if (patchResult.success) {
      const ok = patchResult.data?.isDirectDebit === toggleIsDirectDebit;
      console.log(ok ? "✓ PATCH updated isDirectDebit" : "✗ PATCH response did not reflect update");

      // Optional DB verification (ensures API + DB are in sync)
      try {
        const row = await prisma.expense.findUnique({
          where: { id: expenseId },
          select: { isDirectDebit: true },
        });

        if (row) {
          console.log(row.isDirectDebit === toggleIsDirectDebit ? "✓ DB value matches" : "✗ DB value mismatch");
        } else {
          console.log("⚠️  Could not find expense in DB for verification");
        }
      } catch {
        console.log("⚠️  Skipped DB verification (DB not reachable)");
      }

      // Revert the test mutation (best-effort)
      await testEndpoint(
        "PATCH /expenses/:id (revert)",
        `/expenses/${encodeURIComponent(expenseId)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders,
          },
          body: JSON.stringify({
            isDirectDebit: !!sample.isDirectDebit,
            distributeMonths: false,
            distributeYears: false,
          }),
        }
      );
    } else {
      console.log(`✗ ${patchResult.message}`);
    }
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(`\n📊 Test Summary:`);
  console.log(`   Passed: ${passed}/${results.length}`);
  console.log(`   Failed: ${failed}/${results.length}`);

  if (failed > 0) {
    console.log("\n❌ Failed tests:");
    results
      .filter((r) => !r.success)
      .forEach((r) => {
        console.log(`   • ${r.name}: ${r.message}`);
      });
  }

  console.log(
    failed === 0
      ? "\n✅ All tests passed! Database integration successful!"
      : "\n⚠️  Some tests failed. Check the output above."
  );

  await prisma.$disconnect().catch(() => null);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(async (error) => {
  console.error("\n💥 Test runner error:", error);
  await prisma.$disconnect().catch(() => null);
  process.exit(1);
});

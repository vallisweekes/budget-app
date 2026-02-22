/**
 * API Integration Test Script
 * Tests all database-backed API endpoints
 */

const BASE_URL = "http://localhost:5537/api/bff";

interface TestResult {
  name: string;
  success: boolean;
  message?: string;
  data?: any;
}

const results: TestResult[] = [];

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

  // Test Categories
  console.log("\n📁 Testing Categories API...");
  const categoriesTest = await testEndpoint("GET /categories", "/categories");
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
  );
  results.push(incomeTest);
  console.log(
    incomeTest.success
      ? `✓ Found ${incomeTest.data?.length || 0} income entries for Feb 2026`
      : `✗ ${incomeTest.message}`
  );

  // Test Debts
  console.log("\n💳 Testing Debts API...");
  const debtsTest = await testEndpoint("GET /debts", "/debts");
  results.push(debtsTest);
  console.log(
    debtsTest.success
      ? `✓ Found ${debtsTest.data?.length || 0} debts`
      : `✗ ${debtsTest.message}`
  );

  // Test Goals
  console.log("\n🎯 Testing Goals API...");
  const goalsTest = await testEndpoint("GET /goals", "/goals");
  results.push(goalsTest);
  console.log(
    goalsTest.success
      ? `✓ Found ${goalsTest.data?.length || 0} goals`
      : `✗ ${goalsTest.message}`
  );

  // Test Settings
  console.log("\n⚙️  Testing Settings API...");
  const settingsTest = await testEndpoint("GET /settings", "/settings");
  results.push(settingsTest);
  console.log(
    settingsTest.success
      ? `✓ Settings loaded (Pay date: ${settingsTest.data?.payDate})`
      : `✗ ${settingsTest.message}`
  );

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

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((error) => {
  console.error("\n💥 Test runner error:", error);
  process.exit(1);
});

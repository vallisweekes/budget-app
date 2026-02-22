import React, { useEffect, useState } from "react";
import { View, Text, Button, ActivityIndicator, StyleSheet } from "react-native";
import { apiFetch } from "../lib/api";

// Types for dashboard data
type User = { name: string };
type BudgetPlan = { id: string };
type DashboardData = { user: User | null; budgetPlan: BudgetPlan | null };

async function fetchDashboardData(): Promise<DashboardData> {
  const settings = await apiFetch<{ budgetPlanId?: string }>("/api/bff/settings");

  return {
    user: { name: "Signed in" },
    budgetPlan: settings?.budgetPlanId ? { id: settings.budgetPlanId } : null,
  };
}

export default function DashboardNativeScreen() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [budgetPlan, setBudgetPlan] = useState<BudgetPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    fetchDashboardData()
      .then((data: DashboardData) => {
        if (!isMounted) return;
        setUser(data.user);
        setBudgetPlan(data.budgetPlan);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
      })
      .finally(() => {
        if (!isMounted) return;
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.text}>Loading dashboard...</Text>
      </View>
    );
  }

  if (error) {
    const authError = /unauthorized|auth|signin|forbidden/i.test(error);
    return (
      <View style={styles.centered}>
        <Text style={styles.text}>
          {authError
            ? "Sign in via Web mode first, then return to Native mode."
            : `Failed to load dashboard: ${error}`}
        </Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.centered}>
        <Text style={styles.text}>Please log in to view your dashboard.</Text>
        <Button title="Go to Login" onPress={() => { /* Add navigation */ }} />
      </View>
    );
  }

  if (!budgetPlan) {
    return (
      <View style={styles.centered}>
        <Text style={styles.text}>No budget plan found.</Text>
        <Button title="Create New Budget" onPress={() => { /* Add navigation */ }} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome, {user.name}!</Text>
      <Text style={styles.subtitle}>Budget Plan ID: {budgetPlan.id}</Text>
      {/* Add dashboard content here */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b1220",
    justifyContent: "center",
    alignItems: "center",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0b1220",
  },
  text: {
    color: "#fff",
    marginTop: 12,
    fontSize: 16,
  },
  title: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 8,
  },
  subtitle: {
    color: "#fff",
    fontSize: 18,
    marginBottom: 16,
  },
});

import React, { useEffect, useState } from "react";
import { View, Text, Button, ActivityIndicator, StyleSheet } from "react-native";

// Types for dashboard data
type User = { name: string };
type BudgetPlan = { id: string; name: string };
type DashboardData = { user: User | null; budgetPlan: BudgetPlan | null };

// Placeholder API fetch function (replace with real API call)
async function fetchDashboardData(): Promise<DashboardData> {
  // Simulate API call
  return new Promise(resolve => {
    setTimeout(() => {
      resolve({
        user: { name: "Demo User" },
        budgetPlan: { id: "demo-plan", name: "Demo Budget Plan" }
      });
    }, 1000);
  });
}

export default function DashboardNativeScreen() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [budgetPlan, setBudgetPlan] = useState<BudgetPlan | null>(null);

  useEffect(() => {
    fetchDashboardData().then((data: DashboardData) => {
      setUser(data.user);
      setBudgetPlan(data.budgetPlan);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.text}>Loading dashboard...</Text>
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
      <Text style={styles.subtitle}>Budget Plan: {budgetPlan.name}</Text>
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

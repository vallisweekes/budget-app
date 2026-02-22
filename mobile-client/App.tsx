import React from "react";
import { View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Provider as ReduxProvider } from "react-redux";
import { StatusBar } from "expo-status-bar";
import { registerRootComponent } from "expo";

import { store } from "@/store";
import { AuthProvider } from "@/context/AuthContext";
import RootNavigator from "@/navigation/RootNavigator";

function App() {
  return (
    <SafeAreaProvider style={{ backgroundColor: "#0f282f" }}>
      <ReduxProvider store={store}>
        <AuthProvider>
          <NavigationContainer>
            <View style={{ flex: 1, backgroundColor: "#0f282f" }}>
              <RootNavigator />
            </View>
          </NavigationContainer>
          <StatusBar style="light" />
        </AuthProvider>
      </ReduxProvider>
    </SafeAreaProvider>
  );
}

registerRootComponent(App);
export default App;

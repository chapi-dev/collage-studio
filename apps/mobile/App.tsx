import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { EditorScreen } from './src/screens/EditorScreen';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <EditorScreen />
    </SafeAreaProvider>
  );
}

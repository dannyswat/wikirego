import { SetupRoutes, WikiRoutes } from "./routes";

import './App.css';
import SettingProvider from "./features/setup/SettingProvider";
import { ThemeProvider } from "./contexts/ThemeProvider";

export default function App() {
  return (
    <SettingProvider setup={<SetupRoutes />}>
      <ThemeProvider>
        <WikiRoutes />
      </ThemeProvider>
    </SettingProvider>
  );
}

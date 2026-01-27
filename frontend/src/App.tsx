import { Routes, Route } from "react-router-dom";
import { AppShell } from "@/layouts/AppShell";
import { ServerListPage } from "@/components/server/ServerListPage";
import { LoginPage } from "@/components/auth/LoginPage";
import { SessionPickerPage } from "@/components/terminal/SessionPickerPage";
import { TerminalPage } from "@/components/terminal/TerminalPage";

function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<ServerListPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/sessions" element={<SessionPickerPage />} />
        <Route path="/terminal" element={<TerminalPage />} />
      </Route>
    </Routes>
  );
}

export default App;

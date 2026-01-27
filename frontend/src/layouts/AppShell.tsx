import { useDeviceClass } from "@/hooks/useDeviceClass";
import { MobileLayout } from "./MobileLayout";
import { TabletLayout } from "./TabletLayout";
import { DesktopLayout } from "./DesktopLayout";

export function AppShell() {
  const deviceClass = useDeviceClass();

  switch (deviceClass) {
    case "mobile":
      return <MobileLayout />;
    case "tablet":
      return <TabletLayout />;
    case "desktop":
      return <DesktopLayout />;
  }
}

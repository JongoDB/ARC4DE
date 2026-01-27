import { useState, useEffect } from "react";
import type { DeviceClass } from "@/types";

const TABLET_MIN = 768;
const DESKTOP_MIN = 1200;

function getDeviceClass(width: number): DeviceClass {
  if (width >= DESKTOP_MIN) return "desktop";
  if (width >= TABLET_MIN) return "tablet";
  return "mobile";
}

export function useDeviceClass(): DeviceClass {
  const [deviceClass, setDeviceClass] = useState<DeviceClass>(() =>
    getDeviceClass(window.innerWidth),
  );

  useEffect(() => {
    function handleResize() {
      setDeviceClass(getDeviceClass(window.innerWidth));
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return deviceClass;
}

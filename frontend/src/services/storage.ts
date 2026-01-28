import { get, set } from "idb-keyval";
import type { ServerConfig } from "@/types";

const SERVERS_KEY = "arc4de-servers";

export async function loadServers(): Promise<ServerConfig[]> {
  return (await get<ServerConfig[]>(SERVERS_KEY)) ?? [];
}

export async function saveServers(servers: ServerConfig[]): Promise<void> {
  await set(SERVERS_KEY, servers);
}

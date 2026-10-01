import { headers } from "next/headers";
import { redirect } from "next/navigation";
import WorkspaceClient from "./client";

export const dynamic = "force-dynamic";

export default async function Workspace() {
  const cookie = (await headers()).get("cookie") || "";
  let authorized = false;
  try {
    const backend = process.env.MEDATLAS_BACKEND_URL || "http://127.0.0.1:8765";
    const response = await fetch(`${backend}/api/auth/status`, { headers: { cookie }, cache: "no-store" });
    authorized = response.ok && Boolean((await response.json()).profile);
  } catch { /* Keep the medical workspace closed while the backend is unavailable. */ }
  if (!authorized) redirect("/");
  return <WorkspaceClient />;
}

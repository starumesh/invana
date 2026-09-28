import { ensureCameraFile } from "./camera";

export default async function globalSetup() {
  await ensureCameraFile();
}

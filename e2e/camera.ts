import { copyFileSync, existsSync } from "node:fs";
import { qrCameraFile } from "./fixtures";

/** Chromium reads this file when a page opens the camera; tests rewrite it per scan. */
export const CAMERA_FILE = "/tmp/invana-e2e-camera.y4m";

export async function showQr(payload: string) {
  copyFileSync(await qrCameraFile(payload), CAMERA_FILE);
}

export async function ensureCameraFile() {
  if (!existsSync(CAMERA_FILE)) await showQr("placeholder");
}

export const cameraLaunchArgs = [
  "--use-fake-ui-for-media-stream",
  "--use-fake-device-for-media-stream",
  `--use-file-for-fake-video-capture=${CAMERA_FILE}`,
];

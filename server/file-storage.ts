import fs from "node:fs";
import path from "node:path";

// A mounted disk keeps uploads across releases. Existing files are never replaced.
export const dataDirectory = path.resolve(process.env.DATA_DIR || process.cwd());

function prepareDirectory(name: string) {
  const destination = path.join(dataDirectory, name);
  fs.mkdirSync(destination, { recursive: true, mode: 0o700 });
  const source = path.join(process.cwd(), name);
  if (source !== destination && fs.existsSync(source)) {
    fs.cpSync(source, destination, { recursive: true, force: false, errorOnExist: false });
  }
  return destination;
}

export const uploadsDirectory = prepareDirectory("uploads");
export const fitForDutyPhotosDirectory = prepareDirectory("private_fit_for_duty_photos");
export const incidentEvidenceDirectory = prepareDirectory("private_incident_evidence");

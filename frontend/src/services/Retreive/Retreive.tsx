import { application_service_url } from "@/config/config";

export async function renameDetection(datasetId: string, name: string) {
  const response = await fetch(`${application_service_url}/rename-detection`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataset_id: datasetId, name }),
  });
  if (!response.ok) throw new Error(`Failed to rename: ${response.statusText}`);
  return await response.json();
}

export async function getDetections() {
  try {
    const response = await fetch(`${application_service_url}/get-all-detections`, {
      method: "GET",
    });
    if (!response.ok) throw new Error(`Failed to detect: ${response.statusText}`);
    return await response.json();
  } catch (error) {
    console.error("Error during error detection:", error);
    throw error;
  }
}

export async function getDataset(datasetId: string) {
  try {
    const url = `${application_service_url}/get-dataset?dataset_id=${encodeURIComponent(datasetId)}`;
    const response = await fetch(url, { method: "GET" });
    if (!response.ok) throw new Error(`Failed to detect: ${response.statusText}`);
    return await response.json();
  } catch (error) {
    console.error("Error during error detection:", error);
    throw error;
  }
}

export async function getAttribute(datasetId: string) {
  try {
    const url = `${application_service_url}/get-attribute-errors?dataset_id=${encodeURIComponent(datasetId)}`;
    const response = await fetch(url, { method: "GET" });
    if (!response.ok) throw new Error(`Failed to detect: ${response.statusText}`);
    return await response.json();
  } catch (error) {
    console.error("Error during error detection:", error);
    throw error;
  }
}

export async function getDependencies(datasetId: string) {
  try {
    const url = `${application_service_url}/get-dependencies?dataset_id=${encodeURIComponent(datasetId)}`;
    const response = await fetch(url, { method: "GET" });
    if (!response.ok) throw new Error(`Failed to detect: ${response.statusText}`);
    return await response.json();
  } catch (error) {
    console.error("Error during error detection:", error);
    throw error;
  }
}

export async function getDepViolations(datasetId: string) {
  try {
    const url = `${application_service_url}/get-dependency-violation-errors?dataset_id=${encodeURIComponent(datasetId)}`;
    const response = await fetch(url, { method: "GET" });
    if (!response.ok) throw new Error(`Failed to detect: ${response.statusText}`);
    return await response.json();
  } catch (error) {
    console.error("Error during error detection:", error);
    throw error;
  }
}

export async function getCombined(datasetId: string) {
  try {
    const url = `${application_service_url}/get-combined-errors?dataset_id=${encodeURIComponent(datasetId)}`;
    const response = await fetch(url, { method: "GET" });
    if (!response.ok) throw new Error(`Failed to detect: ${response.statusText}`);
    return await response.json();
  } catch (error) {
    console.error("Error during error detection:", error);
    throw error;
  }
}

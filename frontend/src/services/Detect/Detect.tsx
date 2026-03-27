import { application_service_url } from "@/config/config";

export async function detectAttributeErrors(datasetId: string) {
  const formData = new FormData();
  formData.append("dataset_id", datasetId);

  try {
    const response = await fetch(
      `${application_service_url}/detect-attribute-errors`,
      { method: "POST", body: formData }
    );
    if (!response.ok) throw new Error(`Failed to detect: ${response.statusText}`);
    return await response.json();
  } catch (error) {
    console.error("Error during error detection:", error);
    throw error;
  }
}

export async function detectDependencies(datasetId: string) {
  const formData = new FormData();
  formData.append("dataset_id", datasetId);

  try {
    const response = await fetch(
      `${application_service_url}/detect-dependencies`,
      { method: "POST", body: formData }
    );
    if (!response.ok) throw new Error(`Failed to detect: ${response.statusText}`);
    return await response.json();
  } catch (error) {
    console.error("Error during dependency detection:", error);
    throw error;
  }
}

export async function detectDepViolations(datasetId: string) {
  const formData = new FormData();
  formData.append("dataset_id", datasetId);

  try {
    const response = await fetch(
      `${application_service_url}/detect-dependency-violations`,
      { method: "POST", body: formData }
    );
    if (!response.ok) throw new Error(`Failed to detect: ${response.statusText}`);
    return await response.json();
  } catch (error) {
    console.error("Error during dependency violation detection:", error);
    throw error;
  }
}

export async function retreiveCombinedResults(datasetId: string) {
  const formData = new FormData();
  formData.append("dataset_id", datasetId);

  try {
    const response = await fetch(
      `${application_service_url}/detect-combined-errors`,
      { method: "POST", body: formData }
    );
    if (!response.ok) throw new Error(`Failed to detect: ${response.statusText}`);
    return await response.json();
  } catch (error) {
    console.error("Error during combined result retrieval:", error);
    throw error;
  }
}

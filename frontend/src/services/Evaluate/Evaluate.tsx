import { application_service_url } from "@/config/config";

export async function evaluateAttributeErrors(datasetId: string) {
  const formData = new FormData();
  formData.append("dataset_id", datasetId);

  try {
    const response = await fetch(
      `${application_service_url}/evaluate-attribute-errors`,
      { method: "POST", body: formData }
    );
    if (!response.ok) throw new Error(`Failed to detect: ${response.statusText}`);
    return await response.json();
  } catch (error) {
    console.error("Error during error detection:", error);
    throw error;
  }
}

export async function evaluateDepViolations(datasetId: string) {
  const formData = new FormData();
  formData.append("dataset_id", datasetId);

  try {
    const response = await fetch(
      `${application_service_url}/evaluate-dependency-violation-errors`,
      { method: "POST", body: formData }
    );
    if (!response.ok) throw new Error(`Failed to detect: ${response.statusText}`);
    return await response.json();
  } catch (error) {
    console.error("Error during dependency violation detection:", error);
    throw error;
  }
}

export async function evaluateCombinedResults(datasetId: string) {
  const formData = new FormData();
  formData.append("dataset_id", datasetId);

  try {
    const response = await fetch(
      `${application_service_url}/evaluate-combined-errors`,
      { method: "POST", body: formData }
    );
    if (!response.ok) throw new Error(`Failed to detect: ${response.statusText}`);
    return await response.json();
  } catch (error) {
    console.error("Error during combined result retrieval:", error);
    throw error;
  }
}

import { application_service_url } from "@/config/config";

export async function getDetections() {
  try {
    const response = await fetch(
      `${application_service_url}/get-all-detections`,
      {
        method: "GET",
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to detect: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error during error detection:", error);
    throw error;
  }
}

export async function evaluateAttributeErrors(
  datasetName: string,
  timestamp: string
) {
  try {
    const url = `${application_service_url}/evaluate-attribute-errors?dataset_name=${encodeURIComponent(
      datasetName
    )}&timestamp=${encodeURIComponent(timestamp)}`;

    const response = await fetch(url, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error(`Failed to detect: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error during error detection:", error);
    throw error;
  }
}

export async function evaluateDepViolations(
  datasetName: string,
  timestamp: string
) {
  try {
    const url = `${application_service_url}/evaluate-dependency-violation-errors?dataset_name=${encodeURIComponent(
      datasetName
    )}&timestamp=${encodeURIComponent(timestamp)}`;

    const response = await fetch(url, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error(`Failed to detect: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error during dependency violation detection:", error);
    throw error;
  }
}

export async function evaluateCombinedResults(
  datasetName: string,
  timestamp: string
) {
  try {
    const url = `${application_service_url}/evaluate-combined-errors?dataset_name=${encodeURIComponent(
      datasetName
    )}&timestamp=${encodeURIComponent(timestamp)}`;

    const response = await fetch(url, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error(`Failed to detect: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error during combined result retrieval:", error);
    throw error;
  }
}

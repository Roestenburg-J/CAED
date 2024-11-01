import { application_service_url } from "@/config/config";

// async function name(params: type) {}
type DetectParams = {
  file: File;
  datasetName: string;
  timestamp: string;
};

export async function detectAttributeErrors(
  datasetName: string,
  timestamp: string
) {
  const formData = new FormData();
  formData.append("dataset_name", datasetName);
  formData.append("timestamp", timestamp);

  try {
    const response = await fetch(
      `${application_service_url}/detect-attribute-errors`,
      {
        method: "POST",
        body: formData,
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

export async function detectDependencies(
  datasetName: string,
  timestamp: string
) {
  const formData = new FormData();
  formData.append("dataset_name", datasetName);
  formData.append("timestamp", timestamp);

  try {
    const response = await fetch(
      `${application_service_url}/detect-dependencies`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to detect: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error during dependency detection:", error);
    throw error;
  }
}

export async function detectDepViolations(
  datasetName: string,
  timestamp: string
) {
  const formData = new FormData();
  formData.append("dataset_name", datasetName);
  formData.append("timestamp", timestamp);

  try {
    const response = await fetch(
      `${application_service_url}/detect-dependency-violations`,
      {
        method: "POST",
        body: formData,
      }
    );

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

export async function retreiveCombinedResults(
  datasetName: string,
  timestamp: string
) {
  const formData = new FormData();
  formData.append("dataset_name", datasetName);
  formData.append("timestamp", timestamp);

  try {
    const response = await fetch(
      `${application_service_url}/detect-combined-errors`,
      {
        method: "POST",
        body: formData,
      }
    );

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

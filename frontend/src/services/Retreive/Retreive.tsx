import { application_service_url } from "@/config/config";

export async function getDetections(datasetName: string, timestamp: string) {
  try {
    const response = await fetch(
      `${application_service_url}/get-all-detections?dataset_name=${encodeURIComponent(
        datasetName
      )}&timestamp=${encodeURIComponent(timestamp)}`,
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

export async function getDataset(datasetName: string, timestamp: string) {
  try {
    const url = `${application_service_url}/get-dataset?dataset_name=${encodeURIComponent(
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

export async function getAttribute(datasetName: string, timestamp: string) {
  try {
    const url = `${application_service_url}/get-attribute-errors?dataset_name=${encodeURIComponent(
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

export async function getDependencies(datasetName: string, timestamp: string) {
  try {
    const url = `${application_service_url}/get-dependencies?dataset_name=${encodeURIComponent(
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

export async function getDepViolations(datasetName: string, timestamp: string) {
  try {
    const url = `${application_service_url}/get-dependency-violation-errors?dataset_name=${encodeURIComponent(
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

export async function getCombined(datasetName: string, timestamp: string) {
  try {
    const url = `${application_service_url}/get-combined-errors?dataset_name=${encodeURIComponent(
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

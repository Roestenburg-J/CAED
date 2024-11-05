import { application_service_url } from "@/config/config";

type UploadParams = {
  file: File;
  datasetName: string;
};

type UploadEvaluateParams = {
  clean_file: File;
  dirty_file: File;
  datasetName: string;
};

export async function uploadDataset({ file, datasetName }: UploadParams) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("dataset_name", datasetName);

  try {
    const response = await fetch(`${application_service_url}/upload-dataset`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Failed to upload: ${response.statusText}`);
    }

    // Return the parsed JSON data directly if the response is successful
    return await response.json();
  } catch (error) {
    console.error("Error during file upload:", error);
    throw error; // Re-throw to be caught in handleFileChange
  }
}

export async function uploadEvaluateDataset({
  clean_file,
  dirty_file,
  datasetName,
}: UploadEvaluateParams) {
  const formData = new FormData();
  formData.append("clean_file", clean_file);
  formData.append("dirty_file", dirty_file);
  formData.append("dataset_name", datasetName);

  try {
    const response = await fetch(
      `${application_service_url}/upload-evaluation-datasets`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to upload: ${response.statusText}`);
    }

    // Return the parsed JSON data directly if the response is successful
    return await response.json();
  } catch (error) {
    console.error("Error during file upload:", error);
    throw error; // Re-throw to be caught in handleFileChange
  }
}

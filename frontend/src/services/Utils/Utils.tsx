import { application_service_url } from "@/config/config";

type UploadParams = {
  file: File;
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

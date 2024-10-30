import { application_service_url } from "@/config/config";

type UploadParams = {
  file: File;
  datasetName: string;
};

export async function uploadDataset({
  file,
  datasetName,
}: UploadParams): Promise<string> {
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

    const data = await response.json();
    return data.message || "File uploaded successfully";
  } catch (error) {
    console.error("Error during file upload:", error);
    throw error;
  }
}

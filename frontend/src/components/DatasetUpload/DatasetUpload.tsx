import React, { useState } from "react";
import styles from "./DatasetUpload.module.css";

// MUI Imports
import { styled } from "@mui/material/styles";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  FormGroup,
  TextField,
} from "@mui/material";
import LoadingButton from "@mui/lab/LoadingButton";

// Service Imports
import { uploadDataset } from "@/services/Utils/Utils";

const VisuallyHiddenInput = styled("input")({
  clip: "rect(0 0 0 0)",
  clipPath: "inset(50%)",
  height: 1,
  overflow: "hidden",
  position: "absolute",
  bottom: 0,
  left: 0,
  whiteSpace: "nowrap",
  width: 1,
});

const FileUpload: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [detectionSettings, setDetectionSettings] = useState({
    attribute: false,
    dependency: false,
    violations: false,
  });
  const [fileUploadLoading, setFileUploadLoading] = useState(false);

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const selectedFile = event.target.files?.[0];

    // Check if a file is selected before proceeding
    if (!selectedFile) {
      console.error("No file selected");
      setFileUploadLoading(false);
      return;
    }

    setFileUploadLoading(true);
    const fileResponse = await uploadDataset({
      file: selectedFile,
      datasetName: selectedFile.name,
    });

    // Handle fileResponse as needed
    setFileUploadLoading(false);
  };

  const handleCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = event.target;
    setDetectionSettings((prevSettings) => ({
      ...prevSettings,
      [name]: checked,
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    // if (!file || !datasetName) {
    //   setMessage("Please select a file and enter a dataset name");
    //   return;
    // }

    // try {
    //   const responseMessage = await uploadDataset({
    //     file,
    //     datasetName,
    //     detectionSettings,
    //   });
    //   setMessage(responseMessage);
    // } catch (error) {
    //   setMessage("File upload failed");
    // }
  };

  return (
    <Box>
      <form onSubmit={handleSubmit}>
        <LoadingButton
          // size="small"
          // onClick={handleClick}
          startIcon={<UploadFileIcon />}
          loading={fileUploadLoading}
          variant="outlined"
          component="label"
          // disabled
        >
          Upload Dataset
          <VisuallyHiddenInput type="file" onChange={handleFileChange} />
        </LoadingButton>
        {/* <Button
          variant="outlined"
          component="label"
          startIcon={<UploadFileIcon />}
        >
          
        </Button> */}
        <Box>
          <FormGroup className={styles.formgroup}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={detectionSettings.attribute}
                  onChange={handleCheckboxChange}
                  name="attribute"
                />
              }
              label="Attribute Level Detection"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={detectionSettings.dependency}
                  onChange={handleCheckboxChange}
                  name="dependency"
                />
              }
              label="Dependency Detection"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={detectionSettings.violations}
                  onChange={handleCheckboxChange}
                  name="violations"
                />
              }
              label="Dependency Violation Detection"
            />
          </FormGroup>
        </Box>
        <Button type="submit" variant="outlined">
          Detect Errors
        </Button>
      </form>
      {message && <p>{message}</p>}
    </Box>
  );
};

export default FileUpload;

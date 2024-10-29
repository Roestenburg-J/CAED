import React, { useState } from "react";
import styles from "./DatasetUpload.module.css";

import { uploadDataset } from "@/services/Utils/Utils";

import { styled } from "@mui/material/styles";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { Box, Button, TextField } from "@mui/material";
import FormGroup from "@mui/material/FormGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";

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
  const [datasetName, setDatasetName] = useState<string>("");
  const [message, setMessage] = useState<string | null>(null);
  const [detectionSettings, setDetectionSettings] = useState({
    attribute: false,
    dependency: false,
    violations: false,
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setDatasetName(event.target.value);
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
    if (!file || !datasetName) {
      setMessage("Please select a file and enter a dataset name");
      return;
    }

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
        <TextField
          label="Detection Name"
          margin="dense"
          name="name"
          value={datasetName}
          onChange={handleNameChange}
        />
        <Button
          variant="outlined"
          component="label"
          startIcon={<UploadFileIcon />}
        >
          Upload Dataset
          <VisuallyHiddenInput type="file" onChange={handleFileChange} />
        </Button>
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

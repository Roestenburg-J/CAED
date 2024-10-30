import React, { useState } from "react";
import styles from "./DetectionForm.module.css";

// MUI Imports
import { styled } from "@mui/material/styles";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DoneIcon from "@mui/icons-material/Done";
import ErrorIcon from "@mui/icons-material/Error";
import CloseIcon from "@mui/icons-material/Close";
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  FormGroup,
  CircularProgress,
} from "@mui/material";
import LoadingButton from "@mui/lab/LoadingButton";

// Service Imports
import { uploadDataset } from "@/services/Utils/Utils";
import {
  detectAttributeErrors,
  detectDependencies,
  detectDepViolations,
} from "@/services/Detect/Detect";

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

interface DetectionFormProps<T> {
  setAttributeResults: (attributeResults: any) => void;
  setDependencyResults: React.Dispatch<React.SetStateAction<T[]>>;
  setDepViolationResults: React.Dispatch<React.SetStateAction<T[]>>;
  setLoadingStates: React.Dispatch<
    React.SetStateAction<{
      attribute: boolean;
      dependency: boolean;
      violations: boolean;
    }>
  >;
  setRequestedStates: React.Dispatch<
    React.SetStateAction<{
      attribute: boolean;
      dependency: boolean;
      violations: boolean;
    }>
  >;
  setDetectionError: React.Dispatch<
    React.SetStateAction<{
      attribute: boolean;
      dependency: boolean;
      violations: boolean;
    }>
  >;
}

const DetectionForm = <T,>({
  setAttributeResults,
  setDependencyResults,
  setDepViolationResults,
  setLoadingStates,
  setRequestedStates,
  setDetectionError,
}: DetectionFormProps<T>) => {
  const [detectionSettings, setDetectionSettings] = useState({
    attribute: false,
    dependency: false,
    violations: false,
  });
  const [fileUploadLoading, setFileUploadLoading] = useState(false);
  const [fileUploadSuccess, setFileUploadSuccess] = useState(false);
  const [inputError, setInputError] = useState({
    file: false,
    detection: false,
  });
  const [fileResults, setFileResults] = useState({
    dataset_name: "",
    timestamp: "",
  });

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    setFileUploadLoading(true);
    const filenameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, "");

    try {
      const fileResponse = await uploadDataset({
        file: selectedFile,
        datasetName: filenameWithoutExt,
      });
      setFileResults({
        dataset_name: fileResponse.dataset_name,
        timestamp: fileResponse.timestamp,
      });
      setFileUploadSuccess(true);
      setInputError((prev) => ({ ...prev, file: false })); // Reset file error
    } catch (error) {
      console.error("An error occurred during file upload:", error);
      setInputError((prev) => ({ ...prev, file: true }));
    } finally {
      setFileUploadLoading(false);
    }
  };

  const handleCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = event.target;
    setDetectionSettings((prev) => ({ ...prev, [name]: checked }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    // Check for errors
    if (!fileUploadSuccess) {
      setInputError((prev) => ({ ...prev, file: true }));
      return;
    }
    if (
      !detectionSettings.attribute &&
      !detectionSettings.dependency &&
      !detectionSettings.violations
    ) {
      setInputError((prev) => ({ ...prev, detection: true }));
      return;
    }

    // Reset error states
    setDetectionError({
      attribute: false,
      dependency: false,
      violations: false,
    });
    setLoadingStates({
      attribute: false,
      dependency: false,
      violations: false,
    });
    setRequestedStates({
      attribute: false,
      dependency: false,
      violations: false,
    });

    // Execute detection requests based on settings
    const detectionRequests = [
      {
        condition: detectionSettings.attribute,
        action: detectAttributeErrors,
        setResults: setAttributeResults,
        key: "attribute",
      },
      {
        condition: detectionSettings.dependency,
        action: detectDependencies,
        setResults: setDependencyResults,
        key: "dependency",
      },
      {
        condition: detectionSettings.violations,
        action: detectDepViolations,
        setResults: setDepViolationResults,
        key: "violations",
      },
    ];

    for (const request of detectionRequests) {
      if (request.condition) {
        setRequestedStates((prev) => ({
          ...prev,
          [request.key]: true,
        }));
        setLoadingStates((prev) => ({ ...prev, [request.key]: true }));
        try {
          const result = await request.action(
            "hospital_1",
            "20241030_123153"
            // fileResults.dataset_name,
            // fileResults.timestamp
          );
          request.setResults(result);
          console.log(result);
        } catch (error) {
          console.error(`Error detecting ${request.key}:`, error);
          setDetectionError((prev) => ({
            ...prev,
            [request.key]: true,
          }));
        } finally {
          setLoadingStates((prev) => ({
            ...prev,
            [request.key]: false,
          }));
        }
      }
    }
  };

  return (
    <Box>
      <LoadingButton
        loading={fileUploadLoading}
        variant="outlined"
        component="label"
      >
        {fileUploadSuccess ? <DoneIcon /> : <UploadFileIcon />}
        {inputError.file ? <ErrorIcon /> : null}
        Upload Dataset
        <VisuallyHiddenInput type="file" onChange={handleFileChange} />
      </LoadingButton>
      <Button
        variant="outlined"
        color="error"
        onClick={() => setFileUploadSuccess(false)}
      >
        <CloseIcon />
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
      <Button type="submit" variant="outlined" onClick={handleSubmit}>
        Detect Errors
      </Button>
      {inputError.file && (
        <p className={styles.errorMessage}>Please upload a file.</p>
      )}
      {inputError.detection && (
        <p className={styles.errorMessage}>
          Please select at least one detection option.
        </p>
      )}
    </Box>
  );
};

export default DetectionForm;

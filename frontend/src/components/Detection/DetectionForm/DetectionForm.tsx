import React, { useState } from "react";
import styles from "./DetectionForm.module.css";
import Papa from "papaparse";
import * as XLSX from "xlsx";

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
  Typography,
  Alert,
  Tooltip,
} from "@mui/material";
import LoadingButton from "@mui/lab/LoadingButton";

// import {  } from "@mui/material";

// Service Imports
import { uploadDataset } from "@/services/Utils/Utils";
import {
  detectAttributeErrors,
  detectDependencies,
  detectDepViolations,
  retreiveCombinedResults,
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
  setDependencyResults: (dependencyResults: any) => void;
  setDepViolationResults: (depViolationResults: any) => void;
  setCombinedOutput: (combinedOutput: any) => void;
  setDataset: (dataset: any) => void;
  setLoadingStates: React.Dispatch<
    React.SetStateAction<{
      attribute: boolean;
      dependency: boolean;
      violations: boolean;
      combined: boolean; // Added combined loading state
    }>
  >;
  setRequestedStates: React.Dispatch<
    React.SetStateAction<{
      attribute: boolean;
      dependency: boolean;
      violations: boolean;
      combined: boolean; // Added combined requested state
    }>
  >;
  setDetectionError: React.Dispatch<
    React.SetStateAction<{
      attribute: boolean;
      dependency: boolean;
      violations: boolean;
      combined: boolean; // Added combined error state
    }>
  >;
}

const DetectionForm = <T,>({
  setAttributeResults,
  setDependencyResults,
  setDepViolationResults,
  setCombinedOutput,
  setLoadingStates,
  setRequestedStates,
  setDetectionError,
  setDataset,
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
    const fileExtension = selectedFile.name.split(".").pop()?.toLowerCase();

    try {
      // const fileResponse = await uploadDataset({
      //   file: selectedFile,
      //   datasetName: filenameWithoutExt,
      // });
      const fileResponse = {
        dataset_name: "hospital_1",
        timestamp: "20241030_123153",
      };
      setFileResults({
        dataset_name: fileResponse.dataset_name,
        timestamp: fileResponse.timestamp,
      });
      setFileUploadSuccess(true);
      setInputError((prev) => ({ ...prev, file: false })); // Reset file error

      let parsedData;

      // Parsing logic based on file type
      if (fileExtension === "csv") {
        const fileContent = await selectedFile.text();
        parsedData = Papa.parse(fileContent, {
          header: true,
          skipEmptyLines: true,
        }).data;
      } else if (fileExtension === "json") {
        const fileContent = await selectedFile.text();
        parsedData = JSON.parse(fileContent);
      } else if (fileExtension === "xlsx" || fileExtension === "xls") {
        const arrayBuffer = await selectedFile.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        parsedData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
      } else {
        throw new Error("Unsupported file type");
      }

      setDataset(parsedData); // Set parsed data for frontend use
    } catch (error) {
      console.error("An error occurred during file processing:", error);
      setInputError((prev) => ({ ...prev, file: true }));
    } finally {
      setFileUploadLoading(false);
    }
  };

  const handleCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = event.target;

    setDetectionSettings((prev) => ({
      ...prev,
      [name]: checked,
      ...(name === "violations" && checked ? { dependency: true } : {}),
    }));
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
      combined: false, // Reset combined error state
    });
    setLoadingStates({
      attribute: false,
      dependency: false,
      violations: false,
      combined: false, // Reset combined loading state
    });
    setRequestedStates({
      attribute: false,
      dependency: false,
      violations: false,
      combined: false, // Reset combined requested state
    });

    // Prepare detection requests with actions and keys
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
      {
        condition:
          detectionSettings.attribute &&
          detectionSettings.dependency &&
          detectionSettings.violations,
        action: retreiveCombinedResults,
        setResults: setCombinedOutput,
        key: "combined",
      },
    ];

    // Create an array of promises based on conditions
    const promises = detectionRequests
      .filter((request) => request.condition) // Filter out requests that are not needed
      .map((request) => {
        setRequestedStates((prev) => ({
          ...prev,
          [request.key]: true,
        }));
        setLoadingStates((prev) => ({ ...prev, [request.key]: true }));

        // Return an object containing both the key and the promise
        return {
          key: request.key,
          promise: request
            .action(fileResults.dataset_name, fileResults.timestamp)
            .then((result) => {
              request.setResults(result);
              // console.log(result);
            })
            .catch((error) => {
              console.error(`Error detecting ${request.key}:`, error);
              setDetectionError((prev) => ({
                ...prev,
                [request.key]: true,
              }));
            })
            .finally(() => {
              setLoadingStates((prev) => ({
                ...prev,
                [request.key]: false,
              }));
            }),
        };
      });

    // Find the dependency detection promise
    const dependencyRequest = promises.find((req) => req.key === "dependency");

    // If dependency detection is needed and succeeded, execute violation detection
    if (dependencyRequest) {
      try {
        await dependencyRequest.promise; // Wait for dependency detection to complete successfully

        // If violation detection is needed, execute it after dependency detection completes
        if (detectionSettings.violations) {
          const violationPromise = detectDepViolations(
            fileResults.dataset_name,
            fileResults.timestamp
          )
            .then((result) => {
              setDepViolationResults(result);
              // console.log(result);
            })
            .catch((error) => {
              console.error(`Error detecting violations:`, error);
              setDetectionError((prev) => ({
                ...prev,
                violations: true,
              }));
            })
            .finally(() => {
              setLoadingStates((prev) => ({
                ...prev,
                violations: false,
              }));
            });
          promises.push({ key: "violations", promise: violationPromise });
        }
      } catch (error) {
        console.error("Dependency Detection failed:", error);
        setDetectionError((prev) => ({
          ...prev,
          dependency: true,
        }));
      }
    }

    // Execute all other concurrent requests
    await Promise.all(promises.map((req) => req.promise));

    // Handle the combined results detection
    const combinedRequest = promises.find((req) => req.key === "combined");
    if (combinedRequest) {
      setRequestedStates((prev) => ({ ...prev, combined: true }));
      setLoadingStates((prev) => ({ ...prev, combined: true }));
      try {
        await combinedRequest.promise; // Wait for combined results to complete successfully
      } catch (error) {
        console.error("Combined Detection failed:", error);
        setDetectionError((prev) => ({
          ...prev,
          combined: true,
        }));
      } finally {
        setLoadingStates((prev) => ({
          ...prev,
          combined: false,
        }));
      }
    }
  };

  return (
    <Box className={styles.container}>
      <Box className={styles.uploadInput}>
        <LoadingButton
          loading={fileUploadLoading}
          variant="outlined"
          component="label"
          // color={inputError.file ? "error" : "primary"}
        >
          {fileUploadSuccess ? <DoneIcon /> : null}
          {inputError.file ? <ErrorIcon /> : null}
          {!inputError.file && !fileUploadSuccess ? <UploadFileIcon /> : null}
          Upload Dataset
          <VisuallyHiddenInput type="file" onChange={handleFileChange} />
        </LoadingButton>

        <Box color={inputError.detection ? "error" : "primary"}>
          <FormControlLabel
            control={
              <Checkbox
                className={styles.checkbox}
                checked={detectionSettings.attribute}
                onChange={handleCheckboxChange}
                name="attribute"
              />
            }
            label="Attribute Level"
          />

          <FormControlLabel
            control={
              <Checkbox
                className={styles.checkbox}
                checked={detectionSettings.dependency}
                onChange={handleCheckboxChange}
                name="dependency"
              />
            }
            label="Dependencies"
          />
          <FormControlLabel
            control={
              <Checkbox
                className={styles.checkbox}
                checked={detectionSettings.violations}
                onChange={handleCheckboxChange}
                name="violations"
              />
            }
            label="Dependency Violations"
          />
        </Box>
        {/* </FormGroup> */}

        <Button
          variant="outlined"
          onClick={() => setFileUploadSuccess(false)}
          className={styles.cancel}
        >
          <CloseIcon />
        </Button>
        <Button type="submit" variant="outlined" onClick={handleSubmit}>
          Detect Errors
        </Button>
        {/* {inputError.file || inputError.detection ? (
          <Tooltip
            title={
              inputError.file
                ? "Please upload a dataset."
                : " Please select at least one detection option."
            }
            arrow
          >
            <ErrorIcon
              color="error"
              style={{ marginLeft: 5, cursor: "pointer" }}
            />
          </Tooltip>
        ) : null} */}
      </Box>

      {/* <Box className={styles.feedback}>
        {inputError.file && (
          <Alert variant="outlined" severity="error" className={styles.alert}>
            Please upload a dataset.
          </Alert>
        )}
        {inputError.detection && (
          <Alert severity="error" variant="outlined" className={styles.alert}>
            Please select at least one detection option.
          </Alert>

          // <Box className={styles.feedbackBox}>
          //   <Typography>
          //     Please select at least one detection option.
          //   </Typography>
          // </Box>
        )}
      </Box> */}
    </Box>
  );
};

export default DetectionForm;

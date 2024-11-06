import React, { useEffect, useState } from "react";
import styles from "./EvaluateForm.module.css";
import Papa from "papaparse";
import * as XLSX from "xlsx";

// MUI Imports
import { styled } from "@mui/material/styles";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DoneIcon from "@mui/icons-material/Done";
import ErrorIcon from "@mui/icons-material/Error";
import { Box, Button, Checkbox, FormControlLabel } from "@mui/material";
import LoadingButton from "@mui/lab/LoadingButton";

// Service Imports
import { uploadEvaluateDataset } from "@/services/Utils/Utils";
import {
  evaluateAttributeErrors,
  evaluateCombinedResults,
  evaluateDepViolations,
} from "@/services/Evaluate/Evaluate";
import {
  getDataset,
  getAttribute,
  getDependencies,
  getDepViolations,
  getCombined,
} from "@/services/Retreive/Retreive";
import { detectDependencies } from "@/services/Detect/Detect";
import { useTheme, Theme } from "@mui/material/styles";
import { useSearchParams } from "next/navigation";

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

interface EvaluateFormProps<T> {
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
      combined: boolean;
    }>
  >;
  setRequestedStates: React.Dispatch<
    React.SetStateAction<{
      attribute: boolean;
      dependency: boolean;
      violations: boolean;
      combined: boolean;
    }>
  >;
  setDetectionError: React.Dispatch<
    React.SetStateAction<{
      attribute: boolean;
      dependency: boolean;
      violations: boolean;
      combined: boolean;
    }>
  >;
}

const EvaluateForm = <T,>({
  setAttributeResults,
  setDependencyResults,
  setDepViolationResults,
  setCombinedOutput,
  setLoadingStates,
  setRequestedStates,
  setDetectionError,
  setDataset,
}: EvaluateFormProps<T>) => {
  const searchParams = useSearchParams();
  const theme = useTheme();

  const dataset_name = searchParams.get("dataset_name");
  const timestamp = searchParams.get("timestamp");

  const attribute_string = searchParams.get("attribute");
  const dep_string = searchParams.get("attribute");
  const dep_viol_string = searchParams.get("attribute");

  const attribute = attribute_string == "true" ? true : false;
  const dep = dep_string == "true" ? true : false;
  const depViol = dep_viol_string == "true" ? true : false;

  const [detectionSettings, setDetectionSettings] = useState({
    attribute: false,
    dependency: false,
    violations: false,
  });

  const [fileUploadState, setFileUploadState] = useState({
    dirty: { loading: false, success: false, error: false },
    clean: { loading: false, success: false, error: false },
  });

  const [uploadedFiles, setUploadedFiles] = useState({
    dirty: null,
    clean: null,
  });

  const [fileResults, setFileResults] = useState({
    dataset_name: "",
    timestamp: "",
  });

  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>,
    type: "dirty" | "clean"
  ) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    setUploadedFiles((prev) => ({
      ...prev,
      [type]: selectedFile, // Store the selected file for later processing
    }));

    // Update the file upload state
    setFileUploadState((prev) => ({
      ...prev,
      [type]: { loading: false, success: true, error: false },
    }));
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

    // Check for errors before proceeding
    if (!uploadedFiles.dirty || !uploadedFiles.clean) {
      console.error("Both files must be uploaded.");
      return;
    }
    if (
      !detectionSettings.attribute &&
      !detectionSettings.dependency &&
      !detectionSettings.violations
    ) {
      console.error("At least one detection option must be selected.");
      return;
    }

    // Reset error states
    setDetectionError({
      attribute: false,
      dependency: false,
      violations: false,
      combined: false,
    });
    setLoadingStates({
      attribute: false,
      dependency: false,
      violations: false,
      combined: false,
    });
    setRequestedStates({
      attribute: false,
      dependency: false,
      violations: false,
      combined: false,
    });

    // Handle file uploads and parsing
    const { dirty, clean } = uploadedFiles;

    try {
      setFileUploadState((prev) => ({
        ...prev,
        dirty: { ...prev.dirty, loading: true },
        clean: { ...prev.clean, loading: true },
      }));

      // Get file names without extensions
      const dirtyFileName = dirty.name.replace(/\.[^/.]+$/, "");
      // const cleanFileName = clean.name.replace(/\.[^/.]+$/, "");

      // Upload the datasets
      // const fileResponse = await uploadEvaluateDataset({
      //   dirty_file: dirty,
      //   clean_file: clean,
      //   datasetName: `${dirtyFileName}`,
      // });

      // setFileResults({
      //   dataset_name: fileResponse.dataset_name,
      //   timestamp: fileResponse.timestamp,
      // });
      setFileResults({
        dataset_name: "hospital",
        timestamp: "20241104_172717",
      });

      // Parse both files based on their type
      const dirtyData = await parseFile(dirty);
      const cleanData = await parseFile(clean);

      // Store parsed datasets
      setDataset(dirtyData);

      console.log("Both files uploaded and processed successfully.");
    } catch (error) {
      console.error("An error occurred during file processing:", error);
      setFileUploadState((prev) => ({
        dirty: { loading: false, success: false, error: true },
        clean: { loading: false, success: false, error: true },
      }));
      return;
    } finally {
      setFileUploadState((prev) => ({
        dirty: { ...prev.dirty, loading: false },
        clean: { ...prev.clean, loading: false },
      }));
    }

    // Prepare detection requests
    const detectionRequests = [
      {
        condition: detectionSettings.attribute,
        action: evaluateAttributeErrors,
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
        action: evaluateDepViolations,
        setResults: setDepViolationResults,
        key: "violations",
      },
      {
        condition:
          detectionSettings.attribute &&
          detectionSettings.dependency &&
          detectionSettings.violations,
        action: evaluateCombinedResults,
        setResults: setCombinedOutput,
        key: "combined",
      },
    ];

    const promises = detectionRequests
      .filter((request) => request.condition)
      .map((request) => {
        setRequestedStates((prev) => ({
          ...prev,
          [request.key]: true,
        }));
        setLoadingStates((prev) => ({ ...prev, [request.key]: true }));

        return {
          key: request.key,
          promise: request
            .action(fileResults.dataset_name, fileResults.timestamp)
            .then((result) => {
              request.setResults(result);
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

    // Await all detection promises to complete
    await Promise.all(promises.map((p) => p.promise));
  };

  const parseFile = async (file: File) => {
    const fileExtension = file.name.split(".").pop()?.toLowerCase();
    let parsedData;

    // Parsing logic based on file type
    if (fileExtension === "csv") {
      const fileContent = await file.text();
      parsedData = Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
      }).data;
    } else if (fileExtension === "json") {
      const fileContent = await file.text();
      parsedData = JSON.parse(fileContent);
    } else if (fileExtension === "xlsx" || fileExtension === "xls") {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      parsedData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
    } else {
      throw new Error("Unsupported file type");
    }

    return parsedData;
  };

  const fetchData = async (
    datasetName: string,
    timestamp: string,
    attribute: boolean,
    dep: boolean,
    depViol: boolean
  ) => {
    // Set initial loading states based on requested detection types
    setLoadingStates((prev) => ({
      ...prev,
      attribute: attribute,
      dependency: dep,
      violations: depViol,
      combined: attribute && depViol, // Only fetch combined if both attribute and depViol are true
    }));

    try {
      // Step 1: Fetch the dataset first
      const dataset = await getDataset(datasetName, timestamp);

      // Step 2: Sort columns of the dataset based on the schema's index
      const sortedData = dataset.dataset.map((row) => {
        const orderedRow = {};
        // Sort columns based on dataset.schema
        dataset.dataset_schema
          .sort((a, b) => a.index - b.index)
          .forEach(({ name }) => {
            orderedRow[name] = row[name];
          });
        return orderedRow;
      });

      // Set the ordered dataset
      setDataset(sortedData);
      setFileUploadState((prev) => ({
        dirty: { loading: false, success: true, error: false },
        clean: { loading: false, success: true, error: false },
      }));

      // Step 3: Prepare parallel fetches for attribute, dependency, and depViolation
      const fetchPromises = [];

      if (attribute) {
        setLoadingStates((prev) => ({ ...prev, attribute: true }));
        setRequestedStates((prev) => ({ ...prev, attribute: true }));
        fetchPromises.push(
          getAttribute(datasetName, timestamp)
            .then((result) => setAttributeResults(result))
            .catch((error) => {
              console.error("Error fetching attribute errors:", error);
              setDetectionError((prev) => ({ ...prev, attribute: true }));
            })
            .finally(() =>
              setLoadingStates((prev) => ({ ...prev, attribute: false }))
            )
        );
      }

      if (dep) {
        setLoadingStates((prev) => ({ ...prev, dependency: true }));
        setRequestedStates((prev) => ({ ...prev, dependency: true }));
        fetchPromises.push(
          getDependencies(datasetName, timestamp)
            .then((result) => setDependencyResults(result))
            .catch((error) => {
              console.error("Error fetching dependencies:", error);
              setDetectionError((prev) => ({ ...prev, dependency: true }));
            })
            .finally(() =>
              setLoadingStates((prev) => ({ ...prev, dependency: false }))
            )
        );
      }

      if (depViol) {
        setLoadingStates((prev) => ({ ...prev, violations: true }));
        setRequestedStates((prev) => ({ ...prev, violations: true }));
        fetchPromises.push(
          getDepViolations(datasetName, timestamp)
            .then((result) => setDepViolationResults(result))
            .catch((error) => {
              console.error("Error fetching dependency violations:", error);
              setDetectionError((prev) => ({ ...prev, violations: true }));
            })
            .finally(() =>
              setLoadingStates((prev) => ({ ...prev, violations: false }))
            )
        );
      }

      // Step 4: Wait for all initial detection fetches to complete
      await Promise.all(fetchPromises);

      // Step 5: Fetch combined results only if both attribute and depViol were requested
      if (attribute && depViol) {
        setLoadingStates((prev) => ({ ...prev, combined: true }));
        setRequestedStates((prev) => ({ ...prev, combined: true }));
        try {
          const combinedResults = await getCombined(datasetName, timestamp);
          setCombinedOutput(combinedResults);
        } catch (error) {
          console.error("Error fetching combined results:", error);
          setDetectionError((prev) => ({ ...prev, combined: true }));
        } finally {
          setLoadingStates((prev) => ({ ...prev, combined: false }));
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      // Set all detection errors if the dataset fetch fails
      setDetectionError({
        attribute: attribute,
        dependency: dep,
        violations: depViol,
        combined: attribute && depViol,
      });
    } finally {
      // Ensure all loading states are reset if something fails
      setLoadingStates({
        attribute: false,
        dependency: false,
        violations: false,
        combined: false,
      });
    }
  };

  useEffect(() => {
    // Check if router.query params exist
    if (dataset_name && timestamp) {
      // Pre-select settings based on query params
      setDetectionSettings({
        attribute: attribute, // Set based on your logic
        dependency: dep, // Set based on your logic
        violations: depViol, // Set based on your logic
      });
      setFileResults({
        dataset_name: dataset_name,
        timestamp: timestamp,
      });

      fetchData(dataset_name, timestamp, attribute, dep, depViol);
    } else {
      setFileUploadState((prev) => ({
        dirty: { loading: false, success: false, error: false },
        clean: { loading: false, success: false, error: false },
      }));
      setDetectionSettings({
        attribute: false,
        dependency: false,
        violations: false,
      });
      setDetectionError({
        attribute: false,
        dependency: false,
        violations: false,
        combined: false,
      });
      setLoadingStates({
        attribute: false,
        dependency: false,
        violations: false,
        combined: false,
      });
      setRequestedStates({
        attribute: false,
        dependency: false,
        violations: false,
        combined: false,
      });
    }
  }, [dataset_name, timestamp, attribute, dep, depViol]);

  return (
    <Box component="form" onSubmit={handleSubmit} className={styles.container}>
      <Box className={styles.uploadInput}>
        <LoadingButton
          loading={fileUploadState.dirty.loading}
          variant="outlined"
          component="label"
          disabled={Boolean(dataset_name)}
          color={
            fileUploadState.dirty.error
              ? theme.palette.error.main
              : theme.palette.primary.main
          }
        >
          {fileUploadState.dirty.success ? <DoneIcon /> : null}
          {fileUploadState.dirty.error ? <ErrorIcon /> : null}
          {!fileUploadState.dirty.error && !fileUploadState.dirty.success ? (
            <UploadFileIcon />
          ) : null}
          Upload Dirty Dataset
          <VisuallyHiddenInput
            type="file"
            onChange={(e) => handleFileChange(e, "dirty")}
          />
        </LoadingButton>

        <LoadingButton
          loading={fileUploadState.clean.loading}
          variant="outlined"
          component="label"
          disabled={Boolean(dataset_name)}
          color={
            fileUploadState.dirty.error
              ? theme.palette.error.main
              : theme.palette.primary.main
          }
        >
          {fileUploadState.clean.success ? <DoneIcon /> : null}
          {fileUploadState.clean.error ? <ErrorIcon /> : null}
          {!fileUploadState.clean.error && !fileUploadState.clean.success ? (
            <UploadFileIcon />
          ) : null}
          Upload Clean Dataset
          <VisuallyHiddenInput
            type="file"
            onChange={(e) => handleFileChange(e, "clean")}
          />
        </LoadingButton>

        <FormControlLabel
          control={
            <Checkbox
              checked={detectionSettings.attribute}
              onChange={handleCheckboxChange}
              name="attribute"
              disabled={Boolean(dataset_name)}
            />
          }
          label="Detect Attribute Errors"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={detectionSettings.dependency}
              onChange={handleCheckboxChange}
              name="dependency"
              disabled={Boolean(dataset_name)}
            />
          }
          label="Detect Dependencies"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={detectionSettings.violations}
              onChange={handleCheckboxChange}
              name="violations"
              disabled={Boolean(dataset_name)}
            />
          }
          label="Detect Violations"
        />
      </Box>
      <Button variant="outlined" type="submit" disabled={Boolean(dataset_name)}>
        Evaluate
      </Button>
    </Box>
  );
};

export default EvaluateForm;

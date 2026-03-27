import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { uploadDataset, uploadCleanDataset, getSettings, updateSettings } from "@/services/Utils/Utils";
import ModelSelector from "@/components/ModelSelector/ModelSelector";
import {
  detectAttributeErrors,
  detectDependencies,
  detectDepViolations,
  retreiveCombinedResults,
} from "@/services/Detect/Detect";
import {
  evaluateAttributeErrors,
  evaluateDepViolations,
  evaluateCombinedResults,
} from "@/services/Evaluate/Evaluate";
import {
  getDataset,
  getAttribute,
  getDependencies,
  getDepViolations,
  getCombined,
} from "@/services/Retreive/Retreive";
import { useSearchParams, useRouter } from "next/navigation";
// NOTE: useSearchParams() is called directly in this component.
// The parent page must wrap this component in a <Suspense> boundary.

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
  const router = useRouter();
  const searchParams = useSearchParams();

  const dataset_id = searchParams.get("dataset_id") ?? "";
  const attribute = searchParams.get("attribute") === "true";
  const dep = searchParams.get("dep") === "true";
  const depViol = searchParams.get("depViol") === "true";

  // Track the previous dataset_id so the else-branch reset only fires when
  // navigating away from a dataset, not on the initial render where
  // searchParams may momentarily resolve to "" before the real value arrives.
  const prevDatasetIdRef = useRef<string | null>(null);

  const [groundTruthLoading, setGroundTruthLoading] = useState(false);
  const [groundTruthError, setGroundTruthError] = useState<string | null>(null);
  const [groundTruthSuccess, setGroundTruthSuccess] = useState(false);

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
    dataset_id: "",
  });

  const [selectedFile, setSelectedFile] = useState<File>();
  const [filename, setFilename] = useState("");

  const [modelName, setModelName] = useState("");
  const [selectedModel, setSelectedModel] = useState("gpt-4o-mini");

  useEffect(() => {
    getSettings()
      .then((data) => {
        setSelectedModel(data.model ?? "gpt-4o-mini");
      })
      .catch(() => {});
  }, []);

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    } else {
      setSelectedFile(file); // Set the selected file
      setFileUploadLoading(false);
      setFileUploadSuccess(true);
    } // Exit if no file is selected

    // Extract file name and extension
    const filenameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
    const fileExtension = file.name.split(".").pop()?.toLowerCase();
    setFilename(filenameWithoutExt);

    try {
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
    await updateSettings({ model: selectedModel });
    const fileResponse = await uploadDataset({
      file: selectedFile,
      datasetName: filename,
    });
    setFileResults({
      dataset_id: fileResponse.dataset_id,
    });
    setFileUploadSuccess(true);
    setInputError((prev) => ({ ...prev, file: false })); // Reset file error

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

    // Reset error, loading, and requested states
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

    if (detectionSettings.attribute && detectionSettings.violations) {
      setLoadingStates((prev) => ({ ...prev, combined: true }));
      setRequestedStates((prev) => ({ ...prev, combined: true }));
    }
    // Prepare detection promises
    const attributePromise = detectionSettings.attribute
      ? (setRequestedStates((prev) => ({ ...prev, attribute: true })),
        setLoadingStates((prev) => ({ ...prev, attribute: true })),
        detectAttributeErrors(fileResponse.dataset_id)
          .then((result) => setAttributeResults(result))
          .catch((error) => {
            console.error("Error detecting attribute:", error);
            setDetectionError((prev) => ({ ...prev, attribute: true }));
          })
          .finally(() =>
            setLoadingStates((prev) => ({ ...prev, attribute: false }))
          ))
      : Promise.resolve();

    const dependencyPromise = detectionSettings.dependency
      ? (setRequestedStates((prev) => ({ ...prev, dependency: true })),
        setLoadingStates((prev) => ({ ...prev, dependency: true })),
        detectDependencies(fileResponse.dataset_id)
          .then((result) => setDependencyResults(result))
          .catch((error) => {
            console.error("Error detecting dependency:", error);
            setDetectionError((prev) => ({ ...prev, dependency: true }));
          })
          .finally(() =>
            setLoadingStates((prev) => ({ ...prev, dependency: false }))
          ))
      : Promise.resolve();

    // Violation detection: start loading if checked, run after dependency completes
    let violationPromise = Promise.resolve();
    if (detectionSettings.violations) {
      setRequestedStates((prev) => ({ ...prev, violations: true }));
      setLoadingStates((prev) => ({ ...prev, violations: true }));
      violationPromise = dependencyPromise.then(() =>
        detectDepViolations(fileResponse.dataset_id)
          .then((result) => setDepViolationResults(result))
          .catch((error) => {
            console.error("Error detecting violations:", error);
            setDetectionError((prev) => ({ ...prev, violations: true }));
          })
          .finally(() =>
            setLoadingStates((prev) => ({ ...prev, violations: false }))
          )
      );
    }

    // Combined detection: only after attribute, dependency, and violations complete if all are checked
    const combinedPromise = Promise.all([
      detectionSettings.attribute ? attributePromise : Promise.resolve(),
      detectionSettings.dependency ? dependencyPromise : Promise.resolve(),
      detectionSettings.violations ? violationPromise : Promise.resolve(),
    ]).then(() => {
      if (
        detectionSettings.attribute &&
        detectionSettings.dependency &&
        detectionSettings.violations
      ) {
        setRequestedStates((prev) => ({ ...prev, combined: true }));
        setLoadingStates((prev) => ({ ...prev, combined: true }));
        return retreiveCombinedResults(fileResponse.dataset_id)
          .then((result) => setCombinedOutput(result))
          .catch((error) => {
            console.error("Combined Detection failed:", error);
            setDetectionError((prev) => ({ ...prev, combined: true }));
          })
          .finally(() =>
            setLoadingStates((prev) => ({ ...prev, combined: false }))
          );
      }
    });

    // Await all promises
    await Promise.all([
      attributePromise,
      dependencyPromise,
      violationPromise,
      combinedPromise,
    ]);
  };

  const handleGroundTruthUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file || !dataset_id) return;

    setGroundTruthLoading(true);
    setGroundTruthError(null);
    setGroundTruthSuccess(false);

    try {
      // 1. Save clean.csv and flip manifest type to "evaluation"
      await uploadCleanDataset({ dataset_id, clean_file: file });

      // 2. Fire evaluate endpoints for all completed analysis types.
      //    Violations are chained after dependency (same ordering as EvaluateForm).
      const attributePromise = attribute
        ? evaluateAttributeErrors(dataset_id)
        : Promise.resolve();

      const dependencyPromise = dep
        ? detectDependencies(dataset_id)
        : Promise.resolve();

      let violationPromise: Promise<any> = Promise.resolve();
      if (depViol) {
        violationPromise = dependencyPromise.then(() =>
          evaluateDepViolations(dataset_id)
        );
      }

      await Promise.all([attributePromise, dependencyPromise, violationPromise]);

      if (attribute && depViol) {
        await evaluateCombinedResults(dataset_id);
      }

      setGroundTruthSuccess(true);

      // 3. Navigate to the evaluate page — fetchData() there will load
      //    results + metrics via the GET routes (which now include clean.csv).
      router.push(
        `/evaluate?dataset_id=${dataset_id}&attribute=${attribute}&dep=${dep}&depViol=${depViol}`
      );
    } catch (err: any) {
      setGroundTruthError(err?.message ?? "Failed to upload ground truth.");
    } finally {
      setGroundTruthLoading(false);
    }
  };

  const fetchData = useCallback(async (
    datasetId: string,
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
      const dataset = await getDataset(datasetId);
      setModelName(dataset.model);

      // Step 2: Sort columns of the dataset based on the schema's index
      const sortedData = dataset.dataset.map((row: Record<string, any>) => {
        const orderedRow: Record<string, any> = {};
        dataset.dataset_schema
          .sort(
            (a: { index: number }, b: { index: number }) => a.index - b.index
          )
          .forEach(({ name }: { name: string }) => {
            orderedRow[name] = row[name];
          });
        return orderedRow;
      });

      // Set the ordered dataset
      setDataset(sortedData);
      setFileUploadSuccess(true);

      // Step 3: Prepare parallel fetches for attribute, dependency, and depViolation
      const fetchPromises: Promise<void>[] = [];

      if (attribute) {
        setLoadingStates((prev) => ({ ...prev, attribute: true }));
        setRequestedStates((prev) => ({ ...prev, attribute: true }));
        fetchPromises.push(
          getAttribute(datasetId)
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
          getDependencies(datasetId)
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
          getDepViolations(datasetId)
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
          const combinedResults = await getCombined(datasetId);
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
  }, [
    setLoadingStates, setRequestedStates, setDetectionError,
    setAttributeResults, setDependencyResults, setDepViolationResults,
    setCombinedOutput, setDataset,
  ]);

  useEffect(() => {
    if (dataset_id.length > 0) {
      // Real dataset_id present — update settings and fetch results.
      prevDatasetIdRef.current = dataset_id;
      setDetectionSettings({
        attribute: attribute,
        dependency: dep,
        violations: depViol,
      });
      setFileResults({ dataset_id });
      fetchData(dataset_id, attribute, dep, depViol);
    } else if (prevDatasetIdRef.current !== null) {
      // Only reset when navigating *away* from an existing dataset,
      // not on the initial render where searchParams briefly resolves to "".
      prevDatasetIdRef.current = null;
      setFileUploadSuccess(false);
      setDetectionSettings({ attribute: false, dependency: false, violations: false });
      setDetectionError({ attribute: false, dependency: false, violations: false, combined: false });
      setLoadingStates({ attribute: false, dependency: false, violations: false, combined: false });
      setRequestedStates({ attribute: false, dependency: false, violations: false, combined: false });
    }
  }, [dataset_id, attribute, dep, depViol, fetchData]);

  return (
    <Box className={styles.container}>
        <Box className={styles.uploadInput}>
          <LoadingButton
            loading={fileUploadLoading}
            variant="outlined"
            component="label"
            disabled={Boolean(dataset_id)}

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
                  disabled={Boolean(dataset_id)}
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
                  disabled={Boolean(dataset_id)}
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
                  disabled={Boolean(dataset_id)}
                />
              }
              label="Dependency Violations"
            />
          </Box>

          {dataset_id ? (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <Typography color="textDisabled">Model: {modelName}</Typography>
              <LoadingButton
                loading={groundTruthLoading}
                variant="outlined"
                component="label"
                color={groundTruthError ? "error" : groundTruthSuccess ? "success" : "primary"}
              >
                {groundTruthSuccess ? <DoneIcon sx={{ mr: 1 }} /> : <UploadFileIcon sx={{ mr: 1 }} />}
                Add Ground Truth
                <VisuallyHiddenInput
                  type="file"
                  onChange={handleGroundTruthUpload}
                />
              </LoadingButton>
              {groundTruthError && (
                <Alert severity="error" sx={{ mt: 1 }}>{groundTruthError}</Alert>
              )}
            </Box>
          ) : (
            <>
              <ModelSelector
                model={selectedModel}
                onModelChange={setSelectedModel}
              />
              <Button
                type="submit"
                variant="outlined"
                onClick={handleSubmit}
              >
                Detect
              </Button>
            </>
          )}
        </Box>
      </Box>
  );
};

export default DetectionForm;

import React, { useCallback, useEffect, useRef, useState } from "react";
import styles from "./EvaluateForm.module.css";
import Papa from "papaparse";
import * as XLSX from "xlsx";

// MUI Imports
import { styled } from "@mui/material/styles";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DoneIcon from "@mui/icons-material/Done";
import ErrorIcon from "@mui/icons-material/Error";
import {
  Box,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  Typography,
} from "@mui/material";
import LoadingButton from "@mui/lab/LoadingButton";

// Service Imports
import { uploadEvaluateDataset, getSettings, updateSettings } from "@/services/Utils/Utils";
import ModelSelector from "@/components/ModelSelector/ModelSelector";
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

type FileState = {
  dirty: File | null;
  clean: File | null;
};

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
  const theme = useTheme();
  const searchParams = useSearchParams();

  const dataset_id = searchParams.get("dataset_id") ?? "";
  const attribute = searchParams.get("attribute") === "true";
  const dep = searchParams.get("dep") === "true";
  const depViol = searchParams.get("depViol") === "true";

  const prevDatasetIdRef = useRef<string | null>(null);

  const [detectionSettings, setDetectionSettings] = useState({
    attribute: false,
    dependency: false,
    violations: false,
  });

  const [fileUploadState, setFileUploadState] = useState({
    dirty: { loading: false, success: false, error: false },
    clean: { loading: false, success: false, error: false },
  });

  const [uploadedFiles, setUploadedFiles] = useState<FileState>({
    dirty: null,
    clean: null,
  });

  const [fileResults, setFileResults] = useState({
    dataset_id: "",
  });

  const [modelName, setModelName] = useState("");
  const [selectedModel, setSelectedModel] = useState("gpt-4o-mini");

  useEffect(() => {
    getSettings()
      .then((data) => {
        setSelectedModel(data.model ?? "gpt-4o-mini");
      })
      .catch(() => {});
  }, []);

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
    await updateSettings({ model: selectedModel });
    if (!uploadedFiles.dirty || !uploadedFiles.clean) {
      console.error("Both files must be uploaded.");
      return;
    }
    const { dirty, clean } = uploadedFiles;
    const dirtyFileName = dirty.name.replace(/\.[^/.]+$/, "");

    const fileResponse = await uploadEvaluateDataset({
      dirty_file: dirty,
      clean_file: clean,
      datasetName: `${dirtyFileName}`,
    });
    setFileResults({
      dataset_id: fileResponse.dataset_id,
    });
    const dirtyData = await parseFile(dirty);
    const cleanData = await parseFile(clean);
    setDataset(dirtyData);
    setFileUploadState((prev) => ({
      dirty: { ...prev.dirty, loading: false },
      clean: { ...prev.clean, loading: false },
    }));

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
        evaluateAttributeErrors(fileResponse.dataset_id)
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
        evaluateDepViolations(fileResponse.dataset_id)
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
        return evaluateCombinedResults(fileResponse.dataset_id)
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
      setFileUploadState((prev) => ({
        dirty: { loading: false, success: true, error: false },
        clean: { loading: false, success: true, error: false },
      }));

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
      setFileUploadState((prev) => ({
        dirty: { loading: false, success: false, error: false },
        clean: { loading: false, success: false, error: false },
      }));
      setDetectionSettings({ attribute: false, dependency: false, violations: false });
      setDetectionError({ attribute: false, dependency: false, violations: false, combined: false });
      setLoadingStates({ attribute: false, dependency: false, violations: false, combined: false });
      setRequestedStates({ attribute: false, dependency: false, violations: false, combined: false });
    }
  }, [dataset_id, attribute, dep, depViol, fetchData]);

  return (
    <Box
      component="form"
      className={styles.container}
    >
        <Box className={styles.uploadInput}>
          <LoadingButton
            loading={fileUploadState.dirty.loading}
            variant="outlined"
            component="label"
            disabled={Boolean(dataset_id)}
            sx={{
              color: fileUploadState.dirty.error
                ? theme.palette.error.main
                : theme.palette.primary.main,
              borderColor: fileUploadState.dirty.error
                ? theme.palette.error.main
                : theme.palette.primary.main,
            }}
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
            disabled={Boolean(dataset_id)}
            sx={{
              color: fileUploadState.dirty.error
                ? theme.palette.error.main
                : theme.palette.primary.main,
              borderColor: fileUploadState.dirty.error
                ? theme.palette.error.main
                : theme.palette.primary.main,
            }}
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
                disabled={Boolean(dataset_id)}
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
                disabled={Boolean(dataset_id)}
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
                disabled={Boolean(dataset_id)}
              />
            }
            label="Detect Violations"
          />
        </Box>
        {dataset_id ? (
          <Typography color="textDisabled">Model: {modelName}</Typography>
        ) : (
          <ModelSelector
            model={selectedModel}
            onModelChange={setSelectedModel}
          />
        )}
      </Box>
  );
};

export default EvaluateForm;

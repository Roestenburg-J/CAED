"use client";
import React, { useState } from "react";
import styles from "./page.module.css";

import { Box, Grid2 } from "@mui/material";
// import { styled } from "@mui/material/styles";
// import UploadFileIcon from "@mui/icons-material/UploadFile";

// import Table from "@mui/material/Table";
// import TableBody from "@mui/material/TableBody";
// import TableCell from "@mui/material/TableCell";
// import TableContainer from "@mui/material/TableContainer";
// import TableHead from "@mui/material/TableHead";
// import TableRow from "@mui/material/TableRow";
// import Paper from "@mui/material/Paper";

// Component Imports
import EvaluateForm from "@/components/Evaluate/EvaluateForm/EvaluateForm";
import EvaluateAttribute from "@/components/Evaluate/EvaluateAttribute/EvaluateAttribute";
import DetectionDep from "@/components/Detect/DetectionDep/DetectionDep";
import EvaluateDepViol from "@/components/Evaluate/EvaluateDepViol/EvaluateDepViol";
import EvaluateAnnotatedTable from "@/components/EvaluateAnnotatedTable/EvaluateAnnotatedTable";
import AnnotatedTable from "@/components/AnnotatedTable/AnnotatedTable";

interface PromptMetadata {
  completion_tokens: number;
  elapsed_time: string;
  prompt_name: string;
  prompt_tokens: number;
  total_tokens: number;
}

interface ErrorAnnotation {
  [key: string]: number; // Allows for a flexible structure with any string keys
}

interface DatasetSchema {
  index: number;
  name: string;
}

interface AttributeColumnSummary {
  column: string;
  error_count: number;
}

interface ClassOutput {
  [key: string]: number | string; // Allows for a flexible structure with any string keys
}

interface AttributeResult {
  annotated_output: ErrorAnnotation[]; // Allows for a flexible structure with any string keys
  prompt_metadata: PromptMetadata[];
  dataset_schema: DatasetSchema[];
  true_positives: ClassOutput[];
  false_positives: ClassOutput[];
  false_negatives: ClassOutput[];
  column_summary: AttributeColumnSummary[];
  dataset_size: number;
  metrics: {
    accuracy: string;
    precision: string;
    recall: string;
    f_score: string;
  };
}

interface Dependencies {
  column_1: number;
  column_1_name: string;
  column_2: number;
  column_2_name: string;
  dependency: string;
}

interface DependencyResults {
  prompt_metadata: PromptMetadata[];
  dataset_schema: DatasetSchema[];
  dependencies: Dependencies[];
}

interface PromptMetadata {
  completion_tokens: number;
  elapsed_time: string;
  prompt_name: string;
  prompt_tokens: number;
  total_tokens: number;
}

interface ColumnSummary {
  column_1_count: number;
  column_1_name: string;
  column_2_count: number;
  column_2_name: string;
  dependency: string;
}

interface DepViolationResult {
  annotated_output: ErrorAnnotation[]; // Allows for a flexible structure with any string keys
  prompt_metadata: PromptMetadata[];
  column_summary: ColumnSummary[];
  true_positives: ClassOutput[];
  false_positives: ClassOutput[];
  false_negatives: ClassOutput[];
  dataset_size: number;
  metrics: {
    accuracy: string;
    precision: string;
    recall: string;
    f_score: string;
  };
}

interface CombinedResult {
  annotated_output: ErrorAnnotation[];
  true_positives: ClassOutput[];
  false_positives: ClassOutput[];
  false_negatives: ClassOutput[];
}

export default function Evaluate() {
  const [attrbuteResults, setAttrbuteResults] = useState<AttributeResult>({
    annotated_output: [],
    prompt_metadata: [],
    dataset_schema: [],
    column_summary: [],
    true_positives: [],
    false_positives: [],
    false_negatives: [],
    dataset_size: 0,
    metrics: {
      accuracy: "",
      precision: "",
      recall: "",
      f_score: "",
    },
  });
  const [dependencyResults, setDependencyResults] = useState<DependencyResults>(
    {
      dependencies: [],
      prompt_metadata: [],
      dataset_schema: [],
    }
  );
  // const [dependencyResults, setDependencyResults] = useState({});
  const [depViolationResults, setDepViolationResults] =
    useState<DepViolationResult>({
      annotated_output: [],
      column_summary: [],
      prompt_metadata: [],
      true_positives: [],
      false_positives: [],
      false_negatives: [],

      dataset_size: 0,
      metrics: {
        accuracy: "",
        precision: "",
        recall: "",
        f_score: "",
      },
    });

  const [combinedOutput, setCombinedOutput] = useState<CombinedResult>({
    annotated_output: [],
    true_positives: [],
    false_positives: [],
    false_negatives: [],
  });

  const [dataset, setDataset] = useState([]);

  // New states for loading and error/success messages
  const [loadingStates, setLoadingStates] = useState({
    attribute: false,
    dependency: false,
    violations: false,
    combined: false,
  });

  const [requestedStates, setRequestedStates] = useState({
    attribute: false,
    dependency: false,
    violations: false,
    combined: false,
  });

  const [detectionError, setDetectionError] = useState({
    attribute: false,
    dependency: false,
    violations: false,
    combined: false,
  });

  return (
    <Box className={styles.page}>
      <Grid2 container>
        <Grid2 size={{ xs: 12 }}>
          <Box className={styles.pageContent}>
            <EvaluateForm
              setAttributeResults={setAttrbuteResults}
              setDependencyResults={setDependencyResults}
              setDepViolationResults={setDepViolationResults}
              setCombinedOutput={setCombinedOutput}
              setLoadingStates={setLoadingStates}
              setRequestedStates={setRequestedStates}
              setDetectionError={setDetectionError}
              setDataset={setDataset}
            />
            <Grid2
              container
              className={styles.outputClassesContainer}
              spacing={2}
            >
              <Grid2 size={{ xs: 12, lg: 4 }}>
                <EvaluateAttribute
                  attributeResults={attrbuteResults}
                  isLoading={loadingStates.attribute}
                  isRequested={requestedStates.attribute}
                  error={detectionError.attribute}
                />
              </Grid2>
              <Grid2 size={{ xs: 12, lg: 4 }}>
                <DetectionDep
                  dependecyResults={dependencyResults}
                  isLoading={loadingStates.dependency}
                  isRequested={requestedStates.dependency}
                  error={detectionError.dependency}
                />
              </Grid2>
              <Grid2 size={{ xs: 12, lg: 4 }}>
                <EvaluateDepViol
                  depViolationResults={depViolationResults}
                  isLoading={loadingStates.violations}
                  isRequested={requestedStates.violations}
                  error={detectionError.violations}
                />
              </Grid2>
            </Grid2>
          </Box>
        </Grid2>
        <Grid2 size={{ xs: 12 }}>
          <Box className={styles.pageContent}>
            {/* Second Block */}

            {/* <AnnotatedTable */}
            <EvaluateAnnotatedTable
              dataset={dataset}
              attributeResult={attrbuteResults}
              depViolationResult={depViolationResults}
              combinedResult={combinedOutput}
              errorStates={detectionError}
              loadingStates={loadingStates}
              requestedStates={requestedStates}
              datasetSchema={
                attrbuteResults.dataset_schema ||
                dependencyResults.dataset_schema
              }
            />
          </Box>
        </Grid2>
      </Grid2>
    </Box>
  );
}

"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import styles from "./page.module.css";

import { Box, Grid2 } from "@mui/material";

// Component Imports
import DetectionForm from "../../components/Detect/DetectionForm/DetectionForm";
import DetectionAttribute from "@/components/Detect/DetectionAttribute/DetectionAttribute";
import DetectionDep from "@/components/Detect/DetectionDep/DetectionDep";
import DetectionDepViol from "@/components/Detect/DetectionDepViol/DetectionDepViol";
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

interface AttributeResult {
  annotated_output: ErrorAnnotation[]; // Allows for a flexible structure with any string keys
  prompt_metadata: PromptMetadata[];
  dataset_schema: DatasetSchema[];
  column_summary: AttributeColumnSummary[];
  dataset_size: number;
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
  dataset_size: number;
}

interface CombinedResult {
  annotated_output: ErrorAnnotation[];
}

export default function Detect() {
  const [attrbuteResults, setAttrbuteResults] = useState<AttributeResult>({
    annotated_output: [],
    prompt_metadata: [],
    dataset_schema: [],
    column_summary: [],
    dataset_size: 0,
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
      dataset_size: 0,
    });

  const [combinedOutput, setCombinedOutput] = useState<CombinedResult>({
    annotated_output: [],
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
            <DetectionForm
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
                <DetectionAttribute
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
                <DetectionDepViol
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
            <AnnotatedTable
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

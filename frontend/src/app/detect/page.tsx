"use client";
import React, { useState } from "react";
import styles from "./page.module.css";

import { Box, Button, Grid2, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import UploadFileIcon from "@mui/icons-material/UploadFile";

import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";

// Component Imports
import DetectionForm from "../../components/Detection/DetectionForm/DetectionForm";
import DetectionAttribute from "@/components/Detection/DetectionAttribute/DetectionAttribute";

// Placeholder data
function createData(
  name: string,
  calories: number,
  fat: number,
  carbs: number,
  protein: number
) {
  return { name, calories, fat, carbs, protein };
}

const rows = [
  createData("Frozen yoghurt", 159, 6.0, 24, 4.0),
  createData("Ice cream sandwich", 237, 9.0, 37, 4.3),
  createData("Eclair", 262, 16.0, 24, 6.0),
  createData("Cupcake", 305, 3.7, 67, 4.3),
  createData("Gingerbread", 356, 16.0, 49, 3.9),
];

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

interface PromptMetadata {
  completion_tokens: number;
  elapsed_time: string;
  prompt_name: string;
  prompt_tokens: number;
  total_tokens: number;
}

interface AttributeAnnotation {
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
  annotated_output: AttributeAnnotation[]; // Allows for a flexible structure with any string keys
  prompt_metadata: PromptMetadata[];
  dataset_schema: DatasetSchema[];
  column_summary: AttributeColumnSummary[];
  dataset_size: number;
}

export default function Home() {
  const [attrbuteResults, setAttrbuteResults] = useState<AttributeResult>({
    annotated_output: [],
    prompt_metadata: [],
    dataset_schema: [],
    column_summary: [],
    dataset_size: 0,
  });
  const [dependencyResults, setDependencyResults] = useState({});
  const [depViolationResults, setDepViolationResults] = useState({});

  // New states for loading and error/success messages
  const [loadingStates, setLoadingStates] = useState({
    attribute: false,
    dependency: false,
    violations: false,
  });

  const [requestedStates, setRequestedStates] = useState({
    attribute: false,
    dependency: false,
    violations: false,
  });

  const [detectionError, setDetectionError] = useState({
    attribute: false,
    dependency: false,
    violations: false,
  });

  return (
    <div className={styles.page}>
      <Typography variant="h3">Detect</Typography>
      <DetectionForm
        setAttributeResults={setAttrbuteResults}
        setDependencyResults={setDependencyResults}
        setDepViolationResults={setDepViolationResults}
        setLoadingStates={setLoadingStates}
        setRequestedStates={setRequestedStates}
        setDetectionError={setDetectionError}
      />
      <Grid2 container className={styles.outputClasses} spacing={2}>
        <Grid2 size={{ xs: 2, md: 4 }} className={styles.output}>
          <DetectionAttribute
            attributeResults={attrbuteResults}
            isLoading={loadingStates.attribute}
            isRequested={requestedStates.attribute}
            error={detectionError.attribute}
          />
        </Grid2>
        <Grid2 size={{ xs: 2, md: 4 }} className={styles.output}>
          <Typography>Dependencies</Typography>
        </Grid2>
        <Grid2 size={{ xs: 2, md: 4 }} className={styles.output}>
          <Typography>Dependency Violations</Typography>
        </Grid2>
      </Grid2>
      <Box>
        <Typography>Errors</Typography>
        <TableContainer component={Paper}>
          <Table sx={{ minWidth: 650 }} size="small" aria-label="a dense table">
            <TableHead>
              <TableRow>
                <TableCell>Dessert (100g serving)</TableCell>
                <TableCell align="right">Calories</TableCell>
                <TableCell align="right">Fat&nbsp;(g)</TableCell>
                <TableCell align="right">Carbs&nbsp;(g)</TableCell>
                <TableCell align="right">Protein&nbsp;(g)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={row.name}
                  sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
                >
                  <TableCell component="th" scope="row">
                    {row.name}
                  </TableCell>
                  <TableCell align="right">{row.calories}</TableCell>
                  <TableCell align="right">{row.fat}</TableCell>
                  <TableCell align="right">{row.carbs}</TableCell>
                  <TableCell align="right">{row.protein}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </div>
  );
}

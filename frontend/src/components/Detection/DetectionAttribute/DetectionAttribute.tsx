import React, { useState } from "react";
import styles from "./DetectionAttribute.module.css";

// MUI Imports
import {
  Box,
  Button,
  InputLabel,
  MenuItem,
  FormControl,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Typography,
  Tab,
} from "@mui/material";

import { TabContext, TabList, TabPanel } from "@mui/lab";

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

interface ColumnSummary {
  column: string;
  error_count: number;
}

// Schema for attribute results
interface AttributeResult {
  annotated_output: ErrorAnnotation[]; // Allows for a flexible structure with any string keys
  prompt_metadata: PromptMetadata[];
  dataset_schema: DatasetSchema[];
  column_summary: ColumnSummary[];
  dataset_size: number;
}

interface DetectionAttributeProps {
  attributeResults: AttributeResult;
  isLoading: boolean; // Track loading state
  isRequested: boolean; // Track if data has been fetched
  error: boolean; // Error flag
}

const DetectionAttribute: React.FC<DetectionAttributeProps> = ({
  attributeResults,
  isLoading,
  isRequested,
  error,
}) => {
  const [tabValue, setTabValue] = React.useState("1");

  const handleTabChange = (event: React.SyntheticEvent, newValue: string) => {
    setTabValue(newValue);
  };

  const { dataset_schema, column_summary, dataset_size } = attributeResults;

  // Map column_summary to the order of dataset_schema
  const orderedSummary = dataset_schema.map((schema) => {
    const summary = column_summary.find((col) => col.column === schema.name);
    return {
      column: schema.name,
      error_count: summary ? summary.error_count : 0,
      error_percentage: summary
        ? ((summary.error_count / dataset_size) * 100).toFixed(3)
        : "0.000",
    };
  });

  // Generic CSV export function
  const exportToCSV = <T extends object>(
    data: T[],
    headers: string[],
    filename: string
  ) => {
    // Create a CSV string from data and headers
    console.log(attributeResults.prompt_metadata);

    console.log(data);
    const rows = data.map((item) =>
      headers.map((header) => item[header as keyof T] ?? "").join(",")
    );
    const csvContent = [headers.join(","), ...rows].join("\n");

    // Create a downloadable link and trigger download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePromptExport = () => {
    // Define headers for the CSV
    const headers = [
      "completion_tokens",
      "elapsed_time",
      "prompt_name",
      "prompt_tokens",
      "total_tokens",
    ];

    // Call the generic export function
    exportToCSV(
      attributeResults.prompt_metadata,
      headers,
      "prompt_metadata.csv"
    );
  };

  const handleSummaryExport = () => {
    // Define headers for the CSV
    const headers = ["column_name", "error_count", "error_percentage"];

    // Call the generic export function
    exportToCSV(
      attributeResults.prompt_metadata,
      headers,
      "column_summary.csv"
    );
  };

  return (
    <Box>
      <h2>Attribute Results</h2>
      <Box>
        <Box>
          <TabContext value={tabValue}>
            <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
              <TabList
                onChange={handleTabChange}
                aria-label="lab API tabs example"
              >
                <Tab label="Summary" value="1" />
                <Tab label="Prompt Metadata" value="2" />
              </TabList>
            </Box>
            <TabPanel value="1">
              {!isRequested ? (
                <Typography variant="body1" align="center">
                  Select Attribute Detection
                </Typography>
              ) : error ? (
                <Typography variant="body1" color="error" align="center">
                  An error occurred while fetching data.
                </Typography>
              ) : isLoading ? (
                <CircularProgress />
              ) : (
                <Box>
                  <TableContainer
                    component={Paper}
                    className={styles.scrollableTableContainer}
                  >
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell className={styles.stickyHeader}>
                            Column Name
                          </TableCell>
                          <TableCell
                            className={styles.stickyHeader}
                            align="right"
                          >
                            Error Count
                          </TableCell>
                          <TableCell
                            className={styles.stickyHeader}
                            align="right"
                          >
                            Error Percentage (%)
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {attributeResults.prompt_metadata.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} align="center">
                              <Typography variant="body1">
                                No data available.
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ) : (
                          orderedSummary.map((col, index) => (
                            <TableRow key={index}>
                              <TableCell>{col.column}</TableCell>
                              <TableCell align="right">
                                {col.error_count}
                              </TableCell>
                              <TableCell align="right">
                                {col.error_percentage}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  {!isLoading && isRequested && (
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={handleSummaryExport}
                    >
                      Export to CSV
                    </Button>
                  )}
                </Box>
              )}
            </TabPanel>
            <TabPanel value="2">
              {!isRequested ? (
                <Typography variant="body1" align="center">
                  Select Attribute Detection
                </Typography>
              ) : error ? (
                <Typography variant="body1" color="error" align="center">
                  An error occurred while fetching data.
                </Typography>
              ) : isLoading ? (
                <CircularProgress />
              ) : (
                <Box>
                  <TableContainer
                    component={Paper}
                    className={styles.scrollableTableContainer}
                  >
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell className={styles.stickyHeader}>
                            Prompt Name
                          </TableCell>
                          <TableCell className={styles.stickyHeader}>
                            Completion Tokens
                          </TableCell>
                          <TableCell className={styles.stickyHeader}>
                            Elapsed Time
                          </TableCell>
                          <TableCell className={styles.stickyHeader}>
                            Prompt Tokens
                          </TableCell>
                          <TableCell className={styles.stickyHeader}>
                            Total Tokens
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {isLoading ? (
                          <TableRow>
                            <TableCell colSpan={5} align="center">
                              <CircularProgress />
                            </TableCell>
                          </TableRow>
                        ) : attributeResults.prompt_metadata.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} align="center">
                              <Typography variant="body1">
                                No data available.
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ) : (
                          attributeResults.prompt_metadata.map(
                            (meta, index) => (
                              <TableRow key={index}>
                                <TableCell>{meta.prompt_name}</TableCell>
                                <TableCell>{meta.completion_tokens}</TableCell>
                                <TableCell>{meta.elapsed_time}</TableCell>
                                <TableCell>{meta.prompt_tokens}</TableCell>
                                <TableCell>{meta.total_tokens}</TableCell>
                              </TableRow>
                            )
                          )
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  {!isLoading && isRequested && (
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={handlePromptExport}
                    >
                      Export to CSV
                    </Button>
                  )}
                </Box>
              )}
            </TabPanel>
          </TabContext>
        </Box>
      </Box>
    </Box>
  );
};

export default DetectionAttribute;

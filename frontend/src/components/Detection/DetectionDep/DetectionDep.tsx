import React from "react";
import styles from "./DetectionDep.module.css";

// MUI Imports
import {
  Box,
  Button,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
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

interface DatasetSchema {
  index: number;
  name: string;
}

interface Dependencies {
  column_1: number;
  column_1_name: string;
  column_2: number;
  column_2_name: string;
  dependency: string;
}

// Schema for attribute results
interface DependencyResult {
  prompt_metadata: PromptMetadata[];
  dataset_schema: DatasetSchema[];
  dependencies: Dependencies[];
}

interface DetectionDepProps {
  dependecyResults: DependencyResult;
  isLoading: boolean; // Track loading state
  isRequested: boolean; // Track if data has been fetched
  error: boolean; // Error flag
}

const DetectionDep: React.FC<DetectionDepProps> = ({
  dependecyResults,
  isLoading,
  isRequested,
  error,
}) => {
  const [tabValue, setTabValue] = React.useState("1");

  const handleTabChange = (event: React.SyntheticEvent, newValue: string) => {
    setTabValue(newValue);
  };

  const { dataset_schema, dependencies, prompt_metadata } = dependecyResults;

  // Generic CSV export function
  const exportToCSV = <T extends object>(
    data: T[],
    headers: string[],
    filename: string
  ) => {
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

  const handleDependenciesExport = () => {
    // Define headers for the CSV
    const headers = [
      "Column 1 Name",
      "Column 1",
      "Column 2 Name",
      "Column 2",
      "Dependency",
    ];
    // Call the generic export function
    exportToCSV(dependencies, headers, "dependencies.csv");
  };

  return (
    <Box>
      <h2>Dependency Detection Results</h2>
      <Box>
        <Box>
          <TabContext value={tabValue}>
            <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
              <TabList
                onChange={handleTabChange}
                aria-label="lab API tabs example"
              >
                <Tab label="Dependencies" value="1" />
                <Tab label="Prompt Metadata" value="2" />
              </TabList>
            </Box>
            <TabPanel value="1">
              {!isRequested ? (
                <Typography variant="body1" align="center">
                  Select Dependency Detection
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
                            First Column
                          </TableCell>
                          <TableCell className={styles.stickyHeader}>
                            Second Column
                          </TableCell>
                          <TableCell className={styles.stickyHeader}>
                            Dependency Description
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {dependencies.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} align="center">
                              <Typography variant="body1">
                                No data available.
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ) : (
                          dependencies.map((dep, index) => (
                            <TableRow key={index}>
                              <TableCell>{dep.column_1_name}</TableCell>
                              <TableCell>{dep.column_2_name}</TableCell>
                              <TableCell>{dep.dependency}</TableCell>
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
                      onClick={handleDependenciesExport}
                    >
                      Export Dependencies to CSV
                    </Button>
                  )}
                </Box>
              )}
            </TabPanel>

            <TabPanel value="2">
              {!isRequested ? (
                <Typography variant="body1" align="center">
                  Select Dependency Detection
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
                        {prompt_metadata.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} align="center">
                              <Typography variant="body1">
                                No data available.
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ) : (
                          prompt_metadata.map((meta, index) => (
                            <TableRow key={index}>
                              <TableCell>{meta.prompt_name}</TableCell>
                              <TableCell>{meta.completion_tokens}</TableCell>
                              <TableCell>{meta.elapsed_time}</TableCell>
                              <TableCell>{meta.prompt_tokens}</TableCell>
                              <TableCell>{meta.total_tokens}</TableCell>
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
                      onClick={() => {
                        const headers = [
                          "completion_tokens",
                          "elapsed_time",
                          "prompt_name",
                          "prompt_tokens",
                          "total_tokens",
                        ];
                        exportToCSV(
                          prompt_metadata,
                          headers,
                          "prompt_metadata.csv"
                        );
                      }}
                    >
                      Export Prompt Metadata to CSV
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

export default DetectionDep;

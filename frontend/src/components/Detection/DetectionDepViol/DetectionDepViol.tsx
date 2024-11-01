import React from "react";
import styles from "./DetectionDepViol.module.css";

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

interface ColumnSummary {
  column_1_count: number;
  column_1_name: string;
  column_2_count: number;
  column_2_name: string;
  dependency: string;
}

interface DepViolationResult {
  prompt_metadata: PromptMetadata[];
  column_summary: ColumnSummary[];
  dataset_size: number;
}

interface DetectionDepViolProps {
  depViolationResults: DepViolationResult;
  isLoading: boolean;
  isRequested: boolean;
  error: boolean;
}

const DetectionDepViol: React.FC<DetectionDepViolProps> = ({
  depViolationResults,
  isLoading,
  isRequested,
  error,
}) => {
  const [tabValue, setTabValue] = React.useState("1");

  const handleTabChange = (event: React.SyntheticEvent, newValue: string) => {
    setTabValue(newValue);
  };

  const { column_summary, prompt_metadata } = depViolationResults;

  const exportToCSV = <T extends object>(
    data: T[],
    headers: string[],
    filename: string
  ) => {
    const rows = data.map((item) =>
      headers.map((header) => item[header as keyof T] ?? "").join(",")
    );
    const csvContent = [headers.join(","), ...rows].join("\n");

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

  return (
    <Box>
      <h2>Dependency Violation Results</h2>
      <Box>
        <TabContext value={tabValue}>
          <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
            <TabList onChange={handleTabChange} aria-label="tabs example">
              <Tab label="Summary" value="1" />
              <Tab label="Prompt Metadata" value="2" />
            </TabList>
          </Box>

          {/* Column Summary Tab */}
          <TabPanel value="1">
            {!isRequested ? (
              <Typography variant="body1" align="center">
                Select Dependency Violation Detection
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
                          First Column Count
                        </TableCell>
                        <TableCell className={styles.stickyHeader}>
                          Second Column
                        </TableCell>
                        <TableCell className={styles.stickyHeader}>
                          Second Column Count
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {column_summary.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} align="center">
                            <Typography variant="body1">
                              No data available.
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        column_summary.map((summary, index) => (
                          <TableRow key={index}>
                            <TableCell>{summary.column_1_name}</TableCell>
                            <TableCell>
                              {(
                                (summary.column_1_count /
                                  depViolationResults.dataset_size) *
                                100
                              ).toFixed(2)}
                              %
                            </TableCell>
                            <TableCell>{summary.column_2_name}</TableCell>
                            <TableCell>
                              {(
                                (summary.column_2_count /
                                  depViolationResults.dataset_size) *
                                100
                              ).toFixed(2)}
                              %
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
                    onClick={() => {
                      const headers = [
                        "column_1_name",
                        "column_1_count",
                        "column_2_name",
                        "column_2_count",
                        "dependency",
                      ];
                      exportToCSV(
                        column_summary,
                        headers,
                        "column_summary.csv"
                      );
                    }}
                  >
                    Export Column Summary to CSV
                  </Button>
                )}
              </Box>
            )}
          </TabPanel>

          {/* Prompt Metadata Tab */}
          <TabPanel value="2">
            {!isRequested ? (
              <Typography variant="body1" align="center">
                Select Dependency Violation Detection
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
                        "prompt_name",
                        "completion_tokens",
                        "elapsed_time",
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
  );
};

export default DetectionDepViol;

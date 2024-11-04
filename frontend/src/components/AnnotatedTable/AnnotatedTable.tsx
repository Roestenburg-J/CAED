import React, { useState } from "react";
import styles from "./AnnotatedTable.module.css";
import {
  Box,
  Typography,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Pagination,
  // LinearProgress,
  Skeleton,
  Button, // Import Button for the export functionality
} from "@mui/material";
import FileDownloadIcon from "@mui/icons-material/FileDownload";

import theme from "@/theme/theme";

interface ErrorAnnotation {
  [key: string]: number | string; // Allow both numbers and strings
}

interface AttributeResult {
  annotated_output: ErrorAnnotation[];
}

interface DepViolationResult {
  annotated_output: ErrorAnnotation[];
}

interface CombinedResult {
  annotated_output: ErrorAnnotation[];
}

interface Dataset {
  [key: string]: number | string;
}

interface LoadingStates {
  attribute: boolean;
  dependency: boolean;
  combined: boolean;
}

interface RequestedStates {
  attribute: boolean;
  dependency: boolean;
  combined: boolean;
}

interface ErrorStates {
  attribute: boolean;
  dependency: boolean;
  combined: boolean;
}

interface DatasetSchema {
  index: number;
  name: string;
}

interface AnnotatedTableProps {
  attributeResult?: AttributeResult;
  depViolationResult?: DepViolationResult;
  combinedResult?: CombinedResult;
  loadingStates: LoadingStates;
  requestedStates: RequestedStates;
  errorStates: ErrorStates;
  dataset: Dataset[];
  datasetSchema: DatasetSchema[];
}

const AnnotatedTable: React.FC<AnnotatedTableProps> = ({
  attributeResult,
  depViolationResult,
  combinedResult,
  loadingStates,
  requestedStates,
  // errorStates,
  dataset,
  datasetSchema,
}) => {
  const [selectedErrorType, setSelectedErrorType] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10; // Number of rows per page

  // Filter available error options based on requested states
  const availableErrorOptions: { value: string; label: string }[] = [];
  if (requestedStates.attribute && attributeResult) {
    availableErrorOptions.push({
      value: "attributeResult",
      label: "Attribute Errors",
    });
  }
  if (requestedStates.dependency && depViolationResult) {
    availableErrorOptions.push({
      value: "depViolationResult",
      label: "Dependency Violations",
    });
  }
  if (requestedStates.combined && combinedResult) {
    availableErrorOptions.push({
      value: "combinedResult",
      label: "Combined Errors",
    });
  }

  const getAnnotations = (): ErrorAnnotation[] => {
    if (selectedErrorType === "attributeResult" && attributeResult) {
      return attributeResult.annotated_output;
    }
    if (selectedErrorType === "depViolationResult" && depViolationResult) {
      console.log("form get", depViolationResult);

      return depViolationResult.annotated_output;
    }
    if (selectedErrorType === "combinedResult" && combinedResult) {
      return combinedResult.annotated_output;
    }
    return [];
  };

  const annotations = getAnnotations();

  // Pagination: calculate rows and annotations for the current page
  const totalPages = Math.ceil(dataset.length / rowsPerPage);
  const paginatedData = dataset.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );
  const paginatedAnnotations = annotations.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const handlePageChange = (
    event: React.ChangeEvent<unknown>,
    page: number
  ) => {
    setCurrentPage(page);
  };

  const exportToCSV = (data: ErrorAnnotation[], filename: string) => {
    const headers = datasetSchema.map((col) => col.name); // Use datasetSchema to define headers

    const rows = data.map((item) => {
      return datasetSchema.map((col) => item[col.name] ?? ""); // Access values based on schema, without including errorType
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

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

  const handleExport = () => {
    const filename = "error_annotations.csv";
    // Combine annotations into a suitable format for CSV export
    const exportData = annotations.map((annotation) => ({
      ...annotation,
      errorType: selectedErrorType, // Add error type to the annotation
    }));

    exportToCSV(exportData, filename);
  };

  return (
    <Box className={styles.container}>
      <Box className={styles.component}>
        <Typography className={styles.header}>Annotated Output</Typography>
        <Box className={styles.controls}>
          <FormControl
            variant="outlined"
            sx={{ minWidth: 200, margin: "0 0" }}
            size="small"
          >
            <InputLabel>Select Error Type</InputLabel>
            <Select
              value={selectedErrorType}
              onChange={(e) => setSelectedErrorType(e.target.value)}
              label="Select Error Type"
              disabled={availableErrorOptions.length === 0} // Disable if no options
            >
              {availableErrorOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button
            variant="contained"
            color="primary"
            onClick={handleExport}
            disabled={!annotations.length || !selectedErrorType} // Disable if no annotations or error type selected
            sx={{ margin: "0 0" }}
          >
            <FileDownloadIcon />
            Export
          </Button>
        </Box>

        {dataset.length === 0 ? (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexGrow: "1",
            }}
          >
            <Typography>No data available. Please upload a dataset.</Typography>
          </Box>
        ) : (
          <>
            <TableContainer
              component={Paper}
              className={styles.scrollableTableContainer}
            >
              <Table
                sx={{ minWidth: 650 }}
                size="small"
                aria-label="annotated table"
              >
                <TableHead>
                  <TableRow>
                    {Object.keys(dataset[0]).map((key) => (
                      <TableCell
                        key={key}
                        sx={{
                          background: theme.palette.primary.main,
                          color: theme.palette.primary.contrastText,
                        }}
                        className={styles.stickyHeader}
                      >
                        {key}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {selectedErrorType === "attributeResult" &&
                  loadingStates.attribute
                    ? paginatedData.map((_, rowIndex) => (
                        <TableRow key={rowIndex}>
                          {Object.keys(dataset[0]).map((_, colIndex) => (
                            <TableCell key={colIndex}>
                              <Skeleton
                                variant="text"
                                width="100%"
                                height={60}
                              />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    : selectedErrorType === "depViolationResult" &&
                      loadingStates.dependency
                    ? paginatedData.map((_, rowIndex) => (
                        <TableRow key={rowIndex}>
                          {Object.keys(dataset[0]).map((_, colIndex) => (
                            <TableCell key={colIndex}>
                              <Skeleton
                                variant="text"
                                width="100%"
                                height={60}
                              />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    : selectedErrorType === "combinedResult" &&
                      loadingStates.combined
                    ? paginatedData.map((_, rowIndex) => (
                        <TableRow key={rowIndex}>
                          {Object.keys(dataset[0]).map((_, colIndex) => (
                            <TableCell key={colIndex}>
                              <Skeleton
                                variant="text"
                                width="100%"
                                height={60}
                              />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    : paginatedData.map((row, rowIndex) => (
                        <TableRow key={rowIndex}>
                          {Object.keys(row).map((key, colIndex) => (
                            <TableCell
                              key={colIndex}
                              style={{
                                position: "relative",
                                padding: 0,
                                height: "60px",
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  border:
                                    paginatedAnnotations[rowIndex] &&
                                    paginatedAnnotations[rowIndex][key] === 1
                                      ? "2px solid"
                                      : "none",
                                  borderColor:
                                    paginatedAnnotations[rowIndex] &&
                                    paginatedAnnotations[rowIndex][key] === 1
                                      ? theme.palette.error.light
                                      : "transparent",
                                  borderRadius: 10,
                                  padding: "8px",
                                  borderSpacing: 0,
                                  width: "100%",
                                  maxWidth: "200px",
                                  height: "100%",
                                  boxSizing: "border-box",
                                  fontSize: "0.8rem",
                                  overflowY: "auto",
                                  overflowX: "hidden",
                                }}
                              >
                                {row[key]}
                              </div>
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                </TableBody>
              </Table>
            </TableContainer>
            <Pagination
              count={totalPages}
              page={currentPage}
              onChange={handlePageChange}
              color="primary"
              size="small"
              shape="rounded"
              sx={{ marginTop: 2, display: "flex", justifyContent: "center" }}
            />
          </>
        )}
      </Box>
    </Box>
  );
};

export default AnnotatedTable;

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
  LinearProgress,
  Button, // Import Button for the export functionality
} from "@mui/material";

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
  [key: string]: any;
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

interface AnnotatedTableProps {
  attributeResult?: AttributeResult;
  depViolationResult?: DepViolationResult;
  combinedResult?: CombinedResult;
  loadingStates: LoadingStates;
  requestedStates: RequestedStates;
  errorStates: ErrorStates;
  dataset: Dataset[];
}

const AnnotatedTable: React.FC<AnnotatedTableProps> = ({
  attributeResult,
  depViolationResult,
  combinedResult,
  loadingStates,
  requestedStates,
  errorStates,
  dataset,
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

  // Generic CSV export function
  const exportToCSV = (data: ErrorAnnotation[], filename: string) => {
    const headers = ["Error Type", ...Object.keys(data[0])]; // Assuming the first object has all keys as headers
    const rows = data.map((item) => {
      return [
        item.errorType,
        ...headers.slice(1).map((header) => item[header] ?? ""),
      ]; // Replace 'item.errorType' with appropriate key if needed
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
    const exportData = annotations.map((annotation, index) => ({
      ...annotation,
      errorType: selectedErrorType, // Add error type to the annotation
    }));

    exportToCSV(exportData, filename);
  };

  return (
    <div className={styles.page}>
      <Typography variant="h6">Annotated Output</Typography>

      <FormControl variant="outlined" sx={{ minWidth: 200, margin: "20px 0" }}>
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

      {/* Display Linear Progress when loading annotations */}
      {loadingStates.attribute ||
      loadingStates.dependency ||
      loadingStates.combined ? (
        <LinearProgress />
      ) : null}

      {/* Export Button */}
      <Button
        variant="contained"
        color="primary"
        onClick={handleExport}
        disabled={!annotations.length || !selectedErrorType} // Disable if no annotations or error type selected
        sx={{ margin: "20px 0" }}
      >
        Export to CSV
      </Button>

      {dataset.length === 0 ? (
        <Box>
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
                    <TableCell key={key}>{key}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedData.map((row, rowIndex) => (
                  <TableRow key={rowIndex}>
                    {Object.keys(row).map((key, colIndex) => (
                      <TableCell
                        key={colIndex}
                        style={{
                          color:
                            paginatedAnnotations[rowIndex] &&
                            paginatedAnnotations[rowIndex][key] === 1
                              ? "red"
                              : "inherit",
                        }}
                      >
                        {row[key]}
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
            sx={{ marginTop: 2, display: "flex", justifyContent: "center" }}
          />
        </>
      )}
    </div>
  );
};

export default AnnotatedTable;

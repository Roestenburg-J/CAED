import React, { useState } from "react";
import styles from "./EvaluateAnnotatedTable.module.css";
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
  Skeleton,
  Button,
  FormControlLabel,
  Checkbox,
} from "@mui/material";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import theme from "@/theme/theme";

interface ErrorAnnotation {
  [key: string]: number | string;
}

interface ClassOutput {
  [key: string]: number | string;
}

interface AttributeResult {
  annotated_output: ErrorAnnotation[];
  true_positives: ClassOutput[];
  false_positives: ClassOutput[];
  false_negatives: ClassOutput[];
}

interface DepViolationResult {
  annotated_output: ErrorAnnotation[];
  true_positives: ClassOutput[];
  false_positives: ClassOutput[];
  false_negatives: ClassOutput[];
}

interface CombinedResult {
  annotated_output: ErrorAnnotation[];
  true_positives: ClassOutput[];
  false_positives: ClassOutput[];
  false_negatives: ClassOutput[];
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

const EvaluateAnnotatedTable: React.FC<AnnotatedTableProps> = ({
  attributeResult,
  depViolationResult,
  combinedResult,
  loadingStates,
  requestedStates,
  // errorStates,
  dataset,
  datasetSchema,
}) => {
  const [exportType, setExportType] = useState<string>("annotations");
  const [selectedErrorType, setSelectedErrorType] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10; // Number of rows per page

  const [highlightTP, setHighlightTP] = useState(false);
  const [highlightFP, setHighlightFP] = useState(false);
  const [highlightFN, setHighlightFN] = useState(false);

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

  const getAnnotations = () => {
    // Use selected error type to select the relevant result object
    const selectedResult =
      selectedErrorType === "attributeResult"
        ? attributeResult
        : selectedErrorType === "depViolationResult"
        ? depViolationResult
        : selectedErrorType === "combinedResult"
        ? combinedResult
        : null;

    // Ensure selected result and dataset are valid
    if (!selectedResult || dataset.length === 0) return [];

    // Build the nested structure for each row in the dataset with tp, fp, and fn data
    return dataset.map((_, index) => ({
      annotation: selectedResult.annotated_output[index] || {}, // Annotation data
      tp: selectedResult.true_positives[index] || {}, // True Positive data
      fp: selectedResult.false_positives[index] || {}, // False Positive data
      fn: selectedResult.false_negatives[index] || {}, // False Negative data
    }));
  };

  const combinedAnnotations = getAnnotations();

  // Pagination: calculate rows and annotations for the current page
  const totalPages = Math.ceil(dataset.length / rowsPerPage);
  const paginatedData = dataset.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );
  const paginatedAnnotations = combinedAnnotations.slice(
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
    const filename = `error_${exportType}.csv`; // Dynamically name the file based on export type
    let exportData;
    console.log(combinedAnnotations);

    switch (exportType) {
      case "annotations":
        exportData = combinedAnnotations.map((annotation) => ({
          ...annotation.annotation,
          errorType: selectedErrorType, // Add error type to the annotation
        }));
        break;
      case "tp":
        exportData = combinedAnnotations.map((annotation) => ({
          ...annotation.tp,
          errorType: selectedErrorType,
        }));
        break;
      case "fp":
        exportData = combinedAnnotations.map((annotation) => ({
          ...annotation.fp,
          errorType: selectedErrorType,
        }));
        break;
      case "fn":
        exportData = combinedAnnotations.map((annotation) => ({
          ...annotation.fn,
          errorType: selectedErrorType,
        }));
        break;
      default:
        exportData = []; // Fallback
    }

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

          <FormControlLabel
            control={
              <Checkbox
                checked={highlightTP}
                onChange={(e) => setHighlightTP(e.target.checked)}
                name="tp"
                sx={{
                  color: theme.palette.success.main,
                  "&.Mui-checked": {
                    color: theme.palette.success.light,
                  },
                }}
              />
            }
            label={"Highlight True Positives"}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={highlightFP}
                onChange={(e) => setHighlightFP(e.target.checked)}
                name="fp"
                sx={{
                  color: theme.palette.warning.main,
                  "&.Mui-checked": {
                    color: theme.palette.warning.light,
                  },
                }}
              />
            }
            label={"Highlight False Positives"}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={highlightFN}
                onChange={(e) => setHighlightFN(e.target.checked)}
                name="fn"
                sx={{
                  color: theme.palette.error.main,
                  "&.Mui-checked": {
                    color: theme.palette.error.light,
                  },
                }}
              />
            }
            label={"Highlight False Negatives"}
          />
          <FormControl
            variant="outlined"
            sx={{ minWidth: 200, margin: "0 0" }}
            size="small"
          >
            <InputLabel>Select Export Type</InputLabel>
            <Select
              value={exportType}
              onChange={(e) => setExportType(e.target.value)}
              label="Select Export Type"
            >
              <MenuItem value="annotations">Error Annotations</MenuItem>
              <MenuItem value="tp">True Positives</MenuItem>
              <MenuItem value="fp">False Positives</MenuItem>
              <MenuItem value="fn">False Negatives</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="contained"
            color="primary"
            onClick={handleExport}
            disabled={!selectedErrorType} // Disable if no annotations or error type selected
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
                          {Object.keys(row).map((key, colIndex) => {
                            const annotation = paginatedAnnotations[rowIndex];
                            let borderColor = "transparent";

                            // Determine border color based on highlight checkboxes and annotation data
                            if (annotation) {
                              if (highlightTP && annotation.tp[key] !== 0) {
                                borderColor = "green"; // Green for TP if highlighted
                              } else if (
                                highlightFP &&
                                annotation.fp[key] !== 0
                              ) {
                                borderColor = "orange"; // Yellow for FP if highlighted
                              } else if (
                                highlightFN &&
                                annotation.fn[key] !== 0
                              ) {
                                borderColor = "red"; // Orange for FN if highlighted
                              }
                            }

                            return (
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
                                      borderColor !== "transparent"
                                        ? "2px solid"
                                        : "none",
                                    borderColor: borderColor,
                                    borderRadius: 10,
                                    padding: "8px",
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
                            );
                          })}
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
export default EvaluateAnnotatedTable;

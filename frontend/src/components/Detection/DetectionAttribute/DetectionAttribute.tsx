import React, { useRef, useEffect } from "react";
import styles from "./DetectionAttribute.module.css";

// MUI Imports
import {
  Box,
  Button,
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
import { useTheme, Theme } from "@mui/material/styles";

import * as d3 from "d3";

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

interface ColumnData {
  column: string;
  error_count: number;
  error_percentage: string;
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
  const svgRef = useRef<SVGSVGElement | null>(null);

  const theme = useTheme();

  const handleTabChange = (event: React.SyntheticEvent, newValue: string) => {
    setTabValue(newValue);
  };

  const { dataset_schema, column_summary, dataset_size } = attributeResults;

  // Map column_summary to the order of dataset_schema
  const orderedSummary: ColumnData[] = dataset_schema.map((schema) => {
    const summary = column_summary.find((col) => col.column === schema.name);
    return {
      column: schema.name,
      error_count: summary ? summary.error_count : 0,
      error_percentage: summary
        ? ((summary.error_count / dataset_size) * 100).toFixed(2)
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

  const renderChart = (
    svgRef: React.RefObject<SVGSVGElement>,
    data: ColumnData[],
    theme: Theme
  ) => {
    if (!svgRef.current) return;

    // Clear previous content
    d3.select(svgRef.current).selectAll("*").remove();

    // Set margins and dimensions for a scrollable chart
    const margin = { top: 20, right: 30, bottom: 40, left: 100 };
    const barHeight = 30; // Height of each bar
    const barSpacing = 5; // Spacing between bars

    // Calculate dynamic height based on data length
    const dynamicHeight =
      data.length * (barHeight + barSpacing) + margin.top + margin.bottom;
    // const dynamicWidth = Math.max(
    //   500,
    //   data.length * barHeight + margin.left + margin.right
    // );
    const dynamicWidth = 380;

    // Define scales
    const x = d3
      .scaleLinear()
      .domain([
        0,
        d3.max(data, (d: ColumnData) => +d.error_percentage) as number,
      ])
      .nice()
      .range([margin.left, dynamicWidth - margin.right]);

    const y = d3
      .scaleBand()
      .domain(data.map((d) => d.column))
      .range([margin.top, dynamicHeight - margin.bottom])
      .padding(0.1);

    const svg = d3.select(svgRef.current);

    // Set the SVG dimensions to match the dynamic height and width
    svg.attr("width", dynamicWidth).attr("height", dynamicHeight);

    // Create bars
    svg
      .append("g")
      .selectAll("rect")
      .data(data)
      .join("rect")
      .attr("y", (d: ColumnData) => y(d.column)!)
      .attr("x", margin.left)
      .attr("height", y.bandwidth())
      .attr("width", (d: ColumnData) => x(+d.error_percentage) - margin.left)
      .attr("fill", theme.palette.primary.main);

    // Add x-axis
    svg
      .append("g")
      .attr("transform", `translate(0,${dynamicHeight - margin.bottom})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .attr("transform", "rotate(-45)")
      .style("text-anchor", "end");

    // Add y-axis
    svg
      .append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y))
      .call((g: d3.Selection<SVGGElement, unknown, null, undefined>) =>
        g.select(".domain").remove()
      );

    // Add x-axis label
    svg
      .append("text")
      .attr("text-anchor", "end")
      .attr("x", dynamicWidth - margin.right)
      .attr("y", dynamicHeight - margin.top / 2);
    // .text("Error Percentage (%)");
  };

  useEffect(() => {
    renderChart(svgRef, orderedSummary, theme);
  }, [orderedSummary, theme]);

  return (
    <Box className={styles.container}>
      <Typography className={styles.header}>Attribute Results</Typography>
      <Box className={styles.tabContainer}>
        <TabContext value={tabValue}>
          <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
            <TabList
              onChange={handleTabChange}
              aria-label="lab API tabs example"
              variant="fullWidth"
              indicatorColor="secondary"
              className={styles.tabList}
            >
              <Tab label="Summary" value="1" />
              <Tab label="Prompt Metadata" value="2" />
            </TabList>
          </Box>
          <TabPanel value="1" sx={{ padding: 0 }}>
            {!isRequested ? (
              <Box className={styles.feedback}>
                <Typography variant="body1" align="center">
                  Select Attribute Detection
                </Typography>
              </Box>
            ) : error ? (
              <Box className={styles.feedback}>
                <Typography variant="body1" color="error" align="center">
                  An error occurred while fetching data.
                </Typography>
              </Box>
            ) : isLoading ? (
              <Box className={styles.feedback}>
                <CircularProgress className={styles.loading} />
              </Box>
            ) : (
              <Box className={styles.output}>
                <Box className={styles.chartContainer}>
                  <svg ref={svgRef}></svg>
                </Box>
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
          <TabPanel value="2" sx={{ padding: 0, height: 230 }}>
            {!isRequested ? (
              <Box className={styles.feedback}>
                <Typography variant="body1" align="center">
                  Select Attribute Detection
                </Typography>
              </Box>
            ) : error ? (
              <Box className={styles.feedback}>
                <Typography variant="body1" color="error" align="center">
                  An error occurred while fetching data.
                </Typography>
              </Box>
            ) : isLoading ? (
              <Box className={styles.feedback}>
                <CircularProgress className={styles.loading} />
              </Box>
            ) : (
              <Box className={styles.output}>
                <TableContainer
                  component={Paper}
                  className={styles.scrollableTableContainer}
                >
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell
                          className={styles.stickyHeader}
                          sx={{
                            fontWeight: "bold",
                            height: 20,
                            paddingTop: 0.5,
                            paddingBottom: 0.5,
                          }}
                        >
                          Prompt Name
                        </TableCell>
                        <TableCell
                          className={styles.stickyHeader}
                          sx={{
                            fontWeight: "bold",
                            height: 20,
                            paddingTop: 0.5,
                            paddingBottom: 0.5,
                          }}
                        >
                          Completion Tokens
                        </TableCell>
                        <TableCell
                          className={styles.stickyHeader}
                          sx={{
                            fontWeight: "bold",
                            height: 20,
                            paddingTop: 0.5,
                            paddingBottom: 0.5,
                          }}
                        >
                          Elapsed Time
                        </TableCell>
                        <TableCell
                          className={styles.stickyHeader}
                          sx={{
                            fontWeight: "bold",
                            height: 20,
                            paddingTop: 0.5,
                            paddingBottom: 0.5,
                          }}
                        >
                          Prompt Tokens
                        </TableCell>
                        <TableCell
                          className={styles.stickyHeader}
                          sx={{
                            fontWeight: "bold",
                            height: 20,
                            paddingTop: 0.5,
                            paddingBottom: 0.5,
                          }}
                        >
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
                        attributeResults.prompt_metadata.map((meta, index) => (
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
  );
};

export default DetectionAttribute;

import React, { useRef, useEffect } from "react";
import styles from "./EvaluateAttribute.module.css";

// MUI Imports
import {
  Box,
  Button,
  CircularProgress,
  Typography,
  Tab,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
} from "@mui/material";
import { useTheme, Theme } from "@mui/material/styles";
import FileDownloadIcon from "@mui/icons-material/FileDownload";

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

interface ClassOutput {
  [key: string]: number | string; // Allows for a flexible structure with any string keys
}

// Schema for attribute results
interface AttributeResult {
  annotated_output: ErrorAnnotation[]; // Allows for a flexible structure with any string keys
  prompt_metadata: PromptMetadata[];
  dataset_schema: DatasetSchema[];
  column_summary: ColumnSummary[];
  dataset_size: number;
  true_positives: ClassOutput[];
  false_positives: ClassOutput[];
  false_negatives: ClassOutput[];
  metrics: {
    accuracy: string;
    precision: string;
    recall: string;
    f1_score: string;
    class_1_accuracy: string;
    roc_auc: string;
    predicted_positives_count: string;
    true_positives_count: string;
  };
}

interface EvaluateAttributeProps {
  attributeResults: AttributeResult;
  isLoading: boolean; // Track loading state
  isRequested: boolean; // Track if data has been fetched
  error: boolean; // Error flag
}

const EvaluateAttribute: React.FC<EvaluateAttributeProps> = ({
  attributeResults,
  isLoading,
  isRequested,
  error,
}) => {
  const theme = useTheme();

  const [tabValue, setTabValue] = React.useState("1");
  const errorChartRef = useRef<SVGSVGElement | null>(null); // Ref for error chart
  const promptChartRef = useRef<SVGSVGElement | null>(null); // Ref for prompt chart
  const errorAxisRef = useRef<SVGSVGElement | null>(null); // Ref for error chart
  const promptAxisRef = useRef<SVGSVGElement | null>(null); // Ref for error chart

  const [selectedColumn, setSelectedColumn] =
    React.useState<keyof PromptMetadata>("completion_tokens");

  // const metadataColumns = [
  //   "completion_tokens",
  //   "elapsed_time",
  //   "prompt_name",
  //   "prompt_tokens",
  //   "total_tokens",
  // ];

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
    const headers = ["column", "error_count"];

    // Call the generic export function
    exportToCSV(attributeResults.column_summary, headers, "column_summary.csv");
  };

  const renderErrorChart = (
    svgRef: React.RefObject<SVGSVGElement>,
    svgAxisRef: React.RefObject<SVGSVGElement>,
    data: ColumnData[],
    theme: Theme
  ) => {
    if (!svgRef.current) return;

    // Clear previous content
    d3.select(svgRef.current).selectAll("*").remove();

    // Set margins and dimensions for a scrollable chart
    const margin = { top: 0, right: 30, bottom: 40, left: 100 };
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
      .range([margin.top, dynamicHeight])
      .padding(0.1);

    const svg = d3.select(svgRef.current);
    const axisSvg = d3.select(svgAxisRef.current);

    // Set the SVG dimensions to match the dynamic height and width
    svg.attr("width", dynamicWidth).attr("height", dynamicHeight);
    axisSvg.attr("width", dynamicWidth).attr("height", 60);

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
    axisSvg
      .append("g")
      .attr("transform", `translate(0,${0})`)
      .call(d3.axisBottom(x).tickFormat((d) => `${d}%`)) // Add this line
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
    axisSvg
      .append("text")
      .attr("text-anchor", "end")
      .attr("x", dynamicWidth - margin.right)
      .attr("y", dynamicHeight - margin.top / 2);
    // .text("Error Percentage (%)");
  };

  const renderPromptChart = (
    svgRef: React.RefObject<SVGSVGElement>,
    svgAxisRef: React.RefObject<SVGSVGElement>,
    data: PromptMetadata[],
    column: keyof PromptMetadata,
    theme: Theme
  ) => {
    if (!svgRef.current) return;

    // Clear previous content
    d3.select(svgRef.current).selectAll("*").remove();
    d3.select(svgAxisRef.current).selectAll("*").remove();

    const margin = { top: 0, right: 30, bottom: 0, left: 100 };
    const barHeight = 30;
    const barSpacing = 5;

    const parseElapsedTime = (duration: string): number => {
      const [minutes, rest] = duration.split(":");
      const [seconds, milliseconds] = rest.split(".");
      return (
        parseInt(minutes, 10) * 60 * 1000 +
        parseInt(seconds, 10) * 1000 +
        (parseInt(milliseconds, 10) || 0)
      );
    };

    const formatElapsedTime = (milliseconds: number): string => {
      const minutes = Math.floor(milliseconds / 60000);
      const seconds = Math.floor((milliseconds % 60000) / 1000);
      const ms = milliseconds % 1000;
      return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
        2,
        "0"
      )}.${String(ms).padStart(2, "0")}`;
    };

    type ColumnData = { name: string; value: number; formattedValue: string };

    const columnData: ColumnData[] = data.map((d) => {
      if (column === "elapsed_time" && typeof d[column] === "string") {
        const parsedValue = parseElapsedTime(d[column] as string);
        return {
          name: d.prompt_name,
          value: parsedValue,
          formattedValue: formatElapsedTime(parsedValue),
        };
      } else {
        return {
          name: d.prompt_name,
          value: +d[column],
          formattedValue: String(d[column]),
        };
      }
    });

    const dynamicHeight =
      columnData.length * (barHeight + barSpacing) + margin.top + margin.bottom;
    const dynamicWidth = 380;

    const x = d3
      .scaleLinear()
      .domain([0, d3.max(columnData, (d) => d.value) as number])
      .nice()
      .range([margin.left, dynamicWidth - margin.right]);

    const y = d3
      .scaleBand()
      .domain(columnData.map((d) => d.name))
      .range([margin.top, dynamicHeight - margin.bottom])
      .padding(0.1);

    const svg = d3.select(svgRef.current);
    svg.attr("width", dynamicWidth).attr("height", dynamicHeight);

    const svgAxis = d3.select(svgAxisRef.current);
    svgAxis.attr("width", dynamicWidth).attr("height", 100); // Fixed height for the axis SVG

    // Create bars
    svg
      .append("g")
      .selectAll("rect")
      .data(columnData)
      .join("rect")
      .attr("y", (d) => y(d.name)!)
      .attr("x", margin.left)
      .attr("height", y.bandwidth())
      .attr("width", (d) => x(d.value) - margin.left)
      .attr("fill", theme.palette.primary.main);

    // Add labels for formatted values
    // svg
    //   .append("g")
    //   .selectAll("text")
    //   .data(columnData)
    //   .join("text")
    //   .attr("x", (d) => x(d.value) + 5)
    //   .attr("y", (d) => y(d.name)! + y.bandwidth() / 2)
    //   .attr("dy", "0.35em")
    //   .text((d) => d.formattedValue)
    //   .attr("fill", theme.palette.text.primary);

    // Define x-axis
    const axisBottom = d3.axisBottom(x);
    const tickFormat = (d: d3.NumberValue) => {
      const num = +d;
      return column === "elapsed_time"
        ? formatElapsedTime(num)
        : num.toString();
    };

    axisBottom.tickFormat(tickFormat);

    // Append the x-axis to the axis SVG
    const xAxisGroup = svgAxis
      .append("g")
      .attr("transform", `translate(0,${0})`) // Position the axis
      .call(axisBottom);

    // Rotate the tick labels to avoid overlap
    xAxisGroup
      .selectAll("text")
      .attr("transform", "rotate(-45)") // Rotate labels by -45 degrees
      .attr("text-anchor", "end") // Align text to the end
      .attr("dx", "-0.5em") // Adjust x position
      .attr("dy", "0.15em"); // Adjust y position

    // Add y-axis to the main SVG
    svg
      .append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y))
      .call((g: d3.Selection<SVGGElement, unknown, null, undefined>) =>
        g.select(".domain").remove()
      );

    // Optional: Add x-axis label
    // svgAxis
    //   .append("text")
    //   .attr("text-anchor", "end")
    //   .attr("x", dynamicWidth - margin.right)
    //   .attr("y", 30) // Adjust this position for the label
    //   .text(column === "elapsed_time" ? "Elapsed Time" : "Values"); // Set appropriate label text
  };

  useEffect(() => {
    renderErrorChart(errorChartRef, errorAxisRef, orderedSummary, theme);
    renderPromptChart(
      promptChartRef,
      promptAxisRef,
      attributeResults.prompt_metadata,
      selectedColumn,
      theme
    );
  }, [orderedSummary, theme, selectedColumn, attributeResults.prompt_metadata]);

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
              <Tab label="Accuracy" value="3" />
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
                <Box className={styles.chartSVG}>
                  <Box className={styles.chartContainer}>
                    <svg ref={errorChartRef}></svg>
                  </Box>
                  <svg ref={errorAxisRef}></svg>
                </Box>

                {!isLoading && isRequested && (
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleSummaryExport}
                  >
                    <FileDownloadIcon />
                    Export
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
                <FormControl
                  fullWidth
                  variant="outlined"
                  margin="dense"
                  className={styles.dropdown}
                  size="small"
                >
                  <InputLabel>Select Column</InputLabel>
                  <Select
                    value={selectedColumn}
                    onChange={(event) =>
                      setSelectedColumn(
                        event.target.value as keyof PromptMetadata
                      )
                    }
                    label="Select Column"
                  >
                    <MenuItem value={"completion_tokens"}>
                      Completion Tokens
                    </MenuItem>
                    <MenuItem value={"prompt_tokens"}>Prompt Tokens</MenuItem>
                    <MenuItem value={"total_tokens"}>Total Tokens</MenuItem>
                    <MenuItem value={"elapsed_time"}>Elapsed Time</MenuItem>
                  </Select>
                </FormControl>
                <Box className={styles.chartContainer}>
                  <svg ref={promptChartRef}></svg>
                </Box>
                <svg ref={promptAxisRef}></svg>

                {!isLoading && isRequested && (
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handlePromptExport}
                  >
                    <FileDownloadIcon />
                    Export
                  </Button>
                )}
              </Box>
            )}
          </TabPanel>
          <TabPanel value="3" sx={{ padding: 0, height: 230 }}>
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
                <Box className={styles.metrics}>
                  <Box sx={{ display: "flex" }}>
                    <Box>
                      <Typography sx={{ fontWeight: "bold" }}>
                        Accuracy:
                      </Typography>
                      <Typography sx={{ fontWeight: "bold" }}>
                        Precision:
                      </Typography>
                      <Typography sx={{ fontWeight: "bold" }}>
                        Recall:
                      </Typography>
                      <Typography sx={{ fontWeight: "bold" }}>
                        f-score:
                      </Typography>
                      <Typography sx={{ fontWeight: "bold" }}>
                        Error class accuracy:
                      </Typography>
                      <Typography sx={{ fontWeight: "bold" }}>
                        ROC AUC:
                      </Typography>
                      <Typography sx={{ fontWeight: "bold" }}>
                        Predicted true errors:
                      </Typography>
                      <Typography sx={{ fontWeight: "bold" }}>
                        True Errors:
                      </Typography>
                    </Box>
                    <Box sx={{ ml: 1 }}>
                      <Typography>
                        {attributeResults.metrics.accuracy}
                      </Typography>
                      <Typography>
                        {attributeResults.metrics.precision}
                      </Typography>
                      <Typography>{attributeResults.metrics.recall}</Typography>
                      <Typography>
                        {attributeResults.metrics.f1_score}
                      </Typography>
                      <Typography>
                        {attributeResults.metrics.class_1_accuracy}
                      </Typography>
                      <Typography>
                        {attributeResults.metrics.roc_auc}
                      </Typography>
                      <Typography>
                        {attributeResults.metrics.predicted_positives_count}
                      </Typography>
                      <Typography>
                        {attributeResults.metrics.true_positives_count}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </Box>
            )}
          </TabPanel>
        </TabContext>
      </Box>
    </Box>
  );
};

export default EvaluateAttribute;

import React, { useRef, useEffect } from "react";
import styles from "./EvaluateDepViol.module.css";

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
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import { TabContext, TabList, TabPanel } from "@mui/lab";
import { useTheme, Theme } from "@mui/material/styles";

import * as d3 from "d3";

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

interface ErrorAnnotation {
  [key: string]: number; // Allows for a flexible structure with any string keys
}

interface ClassOutput {
  [key: string]: number | string; // Allows for a flexible structure with any string keys
}

// interface DatasetSchema {
//   index: number;
//   name: string;
// }

interface DepViolationResult {
  annotated_output: ErrorAnnotation[]; // Allows for a flexible structure with any string keys
  prompt_metadata: PromptMetadata[];
  column_summary: ColumnSummary[];
  dataset_size: number;
  true_positives: ClassOutput[];
  false_positives: ClassOutput[];
  false_negatives: ClassOutput[];
  metrics: {
    accuracy: string;
    precision: string;
    recall: string;
    f_score: string;
  };
}

interface EvaluateDepViolProps {
  depViolationResults: DepViolationResult;
  isLoading: boolean;
  isRequested: boolean;
  error: boolean;
}

const EvaluateDepViol: React.FC<EvaluateDepViolProps> = ({
  depViolationResults,
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

  const handleTabChange = (event: React.SyntheticEvent, newValue: string) => {
    setTabValue(newValue);
  };

  // const { column_summary, prompt_metadata } = depViolationResults;

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

  const handleSummaryExport = () => {
    // Define headers for the CSV
    const headers = [
      "column_1_name",
      "column_1_count",
      "column_2_name",
      "column_2_count",
    ];

    // Call the generic export function
    exportToCSV(
      depViolationResults.column_summary,
      headers,
      "column_summary.csv"
    );
  };

  const handlePromptExport = () => {
    // Define headers for the CSV
    const headers = [
      "completion_tokens",
      "elapsed_time",
      "prompt_tokens",
      "total_tokens",
      "prompt_name",
    ];

    // Call the generic export function
    exportToCSV(
      depViolationResults.prompt_metadata,
      headers,
      "prompt_metadata.csv"
    );
  };

  const renderErrorChart = (
    svgRef: React.RefObject<SVGSVGElement>,
    svgAxisRef: React.RefObject<SVGSVGElement>,
    data: ColumnSummary[],
    datasetSize: number,
    theme: Theme
  ) => {
    if (!svgRef.current) return;

    // Clear previous content
    d3.select(svgRef.current).selectAll("*").remove();
    d3.select(svgAxisRef.current).selectAll("*").remove();

    // Set up chart margins and dimensions
    const margin = { top: 0, right: 30, bottom: 0, left: 100 };
    const barHeight = 30;
    const barSpacing = 5;
    const dynamicHeight =
      data.length * (barHeight + barSpacing) + margin.top + margin.bottom;
    const dynamicWidth = 380;

    // Calculate error rates as percentages and create labels
    const columnData = data.map((d) => ({
      label: `${d.column_1_name}\n${d.column_2_name}`,
      column_1_rate: (d.column_1_count / datasetSize) * 100,
      column_2_rate: (d.column_2_count / datasetSize) * 100,
    }));

    // Set up x scale
    const maxRate =
      d3.max(columnData, (d) => Math.max(d.column_1_rate, d.column_2_rate)) ||
      0; // Ensure maxRate is never undefined
    const x = d3
      .scaleLinear()
      .domain([0, maxRate])
      .nice()
      .range([margin.left, dynamicWidth - margin.right]);

    // Y scale for groups
    const y0 = d3
      .scaleBand()
      .domain(columnData.map((d) => d.label))
      .range([margin.top, dynamicHeight - margin.bottom])
      .padding(0.2);

    // Inner y scale for column bars
    const y1 = d3
      .scaleBand()
      .domain(["column_1", "column_2"]) // Ensure both columns are included
      .range([0, y0.bandwidth()])
      .padding(0.05);

    const svg = d3.select(svgRef.current);
    svg.attr("width", dynamicWidth).attr("height", dynamicHeight);

    const axisSvg = d3.select(svgAxisRef.current);
    axisSvg.attr("width", dynamicWidth).attr("height", 50);

    // Colors for each column's bar
    const colorColumn1 = theme.palette.primary.main;
    const colorColumn2 = theme.palette.secondary.main;

    // Create grouped bars
    svg
      .append("g")
      .selectAll("g")
      .data(columnData)
      .join("g")
      .attr("transform", (d) => `translate(0, ${y0(d.label)})`)
      .each(function (d) {
        const group = d3.select(this);

        // Column 1 bar
        const column1Y = y1("column_1");
        const column2Y = y1("column_2");

        if (column1Y !== undefined) {
          group
            .append("rect")
            .attr("x", margin.left)
            .attr("y", column1Y) // Make sure this is defined
            .attr("width", x(d.column_1_rate) - margin.left)
            .attr("height", y1.bandwidth())
            .attr("fill", colorColumn1);
        }

        // Column 2 bar
        if (column2Y !== undefined) {
          group
            .append("rect")
            .attr("x", margin.left)
            .attr("y", column2Y) // Make sure this is defined
            .attr("width", x(d.column_2_rate) - margin.left)
            .attr("height", y1.bandwidth())
            .attr("fill", colorColumn2);
        }
      });

    // Add x-axis with error percentage labels
    axisSvg
      .append("g")
      .attr("transform", `translate(0,0)`)
      .call(
        d3
          .axisBottom(x)
          .ticks(10)
          .tickFormat((d) => `${d}%`)
      )
      .selectAll("text")
      .attr("transform", "rotate(-45)")
      .style("text-anchor", "end");

    // Add y-axis with concatenated column names as labels
    svg
      .append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y0)) // Standard y-axis with original labels
      .call((g) => {
        // Select all tick text elements and replace with multiline labels
        g.selectAll(".tick text").each(function (d, i) {
          const tick = d3.select(this);
          const lines = columnData[i].label.split("\n"); // Split the label into lines

          // Clear existing label
          tick.text(null);

          // Append each line as a separate tspan with different colors
          lines.forEach((line, index) => {
            tick
              .append("tspan")
              .attr("x", -5) // Shift each tspan slightly left for a margin
              .attr("dy", index === 0 ? "0em" : "1.2em") // Vertical offset for stacking
              .text(line)
              .style("text-anchor", "end") // Align text to the end
              .attr("dx", "-5") // Additional left margin
              .style(
                "fill",
                index === 0
                  ? theme.palette.primary.main
                  : theme.palette.secondary.main
              ); // Conditional color
          });
        });
      });
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
    const dynamicWidth = 360;

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
  };

  useEffect(() => {
    renderErrorChart(
      errorChartRef,
      errorAxisRef,
      depViolationResults.column_summary,
      depViolationResults.dataset_size,
      theme
    );
    if (tabValue === "2" && depViolationResults.prompt_metadata.length > 0) {
      renderPromptChart(
        promptChartRef,
        promptAxisRef,
        depViolationResults.prompt_metadata,
        selectedColumn,
        theme
      );
    }
  }, [
    theme,
    selectedColumn,
    depViolationResults.column_summary,
    depViolationResults.dataset_size,
    depViolationResults.prompt_metadata,
    tabValue,
  ]);

  return (
    <Box className={styles.container}>
      <Typography className={styles.header}>Dependency Violations</Typography>
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
                  Select Dependency Violation Detection
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
                    // onClick={() => {
                    //   console.log(depViolationResults.prompt_metadata);
                    // }}
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
                  Select Dependency Violation Detection
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
                    </Box>
                    <Box sx={{ ml: 1 }}>
                      <Typography>
                        {depViolationResults.metrics.accuracy}
                      </Typography>
                      <Typography>
                        {depViolationResults.metrics.precision}
                      </Typography>
                      <Typography>
                        {depViolationResults.metrics.recall}
                      </Typography>
                      <Typography>
                        {depViolationResults.metrics.f_score}
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

export default EvaluateDepViol;

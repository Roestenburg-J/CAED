import React, { useRef, useEffect } from "react";
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
  MenuItem,
  InputLabel,
  FormControl,
  Select,
} from "@mui/material";
import { TabContext, TabList, TabPanel } from "@mui/lab";
import { useTheme, Theme } from "@mui/material/styles";
import FileDownloadIcon from "@mui/icons-material/FileDownload";

import * as d3 from "d3";

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

  const theme = useTheme();

  const promptChartRef = useRef<SVGSVGElement | null>(null); // Ref for prompt chart
  const promptAxisRef = useRef<SVGSVGElement | null>(null); // Ref for error chart

  const [selectedColumn, setSelectedColumn] =
    React.useState<keyof PromptMetadata>("completion_tokens");

  const { dependencies, prompt_metadata } = dependecyResults;

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
      "column_1",
      "column_1_name",
      "column_2",
      "column_2_name",
      "dependency",
    ];
    // Call the generic export function
    exportToCSV(dependencies, headers, "dependencies.csv");
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
    exportToCSV(prompt_metadata, headers, "prompt_metadata.csv");
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
    if (tabValue === "2" && dependecyResults.prompt_metadata.length > 0) {
      renderPromptChart(
        promptChartRef,
        promptAxisRef,
        dependecyResults.prompt_metadata,
        selectedColumn,
        theme
      );
    }
  }, [tabValue, theme, selectedColumn, dependecyResults.prompt_metadata]);

  return (
    <Box className={styles.container}>
      <Typography className={styles.header}>Dependecies</Typography>
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
              <Tab label="Dependencies" value="1" />
              <Tab label="Prompt Metadata" value="2" />
            </TabList>
          </Box>
          <TabPanel value="1" sx={{ padding: 0 }}>
            {!isRequested ? (
              <Box className={styles.feedback}>
                <Typography variant="body1" align="center">
                  Select Dependency Detection
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
                <CircularProgress />
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
                            background: theme.palette.primary.main,
                            color: theme.palette.primary.contrastText,
                          }}
                        >
                          Dependency
                        </TableCell>
                        <TableCell
                          className={styles.stickyHeader}
                          sx={{
                            background: theme.palette.primary.main,
                            color: theme.palette.primary.contrastText,
                          }}
                        >
                          Description
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
                            <TableCell>
                              {dep.column_1_name} {dep.column_2_name}
                            </TableCell>
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
        </TabContext>
      </Box>
    </Box>
  );
};

export default DetectionDep;

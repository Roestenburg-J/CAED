"use client";
import Image from "next/image";
import styles from "./page.module.css";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  Typography,
  Box,
  Button,
  CircularProgress, // Import CircularProgress
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from "@mui/material";

import { getDetections } from "@/services/Retreive/Retreive";
import theme from "@/theme/theme";

interface Detection {
  dataset_name: string;
  timestamp: string;
  type: string;
  used_attribute: boolean;
  used_dependency: boolean;
  used_dependency_violations: boolean;
  gpt_model: string;
}

// Function to parse the timestamp in the format yyyymmdd_hhmmss
const parseTimestamp = (timestamp: string): Date => {
  const datePart = timestamp.split("_")[0];
  const timePart = timestamp.split("_")[1];

  const year = parseInt(datePart.substring(0, 4), 10);
  const month = parseInt(datePart.substring(4, 6), 10) - 1;
  const day = parseInt(datePart.substring(6, 8), 10);
  const hour = parseInt(timePart.substring(0, 2), 10);
  const minute = parseInt(timePart.substring(2, 4), 10);
  const second = parseInt(timePart.substring(4, 6), 10);

  return new Date(year, month, day, hour, minute, second);
};

export default function Home() {
  const router = useRouter();
  const [detections, setDetections] = useState<Detection[]>([]);
  const [loading, setLoading] = useState(true); // Add loading state

  // Fetch detections on component mount
  useEffect(() => {
    const fetchDetections = async () => {
      setLoading(true); // Set loading to true before fetching
      try {
        const data = await getDetections();
        setDetections(data);
      } catch (error) {
        console.error("Failed to fetch detections:", error);
      } finally {
        setLoading(false); // Set loading to false after data is fetched
      }
    };

    fetchDetections();
  }, []);

  return (
    <div className={styles.page}>
      <Typography variant="h1">CEAD</Typography>
      <Box className={styles.buttons}>
        <Button variant="outlined" onClick={() => router.push("/detect")}>
          Detect Errors
        </Button>
        <Button variant="outlined" onClick={() => router.push("/evaluate")}>
          Evaluate Tool
        </Button>
      </Box>

      {loading ? ( // Conditionally render CircularProgress or Table
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          // height="50vh"
        >
          <CircularProgress /> {/* Show CircularProgress while loading */}
        </Box>
      ) : (
        <Box>
          <TableContainer
            component={Paper}
            className={styles.scrollableTableContainer}
            sx={{ maxHeight: 200 }}
          >
            <Table
              sx={{ minWidth: 650 }}
              size="small"
              aria-label="a dense table"
            >
              <TableHead>
                <TableRow>
                  <TableCell
                    sx={{
                      background: theme.palette.primary.main,
                      color: theme.palette.primary.contrastText,
                    }}
                    className={styles.stickyHeader}
                  >
                    Dataset Name
                  </TableCell>
                  <TableCell
                    sx={{
                      background: theme.palette.primary.main,
                      color: theme.palette.primary.contrastText,
                    }}
                    className={styles.stickyHeader}
                    align="center"
                  >
                    Timestamp
                  </TableCell>
                  <TableCell
                    sx={{
                      background: theme.palette.primary.main,
                      color: theme.palette.primary.contrastText,
                    }}
                    className={styles.stickyHeader}
                    align="center"
                  >
                    Type
                  </TableCell>
                  <TableCell
                    sx={{
                      background: theme.palette.primary.main,
                      color: theme.palette.primary.contrastText,
                    }}
                    className={styles.stickyHeader}
                    align="center"
                  >
                    Model
                  </TableCell>
                  <TableCell
                    sx={{
                      background: theme.palette.primary.main,
                      color: theme.palette.primary.contrastText,
                    }}
                    className={styles.stickyHeader}
                    align="center"
                  >
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {detections.map((detection) => (
                  <TableRow key={detection.timestamp}>
                    <TableCell component="th" scope="row">
                      {detection.dataset_name}
                    </TableCell>
                    <TableCell align="center">
                      {parseTimestamp(detection.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell align="center">{detection.type}</TableCell>
                    <TableCell align="center">{detection.gpt_model}</TableCell>
                    <TableCell align="center">
                      <Button
                        variant="outlined"
                        onClick={() => {
                          const route =
                            detection.type === "evaluation"
                              ? "/evaluate"
                              : "/detect";
                          router.push(
                            `${route}?dataset_name=${detection.dataset_name}&timestamp=${detection.timestamp}&attribute=${detection.used_attribute}&dep=${detection.used_dependency}&depViol=${detection.used_dependency_violations}`
                          );
                        }}
                        style={{ marginLeft: "8px" }}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}
    </div>
  );
}

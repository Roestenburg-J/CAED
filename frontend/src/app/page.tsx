"use client";
import Image from "next/image";
import styles from "./page.module.css";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react"; // Import useEffect and useState

import { Typography, Box, Button } from "@mui/material";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";

import { getDetections } from "@/services/Retreive/Retreive";
import theme from "@/theme/theme";

interface Detection {
  dataset_name: string;
  timestamp: string; // Keep timestamp as a string for initial fetching
  type: string;
  used_attribute: boolean;
  used_dependency: boolean;
  used_dependency_violations: boolean;
}

// Function to parse the timestamp in the format yyyymmdd_hhmmss
const parseTimestamp = (timestamp: string): Date => {
  const datePart = timestamp.split("_")[0]; // Get the date part (yyyymmdd)
  const timePart = timestamp.split("_")[1]; // Get the time part (hhmmss)

  const year = parseInt(datePart.substring(0, 4), 10);
  const month = parseInt(datePart.substring(4, 6), 10) - 1; // Month is 0-indexed in Date
  const day = parseInt(datePart.substring(6, 8), 10);

  const hour = parseInt(timePart.substring(0, 2), 10);
  const minute = parseInt(timePart.substring(2, 4), 10);
  const second = parseInt(timePart.substring(4, 6), 10);

  return new Date(year, month, day, hour, minute, second);
};

export default function Home() {
  const router = useRouter();
  const [detections, setDetections] = useState<Detection[]>([]); // State to hold detections

  // Fetch detections on component mount
  useEffect(() => {
    const fetchDetections = async () => {
      try {
        const data = await getDetections(); // Assuming this returns a promise with detections
        setDetections(data); // Update state with fetched detections
      } catch (error) {
        console.error("Failed to fetch detections:", error);
      }
    };

    fetchDetections();
  }, []); // Empty dependency array means this runs once when the component mounts

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
      <Box>
        <TableContainer
          component={Paper}
          className={styles.scrollableTableContainer}
        >
          <Table sx={{ minWidth: 650 }} size="small" aria-label="a dense table">
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
                    {parseTimestamp(detection.timestamp).toLocaleString()}{" "}
                    {/* Format timestamp */}
                  </TableCell>
                  <TableCell align="center">{detection.type}</TableCell>
                  <TableCell align="center">
                    <Button
                      variant="outlined"
                      onClick={() => {
                        if (detection.type === "evaluation") {
                          router.push(
                            `/evaluate?dataset_name=${detection.dataset_name}&timestamp=${detection.timestamp}&attribute=${detection.used_attribute}&dep=${detection.used_dependency}&depViol=${detection.used_dependency_violations}`
                          );
                        } else {
                          router.push(
                            `/detect?dataset_name=${detection.dataset_name}&timestamp=${detection.timestamp}&attribute=${detection.used_attribute}&dep=${detection.used_dependency}&depViol=${detection.used_dependency_violations}`
                          );
                        }
                      }}
                      style={{ marginLeft: "8px" }} // Optional spacing
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
    </div>
  );
}

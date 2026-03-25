"use client";
import styles from "./page.module.css";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  Typography,
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
} from "@mui/material";

import { getDetections } from "@/services/Retreive/Retreive";
import theme from "@/theme/theme";

interface Detection {
  dataset_id: string;
  dataset_name: string;
  created_at: string;
  type: string;
  used_attribute: boolean;
  used_dependency: boolean;
  used_dependency_violations: boolean;
  model: string;
}

export default function Home() {
  const router = useRouter();
  const [detections, setDetections] = useState<Detection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetections = async () => {
      setLoading(true);
      try {
        const data = await getDetections();
        setDetections(data);
      } catch (error) {
        console.error("Failed to fetch detections:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDetections();
  }, []);

  return (
    <div className={styles.page}>
      <Typography variant="h1">CAED</Typography>
      <Box className={styles.buttons}>
        <Button variant="outlined" onClick={() => router.push("/detect")}>
          Detect Errors
        </Button>
        <Button variant="outlined" onClick={() => router.push("/evaluate")}>
          Evaluate Tool
        </Button>
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center">
          <CircularProgress />
        </Box>
      ) : (
        <Box>
          <TableContainer
            component={Paper}
            className={styles.scrollableTableContainer}
            sx={{ maxHeight: 200 }}
          >
            <Table sx={{ minWidth: 650 }} size="small" aria-label="a dense table">
              <TableHead>
                <TableRow>
                  {["Dataset Name", "Date", "Type", "Model", "Actions"].map((header) => (
                    <TableCell
                      key={header}
                      sx={{
                        background: theme.palette.primary.main,
                        color: theme.palette.primary.contrastText,
                      }}
                      className={styles.stickyHeader}
                      align={header === "Dataset Name" ? "left" : "center"}
                    >
                      {header}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {detections.map((detection) => (
                  <TableRow key={detection.dataset_id}>
                    <TableCell component="th" scope="row">
                      {detection.dataset_name}
                    </TableCell>
                    <TableCell align="center">
                      {new Date(detection.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell align="center">{detection.type}</TableCell>
                    <TableCell align="center">{detection.model}</TableCell>
                    <TableCell align="center">
                      <Button
                        variant="outlined"
                        onClick={() => {
                          const route =
                            detection.type === "evaluation" ? "/evaluate" : "/detect";
                          router.push(
                            `${route}?dataset_id=${detection.dataset_id}&attribute=${detection.used_attribute}&dep=${detection.used_dependency}&depViol=${detection.used_dependency_violations}`
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

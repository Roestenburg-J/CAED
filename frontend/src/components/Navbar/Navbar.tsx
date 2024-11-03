"use client";
import { useEffect, useState } from "react";
import { AppBar, Toolbar, Typography, Button } from "@mui/material";
import Link from "next/link";
import styles from "./Navbar.module.css";

const navItems = [
  { name: "Detect", path: "/detect" },
  { name: "Evaluate", path: "/patients" },
];

const Navbar: React.FC = () => {
  const [activeRoute, setActiveRoute] = useState<string>("");

  useEffect(() => {
    // Set the active route based on the current pathname
    setActiveRoute(window.location.pathname);
  }, []);

  const handleItemClick = (path: string) => {
    setActiveRoute(path);
  };

  return (
    <AppBar position="fixed" sx={{ height: 64 }}>
      <Toolbar className={styles.Toolbar}>
        <Typography variant="h6" className={styles.logo}>
          CAED
        </Typography>
        <div className={styles.navItems}>
          {navItems.map((item) => (
            <Link href={item.path} key={item.name}>
              <Button
                sx={{
                  color: "white", // Set button text color to white
                  "&:hover": {
                    backgroundColor: "rgba(255, 255, 255, 0.2)", // Optional: Change background color on hover
                  },
                }}
                onClick={() => handleItemClick(item.path)}
                className={`${styles.navItem} ${
                  activeRoute === item.path ? styles.active : ""
                }`}
              >
                {item.name}
              </Button>
            </Link>
          ))}
        </div>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;

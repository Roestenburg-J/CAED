// const application_service_url = "http://localhost:5000";
// const application_service_url = "http://backend:5000";

const application_service_url =
  process.env.REACT_APP_API_URL || "http://localhost:5000";

export { application_service_url };

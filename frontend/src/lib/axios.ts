import axios from "axios";
import { env } from "../config/env";

const apiClient = axios.create({
  baseURL: env.backendUrl,
  headers: { "Content-Type": "application/json" },
});

export default apiClient;

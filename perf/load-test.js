import http from "k6/http";
import { check } from "k6";

const targetUrl = __ENV.TARGET_URL;
const routes = (__ENV.ROUTES ?? "")
  .split(",")
  .map((route) => route.trim())
  .filter(Boolean);
const vus = Number(__ENV.VUS ?? 20);
const duration = __ENV.DURATION ?? "30s";
const rampUpDuration = __ENV.RAMP_UP ?? "5s";
const rampDownDuration = __ENV.RAMP_DOWN ?? "5s";
const scenario = __ENV.SCENARIO ?? "unknown";

if (!targetUrl) {
  throw new Error("TARGET_URL is required");
}

if (routes.length === 0) {
  throw new Error("ROUTES must contain at least one route");
}

export const options = {
  stages: [
    { duration: rampUpDuration, target: vus },
    { duration, target: vus },
    { duration: rampDownDuration, target: 0 },
  ],
  summaryTrendStats: ["avg", "min", "med", "max", "p(95)", "p(99)"],
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
  },
};

export default function loadTest() {
  const route = routes[__ITER % routes.length];
  const response = http.get(`${targetUrl}${route}`, {
    headers: {
      "cache-control": "no-cache",
    },
    tags: {
      perf_scenario: scenario,
      perf_route: route,
    },
  });

  check(response, {
    "status is 200": (result) => result.status === 200,
  });
}

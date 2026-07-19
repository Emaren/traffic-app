import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const command = fs.readFileSync("components/traffic/performance-command.tsx", "utf8");
const page = fs.readFileSync("app/admin/performance/page.tsx", "utf8");
const admin = fs.readFileSync("components/traffic/admin-notification-dashboard.tsx", "utf8");
const samplesProxy = fs.readFileSync("app/admin-api/performance/samples/route.ts", "utf8");

test("Performance Command is protected by the existing Traffic admin session", () => {
  assert.match(page, /hasAdminSession/);
  assert.match(page, /AdminLoginScreen/);
});

test("Performance Command can search a named user and inspect sample diagnostics", () => {
  assert.match(command, /Jim, Emaren, uid, visitor id/);
  assert.match(command, /user_query/);
  assert.match(command, /Top API requests/);
  assert.match(command, /Top resources/);
  assert.match(samplesProxy, /\/api\/admin\/performance\/samples/);
});

test("Performance Command includes route percentiles, build comparison, and Speed Report triage", () => {
  assert.match(command, /Route pressure/);
  assert.match(command, /Build comparison/);
  assert.match(command, /Speed Report inbox/);
  assert.match(command, /Mark reviewed/);
  assert.match(command, /Resolve/);
});

test("existing Traffic admin cockpit exposes the new Performance Command", () => {
  assert.match(admin, /href="\/admin\/performance"/);
});

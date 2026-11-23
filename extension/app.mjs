import { collectCanvas } from "./collector.mjs";
import { readCanvasPage } from "./read-page.mjs";

const source = document.getElementById("source");
const scan = document.getElementById("scan");
const download = document.getElementById("download");
const status = document.getElementById("status");
const issues = document.getElementById("issues");

const params = new URLSearchParams(location.hash.slice(1));
const rawTabID = params.get("tab");
const tabID = Number(rawTabID);
const origin = getHTTPSOrigin(params.get("origin"));
let snapshot;

if (rawTabID && Number.isSafeInteger(tabID) && tabID >= 0 && origin) {
  source.textContent = `Canvas site: ${new URL(origin).hostname}`;
  scan.disabled = false;
}

scan.addEventListener("click", async () => {
  if (scan.disabled) return;
  scan.disabled = true;
  snapshot = undefined;
  download.hidden = true;
  issues.hidden = true;
  issues.replaceChildren();
  status.textContent = "Reading Canvas. Keep the original Canvas tab open.";
  try {
    snapshot = await collectCanvas(origin, async (url) => {
      try {
        const [frame] = await chrome.scripting.executeScript({
          target: { tabId: tabID },
          func: readCanvasPage,
          args: [origin, url],
        });
        return frame.result;
      } catch {
        return { error: "Return to your signed-in Canvas tab and open Canvas Synced again." };
      }
    });
    renderResult(snapshot);
  } catch (error) {
    status.textContent = error.message;
  } finally {
    scan.disabled = false;
  }
});

download.addEventListener("click", () => {
  if (!snapshot) return;
  const url = URL.createObjectURL(new Blob([`${JSON.stringify(snapshot, null, 2)}\n`], {
    type: "application/json",
  }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `canvas-synced-${snapshot.exported_at.slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
});

function renderResult(result) {
  const courses = result.courses.length;
  const assignments = result.courses.reduce((total, course) => total + course.assignments.length, 0);
  const counts = `${courses} ${courses === 1 ? "course" : "courses"}, ${assignments} ${assignments === 1 ? "assignment" : "assignments"}.`;
  status.textContent = result.complete ? `Ready to download. ${counts}` : `Partial export. ${counts}`;
  if (result.courses_issue) addIssue(`Courses: ${result.courses_issue}`);
  for (const course of result.courses) {
    if (course.assignments_issue) addIssue(`${course.name || course.code || course.id}: ${course.assignments_issue}`);
  }
  issues.hidden = result.complete;
  download.hidden = false;
}

function addIssue(message) {
  const item = document.createElement("li");
  item.textContent = message;
  issues.append(item);
}

function getHTTPSOrigin(value) {
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && value === url.origin && !url.port) return url.origin;
  } catch {
    return null;
  }
  return null;
}

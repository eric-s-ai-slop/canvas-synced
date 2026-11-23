// The Ta collector's same-origin GET and bounded pagination model, scoped to
// the two lists needed for a portable course and assignment export.
const MAX_PAGES = 50;
const CONCURRENCY = 4;
const COURSE_LIST = "/api/v1/courses";

export async function collectCanvas(origin, readPage) {
  const courses = await collectList(origin, COURSE_LIST, { enrollment_state: "active" }, readPage);
  if (!courses.pages) {
    throw new Error(`Could not read your Canvas courses. ${courses.issue}`);
  }

  const output = await mapPool(courses.items, async (course) => {
    const assignments = await collectList(
      origin, `${COURSE_LIST}/${course.id}/assignments`, {}, readPage,
    );
    return {
      id: course.id,
      name: text(course.name),
      code: text(course.course_code),
      url: `${origin}/courses/${course.id}`,
      assignments: assignments.items.map((assignment) => ({
        id: assignment.id,
        name: text(assignment.name),
        due_at: timestamp(assignment.due_at),
        unlock_at: timestamp(assignment.unlock_at),
        lock_at: timestamp(assignment.lock_at),
        url: `${origin}/courses/${course.id}/assignments/${assignment.id}`,
      })),
      assignments_complete: assignments.issue === null,
      assignments_issue: assignments.issue,
    };
  });

  return {
    schema_version: 1,
    canvas_origin: origin,
    exported_at: new Date().toISOString(),
    complete: courses.issue === null && output.every((course) => course.assignments_complete),
    courses_issue: courses.issue,
    courses: output,
  };
}

async function collectList(origin, path, filters, readPage) {
  const initial = new URL(path, origin);
  initial.search = new URLSearchParams({ ...filters, per_page: "100" }).toString();
  const items = new Map();
  const visited = new Set();
  let next = initial;
  let pages = 0;
  let issue = null;

  while (next && pages < MAX_PAGES) {
    visited.add(next.href);
    try {
      const response = await readPage(next.href);
      if (response.error) throw new Error(response.error);
      if (response.status !== 200) throw new Error(statusMessage(response.status));
      const data = JSON.parse(response.body);
      if (!Array.isArray(data)) throw new Error("Canvas returned an unexpected list.");
      pages += 1;
      for (const item of data) {
        const id = item?.id;
        if ((Number.isSafeInteger(id) && id > 0) ||
            (typeof id === "string" && /^[1-9][0-9]{0,19}$/u.test(id))) {
          items.set(String(id), { ...item, id: String(id) });
        } else {
          issue = "Canvas returned a record without a valid ID.";
        }
      }
      next = nextPage(response.link, initial, filters);
      if (next && visited.has(next.href)) throw new Error("Canvas repeated a pagination link.");
    } catch (error) {
      issue = error instanceof SyntaxError ? "Canvas returned a non-JSON response." : error.message;
      break;
    }
  }

  if (next && !issue) issue = "The export reached the 50-page limit for this list.";
  return { items: [...items.values()], pages, issue };
}

function nextPage(header, initial, filters) {
  // Instructure sends a Link header with an absolute URL for rel="next".
  const match = /<([^>]+)>\s*;\s*rel\s*=\s*(?:"next"|next)(?=\s*(?:[,;]|$))/iu.exec(header ?? "");
  if (!match) return null;
  const url = new URL(match[1], initial);
  if (url.origin !== initial.origin || url.pathname !== initial.pathname ||
      url.username || url.password || url.hash) {
    throw new Error("Canvas returned a pagination link outside the current list.");
  }
  const allowed = new Set(["page", "per_page", ...Object.keys(filters)]);
  for (const key of url.searchParams.keys()) {
    const values = url.searchParams.getAll(key);
    if (!allowed.has(key) || values.length !== 1 ||
        (Object.hasOwn(filters, key) && values[0] !== filters[key])) {
      throw new Error("Canvas returned an unexpected pagination filter.");
    }
  }
  for (const [key, value] of Object.entries(filters)) {
    url.searchParams.set(key, value);
  }
  return url;
}

function statusMessage(status) {
  if (status === 401 || status === 403) return "Sign in to Canvas and check your access.";
  if (status === 429) return "Canvas rate-limited the request. Try again in a few minutes.";
  return `Canvas returned HTTP ${status}.`;
}

function text(value) {
  return typeof value === "string" ? value : null;
}

function timestamp(value) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

// Keep the original collector's bounded, ordered fan-out.
async function mapPool(items, worker) {
  const results = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index]);
    }
  });
  await Promise.all(runners);
  return results;
}

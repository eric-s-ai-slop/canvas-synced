import assert from "node:assert/strict";
import test from "node:test";
import { collectCanvas } from "../extension/collector.mjs";

const origin = "https://lms.example.edu";
const coursePath = "/api/v1/courses";
const assignments = (id) => `${coursePath}/${id}/assignments`;
const ok = (items, link = null) => ({ status: 200, body: JSON.stringify(items), link });

test("exports projected fields from a school's own domain and follows paginated lists", async () => {
  const seen = [];
  const result = await collectCanvas(origin, async (url) => {
    const parsed = new URL(url);
    assert.equal(parsed.origin, origin);
    seen.push(parsed.pathname + parsed.search);
    if (parsed.pathname === coursePath) {
      assert.equal(parsed.searchParams.get("enrollment_state"), "active");
      if (parsed.searchParams.has("page")) return ok([{ id: 2, name: "Physics" }]);
      return ok([{ id: 1, name: "Writing", course_code: "WR1", syllabus_body: "<p>Private</p>" }],
        `<${origin}${coursePath}?page=2&per_page=100>; rel="next"`);
    }
    if (parsed.pathname === assignments(1)) {
      if (parsed.searchParams.has("page")) return ok([{ id: "20", name: "Essay two" }]);
      return ok([{ id: 10, name: "Essay one", due_at: "2026-12-01T10:30:00-05:00", description: "Private" }],
        `<${assignments(1)}?page=2>; rel="next"`);
    }
    assert.equal(parsed.pathname, assignments(2));
    return ok([]);
  });
  assert.equal(result.complete, true);
  assert.equal(seen.length, 5);
  assert.equal(result.canvas_origin, origin);
  assert.deepEqual(result.courses.map(({ id }) => id), ["1", "2"]);
  assert.deepEqual(result.courses[0].assignments[0], {
    id: "10",
    name: "Essay one",
    due_at: "2026-12-01T15:30:00.000Z",
    unlock_at: null,
    lock_at: null,
    url: `${origin}/courses/1/assignments/10`,
  });
  assert.equal(result.courses[0].assignments[1].id, "20");
  assert.doesNotMatch(JSON.stringify(result), /Private|syllabus_body|description/u);
});

test("marks blocked and untrusted pagination as partial without leaving the current list", async () => {
  const requested = [];
  const result = await collectCanvas(origin, async (url) => {
    const { pathname } = new URL(url);
    requested.push(pathname);
    if (pathname === coursePath) return ok([{ id: 1 }, { id: 2 }, { id: 3 }]);
    if (pathname === assignments(1)) return { status: 403 };
    if (pathname === assignments(2)) {
      return ok([{ id: 42 }], `<https://outside.example${assignments(2)}?page=2>; rel="next"`);
    }
    return ok([], `<${origin}${assignments(2)}?page=2>; rel="next"`);
  });
  assert.equal(result.complete, false);
  assert.deepEqual(requested, [coursePath, assignments(1), assignments(2), assignments(3)]);
  assert.match(result.courses[0].assignments_issue, /check your access/u);
  assert.equal(result.courses[1].assignments[0].id, "42");
  assert.match(result.courses[1].assignments_issue, /outside the current list/u);
  assert.match(result.courses[2].assignments_issue, /outside the current list/u);
});

test("reports an unreadable first page and an empty successful course list distinctly", async () => {
  await assert.rejects(collectCanvas(origin, async () => ({ status: 401 })), /Sign in/u);
  await assert.rejects(collectCanvas(origin, async () => ({ status: 200, body: "<!doctype html>" })), /non-JSON/u);
  const empty = await collectCanvas(origin, async () => ok([]));
  assert.equal(empty.complete, true);
  assert.deepEqual(empty.courses, []);
});

import { describe, expect, test } from "vitest";
import { addDays, isDate, price, slotError, toInstant, toLocal } from "../src/rules.js";

describe("time zone", () => {
  test("converts Belgrade wall time to an instant in winter and summer", () => {
    expect(toInstant("2026-12-10", 18 * 60).toISOString()).toBe("2026-12-10T17:00:00.000Z");
    expect(toInstant("2026-07-10", 18 * 60).toISOString()).toBe("2026-07-10T16:00:00.000Z");
  });

  test("handles the days when the clocks change", () => {
    expect(toInstant("2026-10-25", 10 * 60).toISOString()).toBe("2026-10-25T09:00:00.000Z");
    expect(toInstant("2027-03-28", 10 * 60).toISOString()).toBe("2027-03-28T08:00:00.000Z");
    expect(toLocal(new Date("2027-03-28T08:00:00Z"))).toEqual({ date: "2027-03-28", minutes: 600 });
  });

  test("validates and adds dates", () => {
    expect(isDate("2026-02-29")).toBe(false);
    expect(isDate("2028-02-29")).toBe(true);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("price", () => {
  test("weekday mornings are cheaper than evenings and weekends", () => {
    expect(price("2026-11-04", 10 * 60, 60)).toBe(2400);
    expect(price("2026-11-04", 18 * 60, 60)).toBe(3200);
    expect(price("2026-11-07", 10 * 60, 60)).toBe(3200);
  });

  test("a booking across 16:00 is priced per half hour", () => {
    expect(price("2026-11-04", 15 * 60, 120)).toBe(2400 + 3200);
    expect(price("2026-11-04", 15 * 60 + 30, 90)).toBe(1200 + 3200);
  });
});

describe("slot rules", () => {
  const now = new Date("2026-11-04T09:15:00Z");

  test("accepts a normal slot", () => {
    expect(slotError({ date: "2026-11-05", start: 18 * 60, duration: 90 }, now)).toBeNull();
  });

  test("rejects bad input and closed hours", () => {
    expect(slotError({ date: "2026-11-05", start: 18 * 60 + 15, duration: 60 }, now)).toBe("bad_start");
    expect(slotError({ date: "2026-11-05", start: 18 * 60, duration: 45 }, now)).toBe("bad_duration");
    expect(slotError({ date: "2026-11-05", start: 7 * 60 + 30, duration: 60 }, now)).toBe("closed");
    expect(slotError({ date: "2026-11-05", start: 22 * 60, duration: 90 }, now)).toBe("closed");
  });

  test("rejects the past and dates too far ahead", () => {
    expect(slotError({ date: "2026-11-04", start: 10 * 60, duration: 60 }, now)).toBe("past");
    expect(slotError({ date: "2026-11-04", start: 11 * 60, duration: 60 }, now)).toBeNull();
    expect(slotError({ date: "2026-11-19", start: 10 * 60, duration: 60 }, now)).toBe("too_far");
  });
});

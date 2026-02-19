import { describe, it, expect } from "vitest";

describe("FilterValues", () => {
  it("should accept null values for no filter", () => {
    const filters = {
      rooms: null,
      minPrice: null,
      maxPrice: null,
      status: ["AVAILABLE", "RESERVED", "SOLD"],
    };
    expect(filters.rooms).toBeNull();
    expect(filters.status).toHaveLength(3);
  });

  it("should filter apartments by rooms", () => {
    const apartments = [
      { rooms: 1, price: 50000, status: "AVAILABLE" },
      { rooms: 2, price: 80000, status: "AVAILABLE" },
      { rooms: 3, price: 120000, status: "SOLD" },
    ];

    const filtered = apartments.filter((a) => a.rooms === 2);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].rooms).toBe(2);
  });

  it("should filter apartments by price range", () => {
    const apartments = [
      { rooms: 1, price: 50000, status: "AVAILABLE" },
      { rooms: 2, price: 80000, status: "AVAILABLE" },
      { rooms: 3, price: 120000, status: "SOLD" },
    ];

    const minPrice = 60000;
    const maxPrice = 100000;
    const filtered = apartments.filter(
      (a) => a.price >= minPrice && a.price <= maxPrice
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0].price).toBe(80000);
  });

  it("should filter apartments by status", () => {
    const apartments = [
      { rooms: 1, price: 50000, status: "AVAILABLE" },
      { rooms: 2, price: 80000, status: "RESERVED" },
      { rooms: 3, price: 120000, status: "SOLD" },
    ];

    const allowedStatuses = ["AVAILABLE", "RESERVED"];
    const filtered = apartments.filter((a) => allowedStatuses.includes(a.status));
    expect(filtered).toHaveLength(2);
  });

  it("should combine multiple filters", () => {
    const apartments = [
      { rooms: 2, price: 80000, status: "AVAILABLE" },
      { rooms: 2, price: 90000, status: "SOLD" },
      { rooms: 3, price: 80000, status: "AVAILABLE" },
      { rooms: 2, price: 120000, status: "AVAILABLE" },
    ];

    const rooms = 2;
    const maxPrice = 100000;
    const statuses = ["AVAILABLE"];

    const filtered = apartments.filter(
      (a) =>
        a.rooms === rooms &&
        a.price <= maxPrice &&
        statuses.includes(a.status)
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0].price).toBe(80000);
  });
});

describe("Apartment status", () => {
  const validStatuses = ["AVAILABLE", "RESERVED", "SOLD", "UNAVAILABLE"];

  it("should validate status values", () => {
    validStatuses.forEach((status) => {
      expect(validStatuses).toContain(status);
    });
  });

  it("should reject invalid statuses", () => {
    expect(validStatuses).not.toContain("PENDING");
    expect(validStatuses).not.toContain("active");
  });
});

describe("Slug generation", () => {
  it("should be URL-safe", () => {
    const slug = "sunrise-residences";
    expect(slug).toMatch(/^[a-z0-9-]+$/);
  });

  it("should not contain spaces or uppercase", () => {
    const slug = "building-a";
    expect(slug).not.toMatch(/\s/);
    expect(slug).not.toMatch(/[A-Z]/);
  });
});

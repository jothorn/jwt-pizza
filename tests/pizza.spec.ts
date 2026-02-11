import { Page } from "@playwright/test";
import { test, expect } from "playwright-test-coverage";
import { User, Role } from "../src/service/pizzaService";

async function basicInit(page: Page) {
  let loggedInUser: User | undefined;
  const validUsers: Record<string, User> = {
    "d@jwt.com": {
      id: "3",
      name: "Kai Chen",
      email: "d@jwt.com",
      password: "a",
      roles: [{ role: Role.Diner }],
    },
    "f@jwt.com": {
      id: "4",
      name: "Franchisee",
      email: "f@jwt.com",
      password: "a",
      roles: [{ role: Role.Franchisee }],
    },
    "a@jwt.com": {
      id: "5",
      name: "Admin User",
      email: "a@jwt.com",
      password: "a",
      roles: [{ role: Role.Admin }],
    },
  };

  // Authorize login for the given user
  await page.route("*/**/api/auth", async (route) => {
    const loginReq = route.request().postDataJSON();
    const user = validUsers[loginReq.email];
    if (!user || user.password !== loginReq.password) {
      await route.fulfill({ status: 401, json: { error: "Unauthorized" } });
      return;
    }
    loggedInUser = validUsers[loginReq.email];
    const loginRes = {
      user: loggedInUser,
      token: "abcdef",
    };
    expect(route.request().method()).toBe("PUT");
    await route.fulfill({ json: loginRes });
  });

  // Return the currently logged in user
  await page.route("*/**/api/user/me", async (route) => {
    expect(route.request().method()).toBe("GET");
    await route.fulfill({ json: loggedInUser });
  });

  // A standard menu
  await page.route("*/**/api/order/menu", async (route) => {
    const menuRes = [
      {
        id: 1,
        title: "Veggie",
        image: "pizza1.png",
        price: 0.0038,
        description: "A garden of delight",
      },
      {
        id: 2,
        title: "Pepperoni",
        image: "pizza2.png",
        price: 0.0042,
        description: "Spicy treat",
      },
    ];
    expect(route.request().method()).toBe("GET");
    await route.fulfill({ json: menuRes });
  });

  // User's franchises (GET /api/franchise/:userId) for franchisee dashboard
  await page.route(/\/api\/franchise\/\d+$/, async (route) => {
    expect(route.request().method()).toBe("GET");
    const userId = route.request().url().split("/").pop();
    if (userId === "4") {
      await route.fulfill({
        json: [
          {
            id: 2,
            name: "LotaPizza",
            stores: [
              { id: 4, name: "Lehi" },
              { id: 5, name: "Springville" },
              { id: 6, name: "American Fork" },
            ],
          },
        ],
      });
    } else {
      await route.fulfill({ json: [] });
    }
  });

  // Standard franchises and stores (public list with query params)
  await page.route(/\/api\/franchise(\?.*)?$/, async (route) => {
    const franchiseRes = {
      franchises: [
        {
          id: 2,
          name: "LotaPizza",
          stores: [
            { id: 4, name: "Lehi" },
            { id: 5, name: "Springville" },
            { id: 6, name: "American Fork" },
          ],
        },
        { id: 3, name: "PizzaCorp", stores: [{ id: 7, name: "Spanish Fork" }] },
        { id: 4, name: "topSpot", stores: [] },
      ],
    };
    expect(route.request().method()).toBe("GET");
    await route.fulfill({ json: franchiseRes });
  });

  // Order a pizza.
  await page.route("*/**/api/order", async (route) => {
    const orderReq = route.request().postDataJSON();
    const orderRes = {
      order: { ...orderReq, id: 23 },
      jwt: "eyJpYXQ",
    };
    expect(route.request().method()).toBe("POST");
    await route.fulfill({ json: orderRes });
  });

  await page.goto("/");
}

test("login", async ({ page }) => {
  await basicInit(page);
  await page.getByRole("link", { name: "Login" }).click();
  await page.getByRole("textbox", { name: "Email address" }).fill("d@jwt.com");
  await page.getByRole("textbox", { name: "Password" }).fill("a");
  await page.getByRole("button", { name: "Login" }).click();

  await expect(page.getByRole("link", { name: "KC" })).toBeVisible();
});

test("purchase with login", async ({ page }) => {
  await basicInit(page);

  // Go to order page
  await page.getByRole("button", { name: "Order now" }).click();

  // Create order
  await expect(page.locator("h2")).toContainText("Awesome is a click away");
  await page.getByRole("combobox").selectOption("4");
  await page.getByRole("link", { name: "Image Description Veggie A" }).click();
  await page.getByRole("link", { name: "Image Description Pepperoni" }).click();
  await expect(page.locator("form")).toContainText("Selected pizzas: 2");
  await page.getByRole("button", { name: "Checkout" }).click();

  // Login
  await page.getByPlaceholder("Email address").click();
  await page.getByPlaceholder("Email address").fill("d@jwt.com");
  await page.getByPlaceholder("Email address").press("Tab");
  await page.getByPlaceholder("Password").fill("a");
  await page.getByRole("button", { name: "Login" }).click();

  // Pay
  await expect(page.getByRole("main")).toContainText(
    "Send me those 2 pizzas right now!",
  );
  await expect(page.locator("tbody")).toContainText("Veggie");
  await expect(page.locator("tbody")).toContainText("Pepperoni");
  await expect(page.locator("tfoot")).toContainText("0.008 ₿");
  await page.getByRole("button", { name: "Pay now" }).click();

  // Check balance
  await expect(page.getByText("0.008")).toBeVisible();
});

test("create store", async ({ page }) => {
  await basicInit(page);

  // Mock create store API
  await page.route(/\/api\/franchise\/\d+\/store$/, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const body = route.request().postDataJSON();
    await route.fulfill({
      json: { id: 8, name: body.name, totalRevenue: 0 },
    });
  });

  // Login as franchisee
  await page.getByRole("link", { name: "Login" }).click();
  await page.getByRole("textbox", { name: "Email address" }).fill("f@jwt.com");
  await page.getByRole("textbox", { name: "Password" }).fill("a");
  await page.getByRole("button", { name: "Login" }).click();

  await expect(
    page.getByRole("link", { name: "F", exact: true }),
  ).toBeVisible();

  // Go to franchise dashboard (nav link, not footer)
  await page
    .getByRole("navigation", { name: "Global" })
    .getByRole("link", { name: "Franchise" })
    .click();
  await expect(page.getByRole("heading", { name: "LotaPizza" })).toBeVisible();

  // Open create store
  await page.getByRole("button", { name: "Create store" }).click();
  await expect(
    page.getByRole("heading", { name: "Create store" }),
  ).toBeVisible();

  // Enter store name and submit
  await page.getByPlaceholder("store name").fill("My New Store");
  await page.getByRole("button", { name: "Create" }).click();

  // Back on franchise dashboard
  await expect(page.getByRole("heading", { name: "LotaPizza" })).toBeVisible();
});

test("close store", async ({ page }) => {
  await basicInit(page);

  // Mock delete store API
  await page.route(/\/api\/franchise\/\d+\/store\/\d+$/, async (route) => {
    if (route.request().method() !== "DELETE") return route.continue();
    await route.fulfill({ json: { message: "store deleted" } });
  });

  // Login as franchisee
  await page.getByRole("link", { name: "Login" }).click();
  await page.getByRole("textbox", { name: "Email address" }).fill("f@jwt.com");
  await page.getByRole("textbox", { name: "Password" }).fill("a");
  await page.getByRole("button", { name: "Login" }).click();

  await expect(
    page.getByRole("link", { name: "F", exact: true }),
  ).toBeVisible();

  // Go to franchise dashboard
  await page
    .getByRole("navigation", { name: "Global" })
    .getByRole("link", { name: "Franchise" })
    .click();
  await expect(page.getByRole("heading", { name: "LotaPizza" })).toBeVisible();

  // Click Close for the Lehi store row
  await page
    .getByRole("row")
    .filter({ hasText: "Lehi" })
    .getByRole("button", { name: "Close" })
    .click();

  // Confirm on close store page
  await expect(
    page.getByRole("heading", { name: "Sorry to see you go" }),
  ).toBeVisible();
  await expect(page.getByRole("main")).toContainText("LotaPizza");
  await expect(page.getByRole("main")).toContainText("Lehi");
  await page.getByRole("button", { name: "Close" }).click();

  // Back on franchise dashboard
  await expect(page.getByRole("heading", { name: "LotaPizza" })).toBeVisible();
});

test("create franchise", async ({ page }) => {
  await basicInit(page);

  // Mock create franchise API (POST /api/franchise only)
  await page.route("**/api/franchise", async (route) => {
    const req = route.request();
    const pathname = new URL(req.url()).pathname;
    if (req.method() === "POST" && pathname === "/api/franchise") {
      const body = req.postDataJSON();
      await route.fulfill({
        json: {
          id: 5,
          name: body.name,
          admins: [
            {
              email: body.admins?.[0]?.email,
              id: 4,
              name: "pizza franchisee",
            },
          ],
        },
      });
    } else {
      await route.continue();
    }
  });

  // Login as admin
  await page.getByRole("link", { name: "Login" }).click();
  await page.getByRole("textbox", { name: "Email address" }).fill("a@jwt.com");
  await page.getByRole("textbox", { name: "Password" }).fill("a");
  await page.getByRole("button", { name: "Login" }).click();

  await expect(
    page.getByRole("link", { name: "AU", exact: true }),
  ).toBeVisible();

  // Go to admin dashboard (nav link)
  await page
    .getByRole("navigation", { name: "Global" })
    .getByRole("link", { name: "Admin" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Mama Ricci's kitchen" }),
  ).toBeVisible();

  // Open create franchise
  await page.getByRole("button", { name: "Add Franchise" }).click();
  await expect(
    page.getByRole("heading", { name: "Create franchise" }),
  ).toBeVisible();

  // Enter franchise name and franchisee email, then create
  await page.getByPlaceholder("franchise name").fill("New Pie Co");
  await page
    .getByPlaceholder("franchisee admin email")
    .fill("f@jwt.com");
  await page.getByRole("button", { name: "Create" }).click();

  // Back on admin dashboard
  await expect(
    page.getByRole("heading", { name: "Mama Ricci's kitchen" }),
  ).toBeVisible();
});

test("close franchise", async ({ page }) => {
  await basicInit(page);

  // Mock delete franchise API (DELETE /api/franchise/:id only)
  await page.route(/\/api\/franchise\/\d+$/, async (route) => {
    if (route.request().method() === "DELETE") {
      await route.fulfill({ json: { message: "franchise deleted" } });
    } else {
      await route.continue();
    }
  });

  // Login as admin
  await page.getByRole("link", { name: "Login" }).click();
  await page.getByRole("textbox", { name: "Email address" }).fill("a@jwt.com");
  await page.getByRole("textbox", { name: "Password" }).fill("a");
  await page.getByRole("button", { name: "Login" }).click();

  await expect(
    page.getByRole("link", { name: "AU", exact: true }),
  ).toBeVisible();

  // Go to admin dashboard
  await page
    .getByRole("navigation", { name: "Global" })
    .getByRole("link", { name: "Admin" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Mama Ricci's kitchen" }),
  ).toBeVisible();

  // Click Close for the topSpot franchise row (no stores, so single row)
  await page
    .getByRole("row")
    .filter({ hasText: "topSpot" })
    .getByRole("button", { name: "Close" })
    .click();

  // Confirm on close franchise page
  await expect(
    page.getByRole("heading", { name: "Sorry to see you go" }),
  ).toBeVisible();
  await expect(page.getByRole("main")).toContainText("topSpot");
  await page.getByRole("button", { name: "Close" }).click();

  // Back on admin dashboard
  await expect(
    page.getByRole("heading", { name: "Mama Ricci's kitchen" }),
  ).toBeVisible();
});

test("register", async ({ page }) => {
  await basicInit(page);

  // Mock register (POST /api/auth)
  await page.route("*/**/api/auth", async (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      const user = {
        id: "6",
        name: body.name,
        email: body.email,
        roles: [{ role: Role.Diner }],
      };
      await route.fulfill({
        json: { user, token: "xyz" },
      });
    } else {
      await route.continue();
    }
  });

  // Go to register page
  await page.getByRole("link", { name: "Register" }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome to the party" }),
  ).toBeVisible();

  // Fill form and submit
  await page.getByPlaceholder("Full name").fill("New User");
  await page.getByPlaceholder("Email address").fill("nu@jwt.com");
  await page.getByPlaceholder("Password").fill("secret");
  await page.getByRole("button", { name: "Register" }).click();

  // Logged in and back on home (user initial in header)
  await expect(
    page.getByRole("link", { name: "NU", exact: true }),
  ).toBeVisible();
});

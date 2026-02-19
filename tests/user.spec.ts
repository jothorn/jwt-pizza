import { test, expect } from "playwright-test-coverage";

test("updateUser", async ({ page }) => {
  const email = `user${Math.floor(Math.random() * 10000)}@jwt.com`;
  const password = "diner";

  // In-memory backend state for CI (no real backend in GitHub Actions)
  let userStore: {
    id: string;
    name: string;
    email: string;
    roles: { role: string }[];
  } = { id: "1", name: "pizza diner", email, roles: [{ role: "diner" }] };
  let authToken: string = "mock-token";

  await page.route("*/**/api/auth", async (route) => {
    const req = route.request();
    const method = req.method();
    if (method === "DELETE") {
      await route.fulfill({ status: 200, json: { message: "logout successful" } });
      return;
    }
    let data: Record<string, unknown> = {};
    try {
      data = (await req.postDataJSON()) ?? {};
    } catch {
      // no body or invalid JSON
    }
    if (method === "POST") {
      // Register: use provided name/email, store user
      userStore = {
        id: String(Math.floor(Math.random() * 100000)),
        name: (data.name as string) ?? "pizza diner",
        email: (data.email as string) ?? email,
        roles: [{ role: "diner" }],
      };
      authToken = `token-${userStore.id}`;
      await route.fulfill({ status: 200, json: { user: userStore, token: authToken } });
      return;
    }
    if (method === "PUT") {
      // Login: accept if email matches our stored user (any password in mock)
      if (data.email === email) {
        await route.fulfill({ status: 200, json: { user: userStore, token: authToken } });
      } else {
        await route.fulfill({ status: 401, json: { message: "unauthorized" } });
      }
      return;
    }
    await route.continue();
  });

  await page.route("*/**/api/user/me", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({ status: 200, json: userStore });
  });

  await page.route("*/**/api/user/*", async (route) => {
    if (route.request().method() !== "PUT") {
      await route.continue();
      return;
    }
    let body: Record<string, unknown> = {};
    try {
      body = (await route.request().postDataJSON()) ?? {};
    } catch {
      // no body or invalid JSON
    }
    if (body.name !== undefined) userStore.name = body.name as string;
    if (body.email !== undefined) userStore.email = body.email as string;
    await route.fulfill({ status: 200, json: { user: userStore, token: authToken } });
  });

  await page.goto("/");
  await page.getByRole("link", { name: "Register" }).click();
  await page.getByRole("textbox", { name: "Full name" }).fill("pizza diner");
  await page.getByRole("textbox", { name: "Email address" }).fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill(password);
  await page.getByRole("button", { name: "Register" }).click();

  await page.getByRole("link", { name: "pd" }).click();

  await expect(page.getByRole("main")).toContainText("pizza diner");

  await page.getByRole("button", { name: "Edit" }).click();
  await expect(page.locator("h3")).toContainText("Edit user");
  await page.getByRole("button", { name: "Update" }).click();

  await page.waitForSelector('[role="dialog"].hidden', { state: "attached" });

  await expect(page.getByRole("main")).toContainText("pizza diner");

  await page.getByRole("button", { name: "Edit" }).click();
  await expect(page.locator("h3")).toContainText("Edit user");
  await page.getByRole("textbox").first().fill("pizza dinerx");
  await page.getByRole("button", { name: "Update" }).click();

  await page.waitForSelector('[role="dialog"].hidden', { state: "attached" });

  await expect(page.getByRole("main")).toContainText("pizza dinerx");

  await page.getByRole("link", { name: "Logout" }).click();
  await page.getByRole("link", { name: "Login" }).click();

  await page.getByRole("textbox", { name: "Email address" }).fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill("diner");
  await page.getByRole("button", { name: "Login" }).click();

  await page.getByRole("link", { name: "pd" }).click();

  await expect(page.getByRole("main")).toContainText("pizza dinerx");
});

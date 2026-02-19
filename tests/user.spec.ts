import { test, expect } from "playwright-test-coverage";

// Helper function to set up mock backend routes
function setupMockBackend(
  page: any,
  userStore: any,
  authToken: string,
  checkPassword: boolean = false,
) {
  page.route("*/**/api/auth", async (route: any) => {
    const req = route.request();
    const method = req.method();
    if (method === "DELETE") {
      await route.fulfill({
        status: 200,
        json: { message: "logout successful" },
      });
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
      userStore.value = {
        id: String(Math.floor(Math.random() * 100000)),
        name: (data.name as string) ?? "pizza diner",
        email: (data.email as string) ?? userStore.value.email,
        roles: [{ role: "diner" }],
      };
      authToken = `token-${userStore.value.id}`;
      await route.fulfill({
        status: 200,
        json: { user: userStore.value, token: authToken },
      });
      return;
    }
    if (method === "PUT") {
      // Login: check credentials based on checkPassword flag
      const emailMatch = data.email === userStore.value.email;
      const passwordMatch = checkPassword
        ? data.password === userStore.value.password
        : true;
      if (emailMatch && passwordMatch) {
        await route.fulfill({
          status: 200,
          json: { user: userStore.value, token: authToken },
        });
      } else {
        await route.fulfill({ status: 401, json: { message: "unauthorized" } });
      }
      return;
    }
    await route.continue();
  });

  page.route("*/**/api/user/me", async (route: any) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({ status: 200, json: userStore.value });
  });

  page.route("*/**/api/user/*", async (route: any) => {
    const method = route.request().method();
    if (method === "DELETE") {
      await route.fulfill({
        status: 200,
        json: { message: "user deleted" },
      });
      return;
    }
    if (method !== "PUT") {
      await route.continue();
      return;
    }
    let body: Record<string, unknown> = {};
    try {
      body = (await route.request().postDataJSON()) ?? {};
    } catch {
      // no body or invalid JSON
    }
    if (body.name !== undefined) userStore.value.name = body.name as string;
    if (body.email !== undefined) userStore.value.email = body.email as string;
    if (body.password !== undefined)
      userStore.value.password = body.password as string;
    await route.fulfill({
      status: 200,
      json: { user: userStore.value, token: authToken },
    });
  });
}

// Helper function to register a user
async function registerUser(
  page: any,
  name: string,
  email: string,
  password: string,
) {
  await page.goto("/");
  await page.getByRole("link", { name: "Register" }).click();
  await page.getByRole("textbox", { name: "Full name" }).fill(name);
  await page.getByRole("textbox", { name: "Email address" }).fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill(password);
  await page.getByRole("button", { name: "Register" }).click();
}

test("updateUser", async ({ page }) => {
  const email = `user${Math.floor(Math.random() * 10000)}@jwt.com`;
  const password = "diner";

  // In-memory backend state for CI (no real backend in GitHub Actions)
  const userStore = {
    value: { id: "1", name: "pizza diner", email, roles: [{ role: "diner" }] },
  };
  let authToken = "mock-token";

  setupMockBackend(page, userStore, authToken, false);

  await registerUser(page, "pizza diner", email, password);

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

test("changePasswordAndEmail", async ({ page }) => {
  const originalEmail = `user${Math.floor(Math.random() * 10000)}@jwt.com`;
  const newEmail = `user${Math.floor(Math.random() * 10000)}@jwt.com`;
  const originalPassword = "diner";
  const newPassword = "newpassword123";

  // In-memory backend state for CI (no real backend in GitHub Actions)
  const userStore = {
    value: {
      id: "1",
      name: "pizza diner",
      email: originalEmail,
      password: originalPassword,
      roles: [{ role: "diner" }],
    },
  };
  let authToken = "mock-token";

  setupMockBackend(page, userStore, authToken, true);

  // Register user
  await registerUser(page, "pizza diner", originalEmail, originalPassword);

  // Navigate to dashboard and verify initial state
  await page.getByRole("link", { name: "pd" }).click();
  await expect(page.getByRole("main")).toContainText("pizza diner");
  await expect(page.getByRole("main")).toContainText(originalEmail);

  // Open edit modal and change email and password
  await page.getByRole("button", { name: "Edit" }).click();
  await expect(page.locator("h3")).toContainText("Edit user");

  // Update email and password fields
  await page.locator('input[type="email"]').fill(newEmail);
  await page.locator("#password").fill(newPassword);

  // Submit the update
  await page.getByRole("button", { name: "Update" }).click();

  // Wait for modal to close
  await page.waitForSelector('[role="dialog"].hidden', { state: "attached" });

  // Verify the email was updated in the UI
  await expect(page.getByRole("main")).toContainText(newEmail);

  // Logout
  await page.getByRole("link", { name: "Logout" }).click();

  // Try to login with old credentials (should fail)
  await page.getByRole("link", { name: "Login" }).click();
  await page
    .getByRole("textbox", { name: "Email address" })
    .fill(originalEmail);
  await page.getByRole("textbox", { name: "Password" }).fill(originalPassword);
  await page.getByRole("button", { name: "Login" }).click();

  // Should still be on login page (login failed) - check URL or login button visibility
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("button", { name: "Login" })).toBeVisible();

  // Login with new credentials (should succeed)
  await page.getByRole("textbox", { name: "Email address" }).fill(newEmail);
  await page.getByRole("textbox", { name: "Password" }).fill(newPassword);
  await page.getByRole("button", { name: "Login" }).click();

  // Navigate to dashboard and verify updated information
  await page.getByRole("link", { name: "pd" }).click();
  await expect(page.getByRole("main")).toContainText("pizza diner");
  await expect(page.getByRole("main")).toContainText(newEmail);
});

async function loginUser(page: any, email: string, password: string) {
  await page.goto("/");
  await page.getByRole("link", { name: "Login" }).click();
  await page.getByRole("textbox", { name: "Email address" }).fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill(password);
  await page.getByRole("button", { name: "Login" }).click();
}

test("changeUserInfoAsFranchisee", async ({ page }) => {
  const email = `franchisee${Math.floor(Math.random() * 10000)}@jwt.com`;
  const password = "franchisee";

  const userStore = {
    value: {
      id: "f1",
      name: "pizza franchisee",
      email,
      roles: [{ role: "franchisee", objectId: "F1" }],
    },
  };
  let authToken = "mock-token-franchisee";

  setupMockBackend(page, userStore, authToken, false);

  await loginUser(page, email, password);

  // Navigate to diner dashboard (avatar shows initials "pf")
  await page.getByRole("link", { name: "pf" }).click();

  await expect(page.getByRole("main")).toContainText("pizza franchisee");
  await expect(page.getByRole("main")).toContainText(email);
  await expect(page.getByRole("main")).toContainText("Franchisee on F1");

  await page.getByRole("button", { name: "Edit" }).click();
  await expect(page.locator("h3")).toContainText("Edit user");
  await page.getByRole("textbox").first().fill("pizza franchiseex");
  await page.getByRole("button", { name: "Update" }).click();

  await page.waitForSelector('[role="dialog"].hidden', { state: "attached" });

  await expect(page.getByRole("main")).toContainText("pizza franchiseex");
  await expect(page.getByRole("main")).toContainText("Franchisee on F1");
});

test("changeUserInfoAsAdmin", async ({ page }) => {
  const email = `admin${Math.floor(Math.random() * 10000)}@jwt.com`;
  const password = "admin";

  const userStore = {
    value: {
      id: "a1",
      name: "pizza admin",
      email,
      roles: [{ role: "admin" }],
    },
  };
  let authToken = "mock-token-admin";

  setupMockBackend(page, userStore, authToken, false);

  await loginUser(page, email, password);

  // Admin has "Admin" nav link; avatar "pa" still goes to diner dashboard
  await page.getByRole("link", { name: "pa" }).click();

  await expect(page.getByRole("main")).toContainText("pizza admin");
  await expect(page.getByRole("main")).toContainText(email);
  await expect(page.getByRole("main")).toContainText("admin");

  await page.getByRole("button", { name: "Edit" }).click();
  await expect(page.locator("h3")).toContainText("Edit user");
  await page.getByRole("textbox").first().fill("pizza adminx");
  await page.getByRole("button", { name: "Update" }).click();

  await page.waitForSelector('[role="dialog"].hidden', { state: "attached" });

  await expect(page.getByRole("main")).toContainText("pizza adminx");
  await expect(page.getByRole("main")).toContainText("admin");
});

test("deleteUserAsAdmin", async ({ page }) => {
  const email = `admin${Math.floor(Math.random() * 10000)}@jwt.com`;
  const password = "admin";

  const userStore = {
    value: {
      id: "a1",
      name: "pizza admin",
      email,
      roles: [{ role: "admin" }],
    },
  };
  let authToken = "mock-token-admin";
  let deleteCalled = false;
  let deletedUserId = "";

  // Track DELETE calls to user endpoints - set up before setupMockBackend
  page.on('request', (request) => {
    if (request.method() === 'DELETE' && request.url().includes('/api/user/')) {
      const url = request.url();
      const userIdMatch = url.match(/\/api\/user\/([^\/]+)(?:\?|$)/);
      if (userIdMatch) {
        deletedUserId = userIdMatch[1];
        deleteCalled = true;
      }
    }
  });

  setupMockBackend(page, userStore, authToken, false);

  // Mock the users list API to return some test users
  page.route("*/**/api/user?page=1&limit=10&name=*", async (route: any) => {
    await route.fulfill({
      status: 200,
      json: {
        users: [
          { id: "1", name: "Test User", email: "test@example.com", roles: [{ role: "diner" }] },
          { id: "2", name: "Another User", email: "another@example.com", roles: [{ role: "diner" }] },
        ],
        more: false,
      },
    });
  });

  await loginUser(page, email, password);

  // Navigate to admin dashboard
  await page
    .getByRole("navigation", { name: "Global" })
    .getByRole("link", { name: "Admin" })
    .click();

  await expect(
    page.getByRole("heading", { name: "Mama Ricci's kitchen" }),
  ).toBeVisible();

  // Find the users table within the users section
  const usersTable = page.locator('h3:has-text("Users")').locator('xpath=following-sibling::div//table');

  // Check that the users table shows our test users and has delete buttons
  await expect(usersTable).toContainText("Test User");
  await expect(usersTable).toContainText("test@example.com");
  await expect(usersTable.locator('th:has-text("Action")')).toBeVisible();

  // Click delete button for the first user (within the users table)
  await usersTable.locator('button:has-text("Delete")').first().click();

  // Verify the delete API was called
  expect(deleteCalled).toBe(true);
  expect(deletedUserId).toBe("1");
});

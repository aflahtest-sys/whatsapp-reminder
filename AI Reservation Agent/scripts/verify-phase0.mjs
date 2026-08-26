// Phase 0 end-to-end verification.
// Assumes the app is running at the base URL (default http://localhost:3000).
// Usage: node scripts/verify-phase0.mjs [baseUrl]
//
// Checks:
//  1. Unauthenticated /dashboard and /admin redirect to /login
//  2. Platform admin (aflah@queensgarden.ai) can sign in, lands on /admin,
//     sees "Queens Garden", and is redirected away from /dashboard
//  3. Org owner (owner@queensgarden.ai) can sign in, lands on /dashboard,
//     sees org-scoped data ("Queens Garden Chalet"), and is blocked from /admin

const baseUrl = (process.argv[2] ?? process.env.VERIFY_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "aflah@queensgarden.ai";
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin@12345";
const ownerEmail = process.env.SEED_OWNER_EMAIL ?? "owner@queensgarden.ai";
const ownerPassword = process.env.SEED_OWNER_PASSWORD ?? "Owner@12345";

let failures = 0;

function pass(name) {
  console.log(`  ✓ ${name}`);
}

function fail(name, detail) {
  failures++;
  console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
}

function cookiesFromResponse(response) {
  const setCookies = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
  return setCookies.map((cookie) => cookie.split(";")[0]);
}

async function getCsrfToken(cookieJar) {
  const response = await fetch(`${baseUrl}/api/auth/csrf`, {
    headers: { cookie: cookieJar.join("; ") },
  });
  for (const cookie of cookiesFromResponse(response)) {
    if (!cookieJar.some((c) => c.startsWith(cookie.split("=")[0]))) {
      cookieJar.push(cookie);
    }
  }
  const body = await response.json();
  return body.csrfToken;
}

async function signIn(email, password, cookieJar) {
  const csrfToken = await getCsrfToken(cookieJar);
  const form = new URLSearchParams();
  form.set("csrfToken", csrfToken);
  form.set("email", email);
  form.set("password", password);
  form.set("redirect", "false");

  const response = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: cookieJar.join("; "),
    },
    body: form.toString(),
    redirect: "manual",
  });

  const setCookies = cookiesFromResponse(response);
  for (const cookie of setCookies) {
    if (!cookieJar.some((c) => c.startsWith(cookie.split("=")[0]))) {
      cookieJar.push(cookie);
    }
  }
  return response;
}

async function getSession(cookieJar) {
  const response = await fetch(`${baseUrl}/api/auth/session`, {
    headers: { cookie: cookieJar.join("; ") },
  });
  return response.json();
}

async function get(path, cookieJar) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: cookieJar ? { cookie: cookieJar.join("; ") } : {},
    redirect: "manual",
  });
  const text = await response.text();
  return { status: response.status, location: response.headers.get("location"), text };
}

console.log(`Verifying Phase 0 against ${baseUrl}\n`);

// 1. Unauthenticated access
{
  console.log("1. Unauthenticated access");
  const dash = await get("/dashboard", []);
  const admin = await get("/admin", []);
  if (dash.status >= 300 && dash.status < 400 && dash.location?.includes("/login")) {
    pass("/dashboard redirects to /login");
  } else {
    fail("/dashboard redirects to /login", `status=${dash.status} location=${dash.location}`);
  }
  if (admin.status >= 300 && admin.status < 400 && admin.location?.includes("/login")) {
    pass("/admin redirects to /login");
  } else {
    fail("/admin redirects to /login", `status=${admin.status} location=${admin.location}`);
  }
  console.log("");
}

// 2. Platform admin
{
  console.log("2. Platform admin (aflah@queensgarden.ai)");
  const jar = [];
  await signIn(adminEmail, adminPassword, jar);
  const session = await getSession(jar);
  if (session?.user?.role === "PLATFORM_ADMIN") {
    pass("signs in with role PLATFORM_ADMIN");
  } else {
    fail("signs in with role PLATFORM_ADMIN", JSON.stringify(session));
  }

  const adminHome = await get("/admin", jar);
  if (adminHome.status === 200 && adminHome.text.includes("Queens Garden")) {
    pass("lands on /admin and sees organization list (Queens Garden)");
  } else {
    fail("lands on /admin", `status=${adminHome.status} hasQueensGarden=${adminHome.text.includes("Queens Garden")}`);
  }

  const adminDash = await get("/dashboard", jar);
  if (adminDash.status >= 300 && adminDash.status < 400 && adminDash.location?.includes("/admin")) {
    pass("/dashboard redirects admin to /admin");
  } else {
    fail("/dashboard redirects admin to /admin", `status=${adminDash.status} location=${adminDash.location}`);
  }
  console.log("");
}

// 3. Org owner
{
  console.log("3. Org owner (owner@queensgarden.ai)");
  const jar = [];
  await signIn(ownerEmail, ownerPassword, jar);
  const session = await getSession(jar);
  if (session?.user?.role === "ORG_OWNER" && session?.user?.organizationId) {
    pass(`signs in with role ORG_OWNER, organizationId=${session.user.organizationId}`);
  } else {
    fail("signs in with role ORG_OWNER + organizationId", JSON.stringify(session));
  }

  const dash = await get("/dashboard", jar);
  if (dash.status === 200 && dash.text.includes("Queens Garden Chalet")) {
    pass("lands on /dashboard with org-scoped data (Queens Garden Chalet)");
  } else {
    fail("lands on /dashboard with org-scoped data", `status=${dash.status} hasChalet=${dash.text.includes("Queens Garden Chalet")}`);
  }

  const ownerAdmin = await get("/admin", jar);
  if (ownerAdmin.status >= 300 && ownerAdmin.status < 400 && ownerAdmin.location?.includes("/dashboard")) {
    pass("/admin redirects org user to /dashboard");
  } else {
    fail("/admin redirects org user to /dashboard", `status=${ownerAdmin.status} location=${ownerAdmin.location}`);
  }
  console.log("");
}

console.log(failures === 0 ? "ALL CHECKS PASSED ✔" : `${failures} check(s) FAILED ✘`);
process.exit(failures === 0 ? 0 : 1);

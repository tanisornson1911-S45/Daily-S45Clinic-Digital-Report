// Password-protects the entire site using HTTP Basic Auth.
// Set the environment variables DASH_USER and DASH_PASS in Vercel
// (Project Settings > Environment Variables) before deploying.

import { next } from "@vercel/functions";

export const config = {
  matcher: "/((?!_vercel).*)",
};

export default function middleware(request) {
  const auth = request.headers.get("authorization");

  const expectedUser = process.env.DASH_USER;
  const expectedPass = process.env.DASH_PASS;

  if (auth) {
    const [scheme, encoded] = auth.split(" ");
    if (scheme === "Basic" && encoded) {
      const decoded = atob(encoded);
      const separatorIndex = decoded.indexOf(":");
      const user = decoded.substring(0, separatorIndex);
      const pass = decoded.substring(separatorIndex + 1);

      if (user === expectedUser && pass === expectedPass) {
        return next();
      }
    }
  }

  return new Response("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="S45 Dashboard"',
    },
  });
}

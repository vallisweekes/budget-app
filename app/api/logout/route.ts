import { NextResponse } from "next/server";

const AUTH_COOKIES = [
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
  "next-auth.callback-url",
  "__Secure-next-auth.callback-url",
  "next-auth.csrf-token",
  "__Host-next-auth.csrf-token",
  "next-auth.pkce.code_verifier",
  "next-auth.state",
  "next-auth.nonce",
];

function clearAuthCookies(response: NextResponse) {
  for (const name of AUTH_COOKIES) {
    response.cookies.set({
      name,
      value: "",
      path: "/",
      expires: new Date(0),
    });

    response.cookies.set({
      name,
      value: "",
      path: "/",
      expires: new Date(0),
      secure: true,
    });
  }
}

export async function POST() {
  const response = new NextResponse(null, {
    status: 204,
    headers: {
      "Cache-Control": "no-store",
    },
  });
  clearAuthCookies(response);
  return response;
}

export async function GET() {
  const response = new NextResponse(null, {
    status: 204,
    headers: {
      "Cache-Control": "no-store",
    },
  });
  clearAuthCookies(response);
  return response;
}

import { NextResponse } from "next/server";
import { tryProxyIdentityServiceRaw } from "@/lib/microservices/identity-bff";
import { serviceUnavailableResponse } from "@/lib/microservices/bff-service";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Dữ liệu yêu cầu không hợp lệ." }, { status: 400 });
  }

  const proxied = await tryProxyIdentityServiceRaw({
    path: "/v1/auth/password-reset/request",
    method: "POST",
    body,
    fallbackMessage: "Không thể gửi mã đặt lại mật khẩu",
  });

  return proxied ?? serviceUnavailableResponse(
    "Identity Service",
    "Luồng đặt lại mật khẩu chỉ được xử lý bởi Identity Service",
  );
}

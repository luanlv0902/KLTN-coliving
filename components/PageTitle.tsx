"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

const exactTitles: Record<string, string> = {
  "/": "Trang chủ",
  "/home": "Trang chủ",
  "/login": "Đăng nhập",
  "/register": "Đăng ký tài khoản",
  "/rooms": "Danh sách phòng",
  "/rooms/recommendations": "Phòng phù hợp",
  "/preferences": "Cập nhật sở thích",
  "/forgot-password": "Quên mật khẩu",
  "/reset-password": "Đặt lại mật khẩu",
  "/favorites": "Phòng yêu thích",
  "/bookings": "Đặt phòng của tôi",
  "/contracts": "Hợp đồng của tôi",
  "/profile": "Trang cá nhân",
  "/amenities": "Tiện ích",
  "/dashboard": "Bảng điều khiển",
  "/host": "Tổng quan chủ nhà",
  "/host/contracts": "Quản lý hợp đồng",
  "/host/resources": "Quản lý tài nguyên chung",
  "/host/reviews": "Đánh giá phòng",
  "/room-management": "Quản lý phòng",
  "/room-management/add-room": "Thêm phòng mới",
  "/room-management/edit-room": "Chỉnh sửa phòng",
  "/room-management/tenants": "Quản lý người thuê",
  "/community-manager": "Xác minh cộng đồng",
  "/admin": "Tổng quan hệ thống",
  "/admin/users": "Quản lý người dùng",
  "/admin/community-managers": "Phân vùng Community Manager",
  "/admin/rooms": "Xác minh và duyệt phòng",
  "/admin/reviews": "Quản lý đánh giá",
  "/admin/reports": "Báo cáo hệ thống",
  "/admin/logs": "Nhật ký hệ thống",
}

const dynamicTitles: Array<{ pattern: RegExp; title: string }> = [
  { pattern: /^\/contracts\/[^/]+\/print$/, title: "In hợp đồng thuê nhà" },
  { pattern: /^\/room-management\/tenants\/[^/]+$/, title: "Thành viên trong phòng" },
  { pattern: /^\/rooms\/[^/]+\/book$/, title: "Đặt phòng" },
  { pattern: /^\/rooms\/[^/]+\/reviews$/, title: "Đánh giá phòng" },
  { pattern: /^\/rooms\/[^/]+\/shared-space$/, title: "Không gian sinh hoạt chung" },
  { pattern: /^\/rooms\/[^/]+$/, title: "Chi tiết phòng" },
]

export function resolvePageTitle(pathname: string) {
  const normalizedPath = pathname !== "/" ? pathname.replace(/\/+$/, "") : pathname
  const exactTitle = exactTitles[normalizedPath]
  if (exactTitle) return exactTitle

  return dynamicTitles.find(({ pattern }) => pattern.test(normalizedPath))?.title || "NhàHợp"
}

export function PageTitle() {
  const pathname = usePathname()

  useEffect(() => {
    const pageTitle = resolvePageTitle(pathname)
    const expectedTitle = pageTitle === "NhàHợp" ? pageTitle : `${pageTitle} | NhàHợp`
    const applyTitle = () => {
      if (document.title !== expectedTitle) document.title = expectedTitle
    }

    applyTitle()
    const observer = new MutationObserver(applyTitle)
    observer.observe(document.head, { childList: true, subtree: true, characterData: true })

    return () => observer.disconnect()
  }, [pathname])

  return null
}

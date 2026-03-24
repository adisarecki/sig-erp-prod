"use server"

import { revalidatePath } from "next/cache"
import { getCurrentTenantId } from "@/lib/tenant"
import { getAdminDb } from "@/lib/firebaseAdmin"
import prisma from "@/lib/prisma"

export async function getNotifications() {
    try {
        const tenantId = await getCurrentTenantId()
        const notifications = await (prisma as any).notification.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'desc' },
            take: 50
        })
        return notifications
    } catch (error) {
        console.error("[GET_NOTIFICATIONS_ERROR]", error)
        return []
    }
}

export async function markNotificationAsRead(id: string) {
    try {
        const tenantId = await getCurrentTenantId()
        const adminDb = getAdminDb()

        await adminDb.collection("notifications").doc(id).update({
            isRead: true,
            updatedAt: new Date().toISOString()
        })

        await (prisma as any).notification.update({
            where: { id, tenantId },
            data: { isRead: true }
        })

        revalidatePath("/")
        return { success: true }
    } catch (error: any) {
        console.error("[MARK_NOTIFICATION_READ_ERROR]", error)
        return { success: false, error: error.message }
    }
}

export async function createNotification(data: {
    type: 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR',
    title: string,
    message: string,
    priority?: 'LOW' | 'NORMAL' | 'HIGH',
    link?: string
}) {
    try {
        const tenantId = await getCurrentTenantId()
        const adminDb = getAdminDb()

        const notificationRef = adminDb.collection("notifications").doc()
        const notificationId = notificationRef.id

        const payload = {
            ...data,
            tenantId,
            isRead: false,
            priority: data.priority || 'NORMAL',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }

        await notificationRef.set(payload)

        await (prisma as any).notification.create({
            data: {
                id: notificationId,
                tenantId,
                type: data.type,
                title: data.title,
                message: data.message,
                isRead: false,
                priority: data.priority || 'NORMAL',
                link: data.link || null
            }
        })

        revalidatePath("/")
        return { success: true, id: notificationId }
    } catch (error: any) {
        console.error("[CREATE_NOTIFICATION_ERROR]", error)
        return { success: false, error: error.message }
    }
}

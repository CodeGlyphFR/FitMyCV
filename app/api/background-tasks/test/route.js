import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

import { auth } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import { scheduleTestJob } from "@/lib/backgroundTasks/testJob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const requestedCount = Number(body?.count) || 1;
    const duration = Math.max(1000, Number(body?.duration) || 5000);
    const shouldFail = Boolean(body?.shouldFail);

    const count = Math.min(Math.max(requestedCount, 1), 5);
    const userId = session.user.id;
    const deviceId = body?.deviceId || 'test-device';

    const createdTasks = [];

    for (let i = 0; i < count; i += 1) {
      const taskId = `test_${randomUUID()}`;
      const title = `Tâche de test #${i + 1}`;

      await prisma.backgroundTask.create({
        data: {
          id: taskId,
          userId,
          title,
          successMessage: `${title} terminée`,
          type: 'test',
          status: 'queued',
          createdAt: BigInt(Date.now()),
          shouldUpdateCvList: false,
          error: null,
          result: null,
          deviceId,
        },
      });

      scheduleTestJob({
        taskId,
        userId,
        deviceId,
        duration,
        shouldFail,
      });

      createdTasks.push(taskId);
    }

    return NextResponse.json({ success: true, created: createdTasks.length, taskIds: createdTasks }, { status: 202 });
  } catch (error) {
    console.error('Erreur lors de la création des tâches de test:', error);
    return NextResponse.json({ error: "Impossible de créer la tâche de test." }, { status: 500 });
  }
}

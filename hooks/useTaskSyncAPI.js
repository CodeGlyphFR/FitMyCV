import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'

export function useTaskSyncAPI(_tasks, setTasks, _abortControllers, options = {}) {
  const { enabled = true } = options
  const deviceIdRef = useRef(null)
  const [localDeviceId, setLocalDeviceId] = useState(null)
  const { status } = useSession()
  const isAuthenticated = status === 'authenticated'

  const getDeviceId = useCallback(() => {
    if (typeof window === 'undefined') return null

    let deviceId = localStorage.getItem('device_id')
    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      localStorage.setItem('device_id', deviceId)
    }

    if (deviceIdRef.current !== deviceId) {
      deviceIdRef.current = deviceId
      setLocalDeviceId(deviceId)
    }

    return deviceId
  }, [])

  const normaliseTasks = useCallback((rawTasks) => {
    if (!Array.isArray(rawTasks)) return []

    return rawTasks
      .filter(task => task && task.type !== 'sync_marker')
      .map(task => ({
        ...task,
        createdAt: typeof task.createdAt === 'number'
          ? task.createdAt
          : Number(task.createdAt ?? Date.now()),
        updatedAt: typeof task.updatedAt === 'number'
          ? task.updatedAt
          : (task.updatedAt ? new Date(task.updatedAt).getTime?.() ?? Date.now() : Date.now()),
      }))
      .sort((a, b) => {
        // Priorité 1 : Trier par statut (running en premier, tout le reste pareil)
        const STATUS_PRIORITY = {
          running: 0,
          queued: 1,
          cancelled: 1,
          failed: 1,
          completed: 1,
        }
        const priorityA = STATUS_PRIORITY[a.status] ?? 99
        const priorityB = STATUS_PRIORITY[b.status] ?? 99
        const priorityDiff = priorityA - priorityB

        if (priorityDiff !== 0) {
          return priorityDiff
        }

        // Priorité 2 : Trier par date (plus récent en premier)
        return b.createdAt - a.createdAt
      })
  }, [])

  const loadTasksFromServer = useCallback(async () => {
    console.log('[useTaskSyncAPI] 📥 Chargement des tâches depuis le serveur...');

    if (!enabled || status === 'loading') {
      console.log('[useTaskSyncAPI] ⏭️ Ignoré (non activé ou chargement)');
      return
    }

    if (!isAuthenticated) {
      console.log('[useTaskSyncAPI] ⏭️ Non authentifié, reset des tâches');
      setTasks([])
      return
    }

    try {
      const deviceId = getDeviceId()
      if (!deviceId) {
        console.log('[useTaskSyncAPI] ⏭️ Pas de deviceId');
        return
      }

      const url = new URL('/api/background-tasks/sync', window.location.origin)
      url.searchParams.set('deviceId', deviceId)

      const response = await fetch(url)
      if (!response.ok) {
        if (response.status === 401) {
          setTasks([])
          return
        }
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      if (!result.success) {
        console.log('[useTaskSyncAPI] ⚠️ Réponse non réussie');
        return
      }

      const tasksFromServer = normaliseTasks(result.tasks)
      console.log(`[useTaskSyncAPI] ✅ ${tasksFromServer.length} tâche(s) chargée(s) depuis le serveur`);

      // Préserver les tâches optimistes lors du merge
      setTasks(prevTasks => {
        const optimisticTasks = prevTasks.filter(task => task.isOptimistic)
        const merged = [...optimisticTasks, ...tasksFromServer]
        console.log(`[useTaskSyncAPI] 🔄 Mise à jour de l'état local: ${merged.length} tâche(s) totales`);
        return merged
      })
    } catch (error) {
      console.warn('[useTaskSyncAPI] ❌ Erreur chargement tâches:', error)
    }
  }, [enabled, getDeviceId, isAuthenticated, normaliseTasks, status])

  // Chargement initial uniquement (pas de polling)
  useEffect(() => {
    if (!enabled) {
      setTasks([])
      return
    }

    if (status === 'loading') {
      return
    }

    if (!isAuthenticated) {
      setTasks([])
      return
    }

    loadTasksFromServer()
  }, [enabled, isAuthenticated, loadTasksFromServer, setTasks, status])

  const cancelTaskOnServer = useCallback(async (taskId) => {
    if (!enabled || !taskId || !isAuthenticated) {
      return { success: false }
    }

    try {
      const response = await fetch(`/api/background-tasks/sync?taskId=${taskId}&action=cancel`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` }
      }

      const result = await response.json()
      return result
    } catch (error) {
      console.warn('Failed to cancel task on server:', error)
      return { success: false, error: error?.message }
    }
  }, [enabled, isAuthenticated])

  const deleteCompletedTasksOnServer = useCallback(async (taskIds) => {
    if (!enabled || !Array.isArray(taskIds) || !taskIds.length || !isAuthenticated) {
      return { success: false }
    }

    try {
      const response = await fetch('/api/background-tasks/sync?action=deleteCompleted', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ taskIds })
      })

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` }
      }

      const result = await response.json()
      return result
    } catch (error) {
      console.warn('Failed to delete completed tasks on server:', error)
      return { success: false, error: error?.message }
    }
  }, [enabled, isAuthenticated])

  return useMemo(() => ({
    isApiSyncEnabled: enabled,
    cancelTaskOnServer,
    deleteCompletedTasksOnServer,
    loadTasksFromServer,
    localDeviceId,
  }), [enabled, cancelTaskOnServer, deleteCompletedTasksOnServer, loadTasksFromServer, localDeviceId])
}

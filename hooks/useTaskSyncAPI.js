import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'

export function useTaskSyncAPI(_tasks, setTasks, _abortControllers, options = {}) {
  const { enabled = true, pollInterval = 3000 } = options
  const lastSyncType = useRef('full')
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
        if (a.status === b.status) {
          return b.createdAt - a.createdAt
        }
        const STATUS_PRIORITY = {
          running: 0,
          queued: 1,
          cancelled: 2,
          failed: 2,
          completed: 3,
        }
        const priorityA = STATUS_PRIORITY[a.status] ?? 99
        const priorityB = STATUS_PRIORITY[b.status] ?? 99
        return priorityA - priorityB
      })
  }, [])

  const loadTasksFromServer = useCallback(async () => {
    if (!enabled || status === 'loading') {
      return
    }

    if (!isAuthenticated) {
      setTasks([])
      return
    }

    try {
      const deviceId = getDeviceId()
      if (!deviceId) return

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
        return
      }

      lastSyncType.current = result.syncType || 'full'
      const tasksFromServer = normaliseTasks(result.tasks)

      // Préserver les tâches optimistes lors du merge
      setTasks(prevTasks => {
        const optimisticTasks = prevTasks.filter(task => task.isOptimistic)
        return [...optimisticTasks, ...tasksFromServer]
      })
    } catch (error) {
      console.warn('Failed to load tasks from server:', error)
    }
  }, [enabled, getDeviceId, isAuthenticated, normaliseTasks, status])

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
    const intervalId = setInterval(loadTasksFromServer, pollInterval)

    return () => {
      clearInterval(intervalId)
    }
  }, [enabled, isAuthenticated, loadTasksFromServer, pollInterval, setTasks, status])

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

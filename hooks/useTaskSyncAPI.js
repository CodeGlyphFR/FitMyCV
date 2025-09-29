import { useEffect, useCallback, useRef, useState } from 'react'

export function useTaskSyncAPI(tasks, setTasks, abortControllers) {
  const lastSyncTimestamp = useRef(0);
  const deviceIdRef = useRef(null);
  const [localDeviceId, setLocalDeviceId] = useState(null);

  // Generate a unique device ID for this browser/device
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

  // Sync tasks to server
  const syncTasksToServer = useCallback(async (tasksToSync) => {
    if (!tasksToSync.length) return

    try {
      const deviceId = getDeviceId()
      if (!deviceId) return

      // Clean task data (remove execute functions)
      const cleanTasks = tasksToSync.map(task => ({
        id: task.id,
        title: task.title,
        successMessage: task.successMessage,
        type: task.type,
        status: task.status,
        createdAt: task.createdAt,
        shouldUpdateCvList: task.shouldUpdateCvList,
        result: task.result,
        error: task.error
      }))

      const response = await fetch('/api/background-tasks/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tasks: cleanTasks,
          deviceId
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      if (result.success) {
        lastSyncTimestamp.current = result.timestamp
        console.log(`Synced ${result.synced} tasks to server`)
      }
    } catch (error) {
      console.warn('Failed to sync tasks to server:', error)
    }
  }, [getDeviceId])

  // Load tasks from server
  const loadTasksFromServer = useCallback(async () => {
    try {
      const deviceId = getDeviceId()
      if (!deviceId) return

      const url = new URL('/api/background-tasks/sync', window.location.origin)
      url.searchParams.set('deviceId', deviceId)
      if (lastSyncTimestamp.current > 0) {
        url.searchParams.set('since', lastSyncTimestamp.current.toString())
      }

      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      if (!result.success) {
        return
      }

      const tasksFromServer = Array.isArray(result.tasks) ? result.tasks : []
      console.log(`Loaded ${tasksFromServer.length} tasks from server`)

      const syncType = result.syncType || (lastSyncTimestamp.current === 0 ? 'full' : 'incremental')
      const isFullSync = syncType !== 'incremental'

      setTasks(prev => {
        if (!tasksFromServer.length && !isFullSync) {
          return prev
        }

        const normalisedServerTasks = tasksFromServer
          .filter(task => task?.type !== 'sync_marker')
          .map(task => ({
          ...task,
          createdAt: typeof task.createdAt === 'number'
            ? task.createdAt
            : Number(task.createdAt ?? Date.now()),
          updatedAt: typeof task.updatedAt === 'number'
            ? task.updatedAt
            : (task.updatedAt ? new Date(task.updatedAt).getTime?.() ?? Date.now() : Date.now()),
        }))

        const localRunningTasks = new Map()
        const localTaskStates = new Map()
        prev.forEach(task => {
          if (task.execute) {
            localRunningTasks.set(task.id, task.execute)
          }
          localTaskStates.set(task.id, task.status)
        })

        const previousTaskMap = new Map(prev.map(task => [task.id, task]))

        const STATUS_PRIORITY = {
          queued: 1,
          running: 2,
          cancelled: 3,
          failed: 3,
          completed: 4,
        }

        const mergeServerTask = (serverTask) => {
          const previous = previousTaskMap.get(serverTask.id)
          const localExecute = localRunningTasks.get(serverTask.id) || previous?.execute
          const previousStatus = previous?.status
          const previousPriority = STATUS_PRIORITY[previousStatus] ?? 0
          const serverPriority = STATUS_PRIORITY[serverTask.status] ?? 0

          // Avoid regressing when we still control the task locally (same execute reference)
          const shouldPreserveLocalStatus = Boolean(localExecute) && previousPriority >= 3 && serverPriority < previousPriority

          if (serverTask.status === 'cancelled' && localExecute && previousStatus === 'running') {
            const abortController = abortControllers?.current?.get?.(serverTask.id)
            if (abortController) {
              console.log(`Aborting task ${serverTask.id} due to server cancellation`)
              abortController.abort()
            }
          }

          const mergedStatus = shouldPreserveLocalStatus ? previousStatus : serverTask.status
          const mergedError = shouldPreserveLocalStatus ? previous?.error : serverTask.error
          const mergedResult = shouldPreserveLocalStatus ? previous?.result : serverTask.result

          return {
            ...(previous || {}),
            ...serverTask,
            status: mergedStatus,
            error: mergedError,
            result: mergedResult,
            execute: localExecute || undefined,
          }
        }

        if (isFullSync) {
          const serverTaskIds = new Set(normalisedServerTasks.map(task => task.id))
        const mergedFromServer = normalisedServerTasks.map(mergeServerTask)

        const localOnlyTasks = prev.filter(task =>
          !serverTaskIds.has(task.id) &&
          task.execute &&
            (task.status === 'queued' || task.status === 'running')
          )

          return [...mergedFromServer, ...localOnlyTasks].sort((a, b) => b.createdAt - a.createdAt)
        }

        // Incremental merge
        const nextMap = new Map(prev.map(task => [task.id, task]))
        normalisedServerTasks.forEach(serverTask => {
          nextMap.set(serverTask.id, mergeServerTask(serverTask))
        })

        return Array.from(nextMap.values()).sort((a, b) => b.createdAt - a.createdAt)
      })

      lastSyncTimestamp.current = result.timestamp ?? Date.now()
    } catch (error) {
      console.warn('Failed to load tasks from server:', error)
    }
  }, [getDeviceId, setTasks])

  // Poll for updates from other devices
  const pollForUpdates = useCallback(async () => {
    await loadTasksFromServer()
  }, [loadTasksFromServer])

  // Initialize sync on mount
  useEffect(() => {
    console.log('API-based cross-device sync enabled')

    // Load initial tasks immediately - this will override any stale localStorage data
    loadTasksFromServer()

    // Quick refresh after 500ms to ensure we have the most up-to-date status
    setTimeout(() => {
      loadTasksFromServer()
    }, 500)

    // Set up polling every 3 seconds for more responsiveness
    const pollInterval = setInterval(pollForUpdates, 3000)

    // Set up phantom task detection every 30 seconds
    const phantomCheckInterval = setInterval(() => {
      const currentDeviceId = deviceIdRef.current
      setTasks(prev => {
        const now = Date.now()
        let hasPhantoms = false

        const updatedTasks = prev.map(task => {
          // Detect phantom tasks (running without execute function for > 2 minutes)
          const ownedByDevice = !task.deviceId || task.deviceId === currentDeviceId
          if (ownedByDevice && task.status === 'running' && !task.execute && (now - task.createdAt) > 120000) {
            console.warn(`Detected phantom task: ${task.id}`)
            hasPhantoms = true
            // Auto-cancel phantom tasks
            return { ...task, status: 'cancelled' }
          }
          return task
        })

        if (hasPhantoms) {
          console.log('Auto-cancelled phantom tasks')
        }

        return hasPhantoms ? updatedTasks : prev
      })
    }, 30000) // Check every 30 seconds

    return () => {
      clearInterval(pollInterval)
      clearInterval(phantomCheckInterval)
    }
  }, [loadTasksFromServer, pollForUpdates, setTasks])

  // Sync tasks when they change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      // Only sync tasks that are not cancelled externally
      const tasksToSync = tasks.filter(task => {
        if (task.status === 'cancelled' && !task.execute) {
          return false
        }
        return true
      })

      if (tasksToSync.length > 0) {
        syncTasksToServer(tasksToSync)
      } else {
        loadTasksFromServer()
      }
    }, 1000)

    return () => clearTimeout(timeoutId)
  }, [tasks, syncTasksToServer, loadTasksFromServer])

  // Cancel task on server
  const cancelTaskOnServer = useCallback(async (taskId) => {
    try {
      const response = await fetch(`/api/background-tasks/sync?taskId=${taskId}&action=cancel`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      if (result.success && result.cancelled) {
        console.log(`Task ${taskId} cancelled on server`)
        // Force a reload to get the updated task status
        await loadTasksFromServer()
      }
      return result
    } catch (error) {
      console.warn('Failed to cancel task on server:', error)
      return { success: false }
    }
  }, [loadTasksFromServer])

  // Delete completed tasks on server
  const deleteCompletedTasksOnServer = useCallback(async (taskIds) => {
    try {
      const response = await fetch('/api/background-tasks/sync?action=deleteCompleted', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ taskIds })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      if (result.success) {
        console.log(`Deleted ${result.deleted} completed tasks from server`)
        // Force a complete reload by resetting timestamp and reloading
        lastSyncTimestamp.current = 0
        await loadTasksFromServer()
      }
      return result
    } catch (error) {
      console.warn('Failed to delete completed tasks on server:', error)
      return { success: false }
    }
  }, [loadTasksFromServer])

  return {
    isApiSyncEnabled: true,
    syncTasksToServer,
    loadTasksFromServer,
    cancelTaskOnServer,
    deleteCompletedTasksOnServer,
    localDeviceId,
  }
}

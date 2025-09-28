import { useEffect, useCallback, useRef } from 'react'

export function useTaskSyncAPI(tasks, setTasks, abortControllers) {
  const lastSyncTimestamp = useRef(0);

  // Generate a unique device ID for this browser/device
  const getDeviceId = useCallback(() => {
    if (typeof window === 'undefined') return null

    let deviceId = localStorage.getItem('device_id')
    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      localStorage.setItem('device_id', deviceId)
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
      if (result.success && result.tasks.length > 0) {
        console.log(`Loaded ${result.tasks.length} tasks from server`)

        // Check for sync markers that indicate significant changes
        const syncMarkers = result.tasks.filter(task => task.type === 'sync_marker')
        const hasDeletionMarker = syncMarkers.some(marker => marker.action === 'tasks_deleted')

        if (hasDeletionMarker) {
          // Force complete reload on next sync
          console.log('Detected tasks deletion marker, forcing complete reload')
          lastSyncTimestamp.current = 0

          // Remove sync markers and reload immediately
          setTimeout(async () => {
            await loadTasksFromServer()
          }, 100)
          return
        }

        // Merge with existing tasks, giving priority to server status
        setTasks(prev => {
          const merged = [...prev]

          result.tasks.forEach(serverTask => {
            // Skip sync markers in regular merge
            if (serverTask.type === 'sync_marker') {
              return
            }

            const existingIndex = merged.findIndex(t => t.id === serverTask.id)
            if (existingIndex >= 0) {
              // Update existing task, but preserve execute function if it exists
              const existingTask = merged[existingIndex]
              merged[existingIndex] = {
                ...serverTask,
                execute: existingTask.execute // Preserve local execute function
              }

              // If the task was cancelled on the server and is currently running locally,
              // we need to trigger local cancellation
              if (serverTask.status === 'cancelled' && existingTask.status === 'running') {
                // Trigger abort for running task
                const abortController = abortControllers?.current?.get?.(serverTask.id)
                if (abortController) {
                  console.log(`Aborting task ${serverTask.id} due to server cancellation`)
                  abortController.abort()
                }
              }
            } else {
              // Add new task
              merged.push(serverTask)
            }
          })

          // Sort by creation time
          return merged.sort((a, b) => b.createdAt - a.createdAt)
        })

        lastSyncTimestamp.current = result.timestamp
      }
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

    // Load initial tasks
    loadTasksFromServer()

    // Set up polling every 5 seconds
    const pollInterval = setInterval(pollForUpdates, 5000)

    return () => {
      clearInterval(pollInterval)
    }
  }, [loadTasksFromServer, pollForUpdates])

  // Sync tasks when they change
  useEffect(() => {
    if (tasks.length > 0) {
      // Debounce to avoid too many syncs
      const timeoutId = setTimeout(() => {
        // Only sync tasks that are not cancelled externally
        const tasksToSync = tasks.filter(task => {
          // Don't sync tasks that don't have execute function and are cancelled
          // (these are likely cancelled from another device)
          if (task.status === 'cancelled' && !task.execute) {
            return false
          }
          return true
        })

        if (tasksToSync.length > 0) {
          syncTasksToServer(tasksToSync)
        }
      }, 1000)

      return () => clearTimeout(timeoutId)
    }
  }, [tasks, syncTasksToServer])

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
    deleteCompletedTasksOnServer
  }
}
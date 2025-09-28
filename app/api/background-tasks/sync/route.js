import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// Chemin vers le fichier de stockage des tâches
const TASKS_FILE_PATH = path.join(process.cwd(), 'data', 'background-tasks.json');

// Stockage en mémoire avec persistance en fichier
let tasks = [];
let isLoaded = false;

// Charger les tâches depuis le fichier
async function loadTasks() {
  if (isLoaded) return;

  try {
    // Créer le dossier data s'il n'existe pas
    await fs.mkdir(path.dirname(TASKS_FILE_PATH), { recursive: true });

    // Charger les tâches existantes
    const data = await fs.readFile(TASKS_FILE_PATH, 'utf8');
    tasks = JSON.parse(data);
    console.log(`Loaded ${tasks.length} tasks from file`);
  } catch (error) {
    // Fichier n'existe pas ou erreur de lecture, on commence avec un tableau vide
    tasks = [];
    console.log('Starting with empty tasks array');
  }

  isLoaded = true;
}

// Sauvegarder les tâches dans le fichier
async function saveTasks() {
  try {
    await fs.writeFile(TASKS_FILE_PATH, JSON.stringify(tasks, null, 2));
  } catch (error) {
    console.error('Failed to save tasks to file:', error);
  }
}

export async function GET(request) {
  try {
    // Charger les tâches depuis le fichier
    await loadTasks();

    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');
    const since = searchParams.get('since'); // timestamp
    const taskId = searchParams.get('taskId');
    const action = searchParams.get('action');

    // If checking a specific task status
    if (taskId && action === 'check') {
      const task = tasks.find(t => t.id === taskId);
      return NextResponse.json({
        success: true,
        task: task || null,
        timestamp: Date.now()
      });
    }

    // Nettoyer les anciens marqueurs de sync (plus de 5 minutes)
    const now = Date.now();
    const oldMarkerCount = tasks.length;
    tasks = tasks.filter(task => {
      if (task.type === 'sync_marker') {
        return (now - task.createdAt) < 5 * 60 * 1000; // Garder 5 minutes
      }
      return true;
    });
    if (tasks.length !== oldMarkerCount) {
      await saveTasks();
    }

    // Filtrer les tâches si un timestamp "since" est fourni
    let filteredTasks = tasks;
    if (since) {
      const sinceTimestamp = parseInt(since);
      filteredTasks = tasks.filter(task => task.updatedAt > sinceTimestamp);
    }

    // Exclure les tâches du même device pour éviter les doublons
    if (deviceId) {
      filteredTasks = filteredTasks.filter(task => task.deviceId !== deviceId);
    }

    return NextResponse.json({
      success: true,
      tasks: filteredTasks,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    // Charger les tâches depuis le fichier
    await loadTasks();

    const body = await request.json();
    const { tasks: newTasks, deviceId } = body;

    if (!Array.isArray(newTasks) || !deviceId) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body' },
        { status: 400 }
      );
    }

    // Ajouter/mettre à jour les tâches
    for (const newTask of newTasks) {
      const existingIndex = tasks.findIndex(t => t.id === newTask.id);
      const taskWithTimestamp = {
        ...newTask,
        deviceId,
        updatedAt: Date.now()
      };

      if (existingIndex >= 0) {
        // Mettre à jour la tâche existante
        tasks[existingIndex] = taskWithTimestamp;
      } else {
        // Ajouter une nouvelle tâche
        tasks.push(taskWithTimestamp);
      }
    }

    // Garder seulement les 100 tâches les plus récentes pour éviter l'explosion mémoire
    tasks = tasks
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 100);

    // Sauvegarder les tâches dans le fichier
    await saveTasks();

    return NextResponse.json({
      success: true,
      synced: newTasks.length,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Error syncing tasks:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to sync tasks' },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    // Charger les tâches depuis le fichier
    await loadTasks();

    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');
    const action = searchParams.get('action'); // 'delete', 'cancel', or 'deleteCompleted'

    // Handle bulk deletion of completed tasks
    if (action === 'deleteCompleted') {
      const body = await request.json();
      const { taskIds } = body;

      if (!Array.isArray(taskIds)) {
        return NextResponse.json(
          { success: false, error: 'Task IDs array required' },
          { status: 400 }
        );
      }

      const initialLength = tasks.length;
      tasks = tasks.filter(task => !taskIds.includes(task.id));
      const deleted = initialLength - tasks.length;

      // Save to file if any deletions occurred
      if (deleted > 0) {
        await saveTasks();

        // Add a special marker task to force sync on all devices
        const syncMarker = {
          id: `sync_marker_${Date.now()}`,
          type: 'sync_marker',
          action: 'tasks_deleted',
          deleted_count: deleted,
          updatedAt: Date.now(),
          createdAt: Date.now()
        };
        tasks.push(syncMarker);
        await saveTasks();
      }

      return NextResponse.json({
        success: true,
        deleted,
        timestamp: Date.now()
      });
    }

    if (!taskId) {
      return NextResponse.json(
        { success: false, error: 'Task ID required' },
        { status: 400 }
      );
    }

    if (action === 'cancel') {
      // Annuler la tâche (changer son statut en 'cancelled')
      const taskIndex = tasks.findIndex(task => task.id === taskId);
      if (taskIndex >= 0) {
        tasks[taskIndex] = {
          ...tasks[taskIndex],
          status: 'cancelled',
          updatedAt: Date.now()
        };
        await saveTasks();

        return NextResponse.json({
          success: true,
          cancelled: true,
          timestamp: Date.now()
        });
      } else {
        return NextResponse.json({
          success: false,
          cancelled: false,
          error: 'Task not found'
        });
      }
    } else {
      // Supprimer la tâche complètement
      const initialLength = tasks.length;
      tasks = tasks.filter(task => task.id !== taskId);

      const deleted = initialLength !== tasks.length;

      // Sauvegarder les tâches dans le fichier si une suppression a eu lieu
      if (deleted) {
        await saveTasks();
      }

      return NextResponse.json({
        success: true,
        deleted,
        timestamp: Date.now()
      });
    }
  } catch (error) {
    console.error('Error processing task:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process task' },
      { status: 500 }
    );
  }
}
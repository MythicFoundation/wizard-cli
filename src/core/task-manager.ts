// Task Manager — Tracks background and foreground tasks with status and output.
// Tasks are stored in memory (not persisted to disk) for the duration of the session.
// Provides tools for the model to create, update, list, and inspect tasks.

import { randomUUID } from 'crypto'
import type { Tool } from '@anthropic-ai/sdk/resources/messages'

// ─── Types ──────────────────────────────────────────────────────────

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed'

export interface Task {
  id: string
  description: string
  status: TaskStatus
  createdAt: number
  updatedAt: number
  output?: string
}

// ─── Task Manager ───────────────────────────────────────────────────

export class TaskManager {
  private tasks: Map<string, Task> = new Map()

  /**
   * Create a new task with a description. Returns the created task.
   */
  create(description: string): Task {
    const now = Date.now()
    const task: Task = {
      id: randomUUID().slice(0, 8), // short IDs for readability
      description,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    }
    this.tasks.set(task.id, task)
    return task
  }

  /**
   * Update a task's fields. Only provided fields are changed.
   */
  update(id: string, updates: Partial<Pick<Task, 'status' | 'output' | 'description'>>): void {
    const task = this.tasks.get(id)
    if (!task) {
      throw new Error(`Task not found: ${id}`)
    }

    if (updates.status !== undefined) task.status = updates.status
    if (updates.output !== undefined) task.output = updates.output
    if (updates.description !== undefined) task.description = updates.description
    task.updatedAt = Date.now()
  }

  /**
   * Get a single task by ID, or null if not found.
   */
  get(id: string): Task | null {
    return this.tasks.get(id) || null
  }

  /**
   * List tasks, optionally filtered by status.
   */
  list(filter?: { status?: TaskStatus }): Task[] {
    const all = [...this.tasks.values()]
    if (filter?.status) {
      return all.filter((t) => t.status === filter.status)
    }
    return all
  }

  /**
   * Run a function as a background task. The task is created immediately
   * and updated when the function completes or fails.
   * Returns the task (status will be 'in_progress' until the function finishes).
   */
  runBackground(description: string, fn: () => Promise<string>): Task {
    const task = this.create(description)
    task.status = 'in_progress'
    task.updatedAt = Date.now()

    // Fire-and-forget: the promise runs in the background
    fn()
      .then((output) => {
        task.status = 'completed'
        task.output = output
        task.updatedAt = Date.now()
      })
      .catch((err: any) => {
        task.status = 'failed'
        task.output = `Error: ${err.message || String(err)}`
        task.updatedAt = Date.now()
      })

    return task
  }

  /**
   * Get the output of a completed or failed task.
   */
  getOutput(id: string): string | null {
    const task = this.tasks.get(id)
    if (!task) return null
    return task.output ?? null
  }

  /**
   * Get a summary of task counts by status.
   */
  getSummary(): Record<TaskStatus, number> {
    const summary: Record<TaskStatus, number> = {
      pending: 0,
      in_progress: 0,
      completed: 0,
      failed: 0,
    }
    for (const task of this.tasks.values()) {
      summary[task.status]++
    }
    return summary
  }

  /**
   * Clear all completed and failed tasks from memory.
   */
  clearFinished(): number {
    let cleared = 0
    for (const [id, task] of this.tasks) {
      if (task.status === 'completed' || task.status === 'failed') {
        this.tasks.delete(id)
        cleared++
      }
    }
    return cleared
  }

  /**
   * Total number of tasks.
   */
  get count(): number {
    return this.tasks.size
  }
}

// ─── Task Tool Definitions ──────────────────────────────────────────

export function getTaskTools(): Tool[] {
  return [
    {
      name: 'task_create',
      description: 'Create a new task to track a unit of work. Returns the task ID.',
      input_schema: {
        type: 'object',
        properties: {
          description: {
            type: 'string',
            description: 'Description of the task to create',
          },
        },
        required: ['description'],
      },
    },
    {
      name: 'task_update',
      description: 'Update a task\'s status and/or output.',
      input_schema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Task ID to update',
          },
          status: {
            type: 'string',
            enum: ['pending', 'in_progress', 'completed', 'failed'],
            description: 'New status for the task',
          },
          output: {
            type: 'string',
            description: 'Output or result text for the task',
          },
        },
        required: ['id'],
      },
    },
    {
      name: 'task_list',
      description: 'List all tasks, optionally filtered by status.',
      input_schema: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['pending', 'in_progress', 'completed', 'failed'],
            description: 'Filter by status (optional)',
          },
        },
        required: [],
      },
    },
    {
      name: 'task_get',
      description: 'Get details of a specific task including its output.',
      input_schema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Task ID to retrieve',
          },
        },
        required: ['id'],
      },
    },
  ]
}

// ─── Task Tool Executor ─────────────────────────────────────────────

const TASK_TOOL_NAMES = new Set(['task_create', 'task_update', 'task_list', 'task_get'])

export function isTaskTool(name: string): boolean {
  return TASK_TOOL_NAMES.has(name)
}

export function executeTaskTool(name: string, input: Record<string, any>): string {
  switch (name) {
    case 'task_create': {
      const description = input.description as string
      if (!description) return 'Error: description is required'
      const task = taskManager.create(description)
      return JSON.stringify({
        id: task.id,
        description: task.description,
        status: task.status,
        createdAt: new Date(task.createdAt).toISOString(),
      })
    }

    case 'task_update': {
      const id = input.id as string
      if (!id) return 'Error: id is required'
      try {
        const updates: Partial<Pick<Task, 'status' | 'output'>> = {}
        if (input.status) updates.status = input.status as TaskStatus
        if (input.output !== undefined) updates.output = input.output as string
        taskManager.update(id, updates)
        const task = taskManager.get(id)
        return JSON.stringify({
          id: task!.id,
          description: task!.description,
          status: task!.status,
          output: task!.output ? task!.output.slice(0, 500) : null,
          updatedAt: new Date(task!.updatedAt).toISOString(),
        })
      } catch (err: any) {
        return `Error: ${err.message}`
      }
    }

    case 'task_list': {
      const filter = input.status ? { status: input.status as TaskStatus } : undefined
      const tasks = taskManager.list(filter)
      if (tasks.length === 0) return 'No tasks found.'
      return JSON.stringify(
        tasks.map((t) => ({
          id: t.id,
          description: t.description,
          status: t.status,
          createdAt: new Date(t.createdAt).toISOString(),
          updatedAt: new Date(t.updatedAt).toISOString(),
          hasOutput: !!t.output,
        })),
        null,
        2,
      )
    }

    case 'task_get': {
      const id = input.id as string
      if (!id) return 'Error: id is required'
      const task = taskManager.get(id)
      if (!task) return `Error: Task not found: ${id}`
      return JSON.stringify(
        {
          id: task.id,
          description: task.description,
          status: task.status,
          createdAt: new Date(task.createdAt).toISOString(),
          updatedAt: new Date(task.updatedAt).toISOString(),
          output: task.output ?? null,
          elapsed: `${((task.updatedAt - task.createdAt) / 1000).toFixed(1)}s`,
        },
        null,
        2,
      )
    }

    default:
      return `Error: Unknown task tool "${name}"`
  }
}

// ─── Singleton ──────────────────────────────────────────────────────

/** Global task manager instance */
export const taskManager = new TaskManager()

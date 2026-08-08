import React, { useState } from 'react';
import { Plus, Check, Trash2, ListTodo, Target, Network, Sparkles } from 'lucide-react';
import { TaskItem } from '../types';
import { toPersianDigits } from '../utils/time';
import { MindMapModal } from './MindMapModal';

interface TaskListProps {
  tasks: TaskItem[];
  onUpdateTasks: (newTasks: TaskItem[]) => void;
  activeTaskName: string;
  onSelectTaskForTimer: (taskTitle: string) => void;
}

export const TaskList: React.FC<TaskListProps> = ({
  tasks,
  onUpdateTasks,
  activeTaskName,
  onSelectTaskForTimer,
}) => {
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isMindMapOpen, setIsMindMapOpen] = useState(false);

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const newTask: TaskItem = {
      id: Date.now().toString(),
      title: newTaskTitle.trim(),
      completed: false,
      targetMinutes: 30,
      completedMinutes: 0,
    };

    onUpdateTasks([...tasks, newTask]);
    setNewTaskTitle('');
  };

  const handleToggleTask = (id: string) => {
    const updated = tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t));
    onUpdateTasks(updated);
  };

  const handleDeleteTask = (id: string) => {
    const updated = tasks.filter((t) => t.id !== id);
    onUpdateTasks(updated);
  };

  const handleSyncFromMindMap = (newTasks: string[]) => {
    const createdTasks: TaskItem[] = newTasks.map((title, idx) => ({
      id: `mm_${Date.now()}_${idx}`,
      title,
      completed: false,
      targetMinutes: 30,
      completedMinutes: 0,
    }));
    onUpdateTasks([...tasks, ...createdTasks]);
  };

  return (
    <div className="w-full max-w-5xl mx-auto mt-6 p-6 sm:p-8 rounded-3xl bg-[#0d0221]/90 border border-fuchsia-500/40 shadow-[0_0_35px_rgba(217,70,239,0.18)] backdrop-blur-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-fuchsia-900/50">
        <div>
          <h3 className="text-base font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-fuchsia-200 to-pink-300 flex items-center gap-2">
            <ListTodo className="w-5 h-5 text-fuchsia-400" />
            <span>Focus Session Task Checklist</span>
          </h3>
          <p className="text-xs text-fuchsia-300/70 mt-0.5">
            {tasks.filter((t) => t.completed).length} of {tasks.length} tasks completed
          </p>
        </div>

        {/* Mind Map Diagram Modal Trigger Button */}
        <button
          onClick={() => setIsMindMapOpen(true)}
          className="px-4 py-2 rounded-2xl bg-gradient-to-r from-fuchsia-600 via-purple-600 to-cyan-600 hover:from-fuchsia-500 hover:to-cyan-500 text-white font-extrabold text-xs transition-all duration-300 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(217,70,239,0.4)] hover:shadow-[0_0_25px_rgba(6,182,212,0.6)] hover:scale-[1.02] active:scale-[0.98]"
        >
          <Network className="w-4 h-4 text-cyan-200" />
          <span>نقشه ذهنی و دیاگرام (Mind Map Canvas)</span>
          <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
        </button>
      </div>

      {/* Add Task Input */}
      <form onSubmit={handleAddTask} className="flex gap-2 my-4">
        <input
          type="text"
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          placeholder="Add a new focus task..."
          className="flex-1 px-4 py-2.5 rounded-xl bg-[#150533]/80 border border-fuchsia-800/60 focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-500/30 text-fuchsia-100 text-sm outline-none placeholder-fuchsia-400/40 font-medium"
        />
        <button
          type="submit"
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 text-white font-extrabold text-sm transition flex items-center gap-1.5 shadow-[0_0_15px_rgba(217,70,239,0.35)]"
        >
          <Plus className="w-4 h-4" />
          <span>Add</span>
        </button>
      </form>

      {/* List */}
      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
        {tasks.map((task) => {
          const isCurrentActive = activeTaskName === task.title;

          return (
            <div
              key={task.id}
              className={`p-3.5 rounded-2xl border flex items-center justify-between transition ${
                task.completed
                  ? 'bg-[#12042b]/40 border-fuchsia-950 opacity-60'
                  : isCurrentActive
                  ? 'bg-[#1a073d] border-fuchsia-400 text-fuchsia-100 shadow-[0_0_10px_rgba(217,70,239,0.2)]'
                  : 'bg-[#150533]/60 border-fuchsia-900/60 hover:border-fuchsia-700/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleToggleTask(task.id)}
                  className={`w-5 h-5 rounded-md border flex items-center justify-center transition ${
                    task.completed
                      ? 'bg-gradient-to-r from-fuchsia-600 to-pink-600 border-fuchsia-400 text-white'
                      : 'border-fuchsia-700 hover:border-fuchsia-500'
                  }`}
                >
                  {task.completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </button>

                <span className={`text-sm font-medium ${task.completed ? 'line-through text-fuchsia-400/60' : 'text-fuchsia-200'}`}>
                  {task.title}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {!task.completed && (
                  <button
                    onClick={() => onSelectTaskForTimer(task.title)}
                    className={`px-3 py-1 text-[11px] font-bold rounded-lg border transition ${
                      isCurrentActive
                        ? 'bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white border-fuchsia-400 shadow-[0_0_8px_rgba(217,70,239,0.3)]'
                        : 'bg-fuchsia-950 text-cyan-300 border-fuchsia-800/60 hover:bg-fuchsia-900/80'
                    }`}
                  >
                    <Target className="w-3 h-3 inline mr-1 text-cyan-300" />
                    {isCurrentActive ? 'Active' : 'Set as Active'}
                  </button>
                )}

                <button
                  onClick={() => handleDeleteTask(task.id)}
                  className="p-1 rounded-lg text-fuchsia-400/60 hover:text-rose-400 hover:bg-rose-950/40 transition"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}

        {tasks.length === 0 && (
          <div className="text-center py-6 text-fuchsia-400/60 text-xs">
            No tasks added yet.
          </div>
        )}
      </div>

      {/* Mind Map Canvas Modal */}
      <MindMapModal
        isOpen={isMindMapOpen}
        onClose={() => setIsMindMapOpen(false)}
        onSyncTasksToMain={handleSyncFromMindMap}
      />
    </div>
  );
};

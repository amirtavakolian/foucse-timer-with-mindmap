import React, { useState } from 'react';
import { Plus, Check, Trash2, ListTodo, Target, Network, Sparkles, ListPlus, TrendingUp } from 'lucide-react';
import { TaskItem } from '../types';
import { toPersianDigits } from '../utils/time';
import { MindMapModal } from './MindMapModal';
import { StaircaseModal } from './StaircaseModal';

interface TaskListProps {
  tasks: TaskItem[];
  onUpdateTasks: (newTasks: TaskItem[]) => void;
  activeTaskName: string;
  onSelectTaskForTimer: (taskTitle: string) => void;
}

export const TaskList: React.FC<TaskListProps> = React.memo(({
  tasks,
  onUpdateTasks,
  activeTaskName,
  onSelectTaskForTimer,
}) => {
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isMindMapOpen, setIsMindMapOpen] = useState(false);
  const [isStaircaseOpen, setIsStaircaseOpen] = useState(false);
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [batchText, setBatchText] = useState('');
  const [taskToDelete, setTaskToDelete] = useState<TaskItem | null>(null);

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

  const handleBatchAddTasks = () => {
    const lines = batchText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) return;

    const now = Date.now();
    const newTasksList: TaskItem[] = lines.map((line, idx) => ({
      id: `${now}_${idx}`,
      title: line,
      completed: false,
      targetMinutes: 30,
      completedMinutes: 0,
    }));

    onUpdateTasks([...tasks, ...newTasksList]);
    setBatchText('');
    setIsBatchOpen(false);
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

  const handleSyncFromStaircase = (newTasks: string[]) => {
    const createdTasks: TaskItem[] = newTasks.map((title, idx) => ({
      id: `stair_${Date.now()}_${idx}`,
      title,
      completed: false,
      targetMinutes: 25,
      completedMinutes: 0,
    }));
    onUpdateTasks([...tasks, ...createdTasks]);
  };

  return (
    <div className="w-full p-6 sm:p-8 rounded-3xl bg-[#0d0221] border border-fuchsia-500/40 shadow-[0_0_25px_rgba(217,70,239,0.12)]">
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

        {/* Modal Triggers: Staircase Todo & Mind Map */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Staircase Todo Modal Trigger Button */}
          <button
            onClick={() => setIsStaircaseOpen(true)}
            className="px-4 py-2 rounded-2xl bg-gradient-to-r from-amber-600 via-amber-700 to-orange-700 hover:from-amber-500 hover:to-orange-600 text-white font-extrabold text-xs transition-all duration-300 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(245,158,11,0.35)] hover:shadow-[0_0_25px_rgba(245,158,11,0.6)] hover:scale-[1.02] active:scale-[0.98]"
            title="پلکان اهداف و تسک‌ها (Staircase Todo)"
          >
            <TrendingUp className="w-4 h-4 text-amber-200" />
            <span>پلکان اهداف (Staircase Todo)</span>
            <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
          </button>

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
      </div>

      {/* Add Task Input */}
      <div className="my-4 space-y-2">
        <form onSubmit={handleAddTask} className="flex gap-2">
          <input
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="افزودن کار جدید..."
            className="flex-1 px-4 py-2.5 rounded-xl bg-[#150533]/80 border border-fuchsia-800/60 focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-500/30 text-fuchsia-100 text-sm outline-none placeholder-fuchsia-400/40 font-medium"
          />
          <button
            type="submit"
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 text-white font-extrabold text-sm transition flex items-center gap-1 shadow-[0_0_15px_rgba(217,70,239,0.35)] cursor-pointer shrink-0"
            title="افزودن کار (تک خطی)"
          >
            <Plus className="w-4 h-4" />
            <span>افزودن</span>
          </button>
          <button
            type="button"
            onClick={() => setIsBatchOpen(!isBatchOpen)}
            className={`px-3 py-2.5 rounded-xl border transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
              isBatchOpen
                ? 'bg-cyan-500 text-black border-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.5)]'
                : 'bg-[#150533]/80 hover:bg-fuchsia-950 text-cyan-300 border-fuchsia-800/60 hover:border-cyan-500/60'
            }`}
            title="افزودن چند خطی (گروهی)"
          >
            <ListPlus className="w-4 h-4" />
          </button>
        </form>

        {isBatchOpen && (
          <div className="p-3 rounded-2xl bg-[#090217] border border-cyan-500/60 shadow-[0_0_18px_rgba(6,182,212,0.25)] space-y-2 animate-in fade-in duration-150">
            <div className="flex items-center justify-between text-xs font-extrabold text-cyan-300">
              <span className="flex items-center gap-1.5">
                <ListPlus className="w-4 h-4 text-cyan-400" />
                <span>ورود گروهی کارهای چند خطی:</span>
              </span>
              <span className="text-[10px] text-fuchsia-300/70 font-normal">هر خط = یک کار جدید</span>
            </div>

            <textarea
              rows={5}
              dir="rtl"
              value={batchText}
              onChange={(e) => setBatchText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  handleBatchAddTasks();
                }
              }}
              placeholder={'متن چند خطی خود را وارد یا پیست کنید...\nمثال:\n۲.۱: گوروتین چیست؟\n۲.۲: ایجاد Goroutineها\n۲.۳: چرخه حیات گوروتین'}
              className="w-full p-2.5 text-xs rounded-xl bg-[#0d0221] border border-fuchsia-800/80 text-fuchsia-100 placeholder-fuchsia-400/35 outline-none focus:border-cyan-400 resize-y leading-relaxed"
            />

            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-xs font-bold text-fuchsia-300/80">
                تعداد خط‌ها: {toPersianDigits(batchText.split(/\r?\n/).filter((l) => l.trim().length > 0).length)}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsBatchOpen(false)}
                  className="px-3 py-1 rounded-lg text-xs font-semibold text-fuchsia-300 hover:text-white hover:bg-fuchsia-950/60 border border-fuchsia-800/40 transition cursor-pointer"
                >
                  لغو
                </button>
                <button
                  type="button"
                  onClick={handleBatchAddTasks}
                  disabled={!batchText.trim()}
                  className="px-3.5 py-1 rounded-lg text-xs font-extrabold bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 shadow-[0_0_10px_rgba(6,182,212,0.3)] cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>ثبت همه خط‌ها</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

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
                  onClick={() => setTaskToDelete(task)}
                  className="p-1 rounded-lg text-fuchsia-400/60 hover:text-rose-400 hover:bg-rose-950/40 transition"
                  title="حذف تسک"
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

      {/* Staircase Todo List Modal */}
      <StaircaseModal
        isOpen={isStaircaseOpen}
        onClose={() => setIsStaircaseOpen(false)}
        onSyncTasksToMain={handleSyncFromStaircase}
      />

      {/* Delete Task Confirmation Modal */}
      {taskToDelete && (
        <div
          className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setTaskToDelete(null)}
          dir="rtl"
        >
          <div
            className="bg-[#12042b] border-2 border-rose-500/70 rounded-3xl p-6 max-w-sm w-full shadow-[0_0_40px_rgba(244,63,94,0.35)] flex flex-col gap-4 text-right"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-fuchsia-900/60 pb-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-400 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(244,63,94,0.3)]">
                <Trash2 className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white">حذف تسک</h3>
                <p className="text-[11px] text-rose-300/80 font-medium mt-0.5">تایید عملیات حذف</p>
              </div>
            </div>

            <div className="space-y-2 py-1">
              <p className="text-xs font-bold text-fuchsia-100 leading-relaxed">
                می‌خوای حذف بشه این تسک؟
              </p>
              <div className="p-3 rounded-xl bg-fuchsia-950/50 border border-fuchsia-800/50 text-xs font-semibold text-cyan-200 break-words leading-relaxed">
                «{taskToDelete.title}»
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-fuchsia-900/60">
              <button
                type="button"
                onClick={() => setTaskToDelete(null)}
                className="px-4 py-2 rounded-xl bg-fuchsia-950/80 hover:bg-fuchsia-900 text-fuchsia-200 text-xs font-bold border border-fuchsia-800/60 transition"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={() => {
                  handleDeleteTask(taskToDelete.id);
                  setTaskToDelete(null);
                }}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white text-xs font-black shadow-[0_0_15px_rgba(244,63,94,0.35)] transition flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>بله، حذف شود</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

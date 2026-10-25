import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  MessageSquare,
  Plus,
  ShieldAlert,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';
import {
  CollaboratorPresence,
  CollaborativeTask,
  Farm,
  Field,
  TaskCategory,
  TaskPriority,
  TaskStatus,
  UserRole,
} from '../../types/agriculture';
import { validateTaskInput } from '../../utils/agronomyEngine';

interface TaskCollaborationViewProps {
  tasks: CollaborativeTask[];
  farms: Farm[];
  fields: Field[];
  collaborators: CollaboratorPresence[];
  currentUser: {
    uid: string;
    displayName: string;
    role: UserRole;
    isFirebaseAuthenticated: boolean;
  };
  selectedFieldId: string;
  onCreateTask: (taskInput: {
    title: string;
    description: string;
    farmId: string;
    fieldId: string;
    category: TaskCategory;
    priority: TaskPriority;
    assigneeName: string;
    assigneeId: string;
    dueDate: string;
    safetyInterlockRequired: boolean;
  }) => Promise<void>;
  onUpdateTaskStatus: (
    taskId: string,
    status: TaskStatus,
    safetyConfirmedBy?: string
  ) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onAddComment: (taskId: string, content: string) => Promise<void>;
  openModalOnMount?: boolean;
  onModalClose?: () => void;
}

export const TaskCollaborationView: React.FC<TaskCollaborationViewProps> = ({
  tasks,
  farms,
  fields,
  collaborators,
  currentUser,
  selectedFieldId,
  onCreateTask,
  onUpdateTaskStatus,
  onDeleteTask,
  onAddComment,
  openModalOnMount = false,
  onModalClose,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | TaskCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isNewModalOpen, setIsNewModalOpen] = useState(openModalOnMount);

  // New Task Form State
  const defaultField =
    fields.find((f) => f.id === selectedFieldId) || fields[0];
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [farmId, setFarmId] = useState(defaultField?.farmId || farms[0]?.id || 'FARM-001');
  const [fieldId, setFieldId] = useState(defaultField?.id || 'FIELD-001');
  const [category, setCategory] = useState<TaskCategory>('irrigation');
  const [priority, setPriority] = useState<TaskPriority>('high');
  const [assigneeName, setAssigneeName] = useState('Rajesh Patel (Lead Farmer)');
  const [dueDate, setDueDate] = useState('2026-10-26');
  const [safetyInterlockRequired, setSafetyInterlockRequired] = useState(true);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Comment input per task
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  // Safety confirmation checkbox per task
  const [interlockChecked, setInterlockChecked] = useState<Record<string, boolean>>({});

  React.useEffect(() => {
    if (openModalOnMount) {
      setIsNewModalOpen(true);
    }
  }, [openModalOnMount]);

  const filteredTasks = tasks.filter((task) => {
    if (selectedFieldId !== 'all' && task.fieldId !== selectedFieldId) return false;
    if (statusFilter !== 'all' && task.status !== statusFilter) return false;
    if (categoryFilter !== 'all' && task.category !== categoryFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        task.title.toLowerCase().includes(q) ||
        task.description.toLowerCase().includes(q) ||
        task.assigneeName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateTaskInput({
      title,
      description,
      farmId,
      fieldId,
      assigneeName,
      dueDate,
    });
    if (!validation.valid) {
      setFormErrors(validation.errors);
      return;
    }
    setFormErrors([]);
    setIsSubmitting(true);
    try {
      await onCreateTask({
        title: title.trim(),
        description: description.trim(),
        farmId,
        fieldId,
        category,
        priority,
        assigneeName: assigneeName.trim(),
        assigneeId: currentUser.uid,
        dueDate,
        safetyInterlockRequired,
      });
      setTitle('');
      setDescription('');
      setIsNewModalOpen(false);
      onModalClose?.();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCommentSubmit = async (taskId: string) => {
    const text = (commentDrafts[taskId] || '').trim();
    if (!text) return;
    await onAddComment(taskId, text);
    setCommentDrafts((prev) => ({ ...prev, [taskId]: '' }));
  };

  const todoCount = filteredTasks.filter((t) => t.status === 'todo').length;
  const inProgressCount = filteredTasks.filter((t) => t.status === 'in_progress').length;
  const completedCount = filteredTasks.filter((t) => t.status === 'completed').length;

  return (
    <div className="space-y-6">
      {/* Header & Collaborator Presence Strip */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-5 border-b border-slate-200">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Collaborative Field Task & Safety Workflow
          </h2>
          <p className="text-sm text-slate-600">
            Real-time task synchronization across farmers, agribusiness advisors, and IoT maintenance technicians with human-in-the-loop safety interlocks.
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 pt-0.5">
            <Users className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
            <span className="font-semibold text-slate-800 tabular-nums">
              {collaborators.length} Active Collaborators:
            </span>
            {collaborators.map((c, i) => (
              <React.Fragment key={c.clientId}>
                {i > 0 && <span aria-hidden="true">·</span>}
                <span className="text-slate-700">
                  {c.displayName} ({c.role})
                </span>
              </React.Fragment>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setFormErrors([]);
            setIsNewModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Create Field Task
        </button>
      </div>

      {/* Interactive Filter Toolbar & Summary Metrics */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200">
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
            role="group"
            aria-label="Filter tasks by status"
          >
            {(
              [
                { id: 'all', label: `All (${filteredTasks.length})` },
                { id: 'todo', label: `To Do (${todoCount})` },
                { id: 'in_progress', label: `In Progress (${inProgressCount})` },
                { id: 'completed', label: `Completed (${completedCount})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <select
            aria-label="Filter tasks by operational category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as 'all' | TaskCategory)}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
          >
            <option value="all">All Categories</option>
            <option value="irrigation">Irrigation & Valve Checks</option>
            <option value="scouting">Crop & Disease Scouting</option>
            <option value="sensor_maintenance">ESP32 Sensor Maintenance</option>
            <option value="soil_nutrition">Soil & NPK Nutrition</option>
            <option value="disease_management">Disease Intervention</option>
          </select>
        </div>

        <div className="w-full md:w-72">
          <input
            type="search"
            aria-label="Search tasks by title or assignee"
            placeholder="Search tasks, fields, or assignees..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-1.5 text-xs text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
        </div>
      </div>

      {/* Create New Task Form Modal / Expandable Panel */}
      {isNewModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-task-dialog-title"
          className="bg-white p-6 rounded-xl border border-slate-300 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <h3 id="create-task-dialog-title" className="text-lg font-bold text-slate-900">
              Assign New Agronomic or Maintenance Task
            </h3>
            <button
              type="button"
              onClick={() => {
                setIsNewModalOpen(false);
                onModalClose?.();
              }}
              className="px-3 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Cancel
            </button>
          </div>

          {formErrors.length > 0 && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 space-y-1"
            >
              <p className="font-semibold">Please fix the following validation errors:</p>
              <ul className="list-disc pl-4">
                {formErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          <form onSubmit={handleCreateSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label
                htmlFor="task-title-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Task Title (3–160 chars)
              </label>
              <input
                id="task-title-input"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Verify Root-Zone Moisture & Open North Canal Valve"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label
                htmlFor="task-field-select"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Target Field Parcel
              </label>
              <select
                id="task-field-select"
                value={fieldId}
                onChange={(e) => {
                  const selected = fields.find((f) => f.id === e.target.value);
                  setFieldId(e.target.value);
                  if (selected) setFarmId(selected.farmId);
                }}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                {fields.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.id} — {f.name} ({f.crop}, {f.growthStage})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="task-category-select"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Operational Category
              </label>
              <select
                id="task-category-select"
                value={category}
                onChange={(e) => setCategory(e.target.value as TaskCategory)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                <option value="irrigation">Irrigation & Water Delivery</option>
                <option value="scouting">Field & Leaf Scouting</option>
                <option value="sensor_maintenance">ESP32 Sensor & Calibration</option>
                <option value="soil_nutrition">Soil pH & NPK Management</option>
                <option value="disease_management">Advisory Disease Control</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="task-priority-select"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Urgency / Severity Level
              </label>
              <select
                id="task-priority-select"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                <option value="high">High — Immediate Field Inspection</option>
                <option value="medium">Medium — Within 24 Hours</option>
                <option value="low">Low — Routine Schedule</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="task-assignee-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Assigned Collaborator
              </label>
              <input
                id="task-assignee-input"
                type="text"
                value={assigneeName}
                onChange={(e) => setAssigneeName(e.target.value)}
                placeholder="e.g., Rajesh Patel (Lead Farmer)"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label
                htmlFor="task-duedate-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Target Completion Date
              </label>
              <input
                id="task-duedate-input"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div className="flex items-center gap-2 pt-5">
              <input
                id="task-interlock-checkbox"
                type="checkbox"
                checked={safetyInterlockRequired}
                onChange={(e) => setSafetyInterlockRequired(e.target.checked)}
                className="w-4 h-4 text-emerald-700 rounded border-slate-300"
              />
              <label
                htmlFor="task-interlock-checkbox"
                className="text-xs font-medium text-slate-700"
              >
                Require Human Safety Interlock Confirmation before marking Completed (MVP Pump/Valve Boundary)
              </label>
            </div>

            <div className="md:col-span-2">
              <label
                htmlFor="task-desc-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Practical Instructions & Agronomic Context
              </label>
              <textarea
                id="task-desc-input"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what was observed, where in the parcel to inspect, and what safety checks must be verified first..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div className="md:col-span-2 flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsNewModalOpen(false);
                  onModalClose?.();
                }}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors cursor-pointer"
              >
                {isSubmitting ? 'Syncing Task...' : 'Save & Broadcast Task'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Task List (Flat Single-Elevation Surface with Hairline Dividers) */}
      {filteredTasks.length === 0 ? (
        <div className="bg-white p-10 rounded-xl border border-slate-200 text-center space-y-3">
          <p className="text-sm font-semibold text-slate-800">
            No collaborative tasks match the current filter.
          </p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Create a new field task or adjust the status and category filters above to view tasks across all registered fields.
          </p>
          <button
            type="button"
            onClick={() => {
              setStatusFilter('all');
              setCategoryFilter('all');
              setSearchQuery('');
            }}
            className="px-4 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors cursor-pointer"
          >
            Reset Task Filters
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-200">
          {filteredTasks.map((task) => {
            const fieldObj = fields.find((f) => f.id === task.fieldId);
            const needsInterlock =
              task.safetyInterlockRequired &&
              task.status !== 'completed' &&
              !interlockChecked[task.id];

            return (
              <div key={task.id} className="p-5 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="space-y-1.5 max-w-3xl">
                    {/* Unboxed inline metadata per Zero-Pill Discipline */}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
                      <span className="font-semibold text-slate-700">{task.id}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        Field: {fieldObj ? `${fieldObj.name} (${fieldObj.crop})` : task.fieldId}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={
                          task.priority === 'high'
                            ? 'text-red-700 font-semibold'
                            : task.priority === 'medium'
                            ? 'text-amber-700 font-semibold'
                            : 'text-slate-600'
                        }
                      >
                        Priority: {task.priority.toUpperCase()}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>Category: {task.category.replace('_', ' ')}</span>
                      <span aria-hidden="true">·</span>
                      <span>Due: {task.dueDate}</span>
                      {task.linkedAlertId && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-amber-800">
                            Linked Alert: {task.linkedAlertId}
                          </span>
                        </>
                      )}
                    </div>

                    <h3 className="text-base font-bold text-slate-900">{task.title}</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">{task.description}</p>

                    <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-600">
                      <span className="inline-flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                        Assigned to: <strong className="text-slate-800">{task.assigneeName}</strong>
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        Updated {new Date(task.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {task.safetyConfirmedBy && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-emerald-700 font-medium">
                            Safety Interlock Verified by {task.safetyConfirmedBy}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Interactive Workflow Controls */}
                  <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end gap-2 shrink-0">
                    <div
                      className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
                      role="group"
                      aria-label={`Change status for ${task.title}`}
                    >
                      <button
                        type="button"
                        onClick={() => onUpdateTaskStatus(task.id, 'todo')}
                        className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          task.status === 'todo'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        To Do
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdateTaskStatus(task.id, 'in_progress')}
                        className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          task.status === 'in_progress'
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        In Progress
                      </button>
                      <button
                        type="button"
                        disabled={Boolean(needsInterlock)}
                        title={
                          needsInterlock
                            ? 'Confirm manual safety interlock checkbox below before completing'
                            : 'Mark task completed'
                        }
                        onClick={() =>
                          onUpdateTaskStatus(
                            task.id,
                            'completed',
                            task.safetyInterlockRequired ? currentUser.displayName : undefined
                          )
                        }
                        className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                          task.status === 'completed'
                            ? 'bg-emerald-700 text-white shadow-xs cursor-pointer'
                            : needsInterlock
                            ? 'text-slate-400 cursor-not-allowed'
                            : 'text-slate-600 hover:text-slate-900 cursor-pointer'
                        }`}
                      >
                        Completed
                      </button>
                    </div>

                    <button
                      type="button"
                      aria-label={`Delete task ${task.title}`}
                      onClick={() => onDeleteTask(task.id)}
                      className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remove
                    </button>
                  </div>
                </div>

                {/* Human-in-the-loop Safety Interlock Gate for High-Impact Irrigation/Actuation */}
                {task.safetyInterlockRequired && task.status !== 'completed' && (
                  <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg bg-amber-50/70 border border-amber-200 text-xs text-amber-900">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
                      <span>
                        <strong>Human Safety Interlock (Blueprint Section 2 & 10):</strong> Pump/valve actuation requires physical field confirmation before marking Completed.
                      </span>
                    </div>
                    <label className="inline-flex items-center gap-2 font-semibold cursor-pointer whitespace-nowrap shrink-0">
                      <input
                        type="checkbox"
                        checked={Boolean(interlockChecked[task.id])}
                        onChange={(e) =>
                          setInterlockChecked((prev) => ({
                            ...prev,
                            [task.id]: e.target.checked,
                          }))
                        }
                        className="w-4 h-4 accent-emerald-700 rounded"
                      />
                      Confirm Valve & Line Checked
                    </label>
                  </div>
                )}

                {/* Collaborative Field Notes & Comments */}
                <div className="pt-2 border-t border-slate-100 space-y-2.5">
                  {task.comments && task.comments.length > 0 && (
                    <div className="space-y-1.5">
                      {task.comments.map((c) => (
                        <div
                          key={c.id}
                          className="text-xs text-slate-700 bg-slate-50 px-3 py-2 rounded-lg flex flex-wrap items-baseline justify-between gap-2"
                        >
                          <div>
                            <span className="font-semibold text-slate-900">{c.authorName}</span>
                            <span className="text-slate-500"> ({c.authorRole}): </span>
                            <span>{c.content}</span>
                          </div>
                          <span className="text-slate-400 font-mono tabular-nums text-[11px]">
                            {new Date(c.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      aria-label={`Add collaboration note to ${task.title}`}
                      placeholder="Add real-time field observation or advisor note..."
                      value={commentDrafts[task.id] || ''}
                      onChange={(e) =>
                        setCommentDrafts((prev) => ({ ...prev, [task.id]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleCommentSubmit(task.id);
                        }
                      }}
                      className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                    <button
                      type="button"
                      onClick={() => handleCommentSubmit(task.id)}
                      className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Post Note
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

import { useState, useEffect, useRef, useMemo, useCallback, MouseEvent, UIEvent } from 'react';
import { Project, Task, SyncStatus } from './types';
import {
  auth,
  db,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  onAuthStateChanged,
  signInAnonymously,
  User,
} from './firebase';
import {
  computeTaskDates,
  DEFAULT_TASKS,
  formatDateToISO,
  toDate,
  addDays,
  diffDays,
} from './utils/ganttUtils';

import Header from './components/Header';
import Sidebar from './components/Sidebar';
import TaskTable from './components/TaskTable';
import GanttChart from './components/GanttChart';
import NewProjectModal from './components/NewProjectModal';
import EditTaskModal from './components/EditTaskModal';
import AuthModal from './components/AuthModal';

const LOCAL_STORAGE_KEY = 'freeGanttData_teletravan';

const DEFAULT_INITIAL_PROJECT: Project = {
  id: 'proj_default',
  name: 'Mon Premier Projet',
  j0: formatDateToISO(new Date()),
  tasks: DEFAULT_TASKS.map((t) => ({ ...t })),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export default function App() {
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Projects state initialized with local cache or default demo project
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const local = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed.projects) && parsed.projects.length > 0) {
          return parsed.projects;
        }
      }
    } catch (e) {
      console.warn('Initial localStorage read error:', e);
    }
    return [DEFAULT_INITIAL_PROJECT];
  });

  const [currentProjectId, setCurrentProjectId] = useState<string>(() => {
    try {
      const local = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (local) {
        const parsed = JSON.parse(local);
        if (parsed.currentProjectId) return parsed.currentProjectId;
        if (parsed.projects?.[0]?.id) return parsed.projects[0].id;
      }
    } catch (e) {
      // ignore
    }
    return DEFAULT_INITIAL_PROJECT.id;
  });

  const [syncStatus, setSyncStatus] = useState<SyncStatus>('saved');

  // UI state
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [dayWidth, setDayWidth] = useState<number>(30);
  const [taskTableWidth, setTaskTableWidth] = useState<number>(420);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Scroll synchronization refs
  const taskTableScrollRef = useRef<HTMLDivElement>(null);
  const ganttChartScrollRef = useRef<HTMLDivElement>(null);
  const isSyncingScrollRef = useRef(false);

  const handleTaskTableScroll = (e: UIEvent<HTMLDivElement>) => {
    if (isSyncingScrollRef.current) return;
    isSyncingScrollRef.current = true;
    if (ganttChartScrollRef.current) {
      ganttChartScrollRef.current.scrollTop = e.currentTarget.scrollTop;
    }
    requestAnimationFrame(() => {
      isSyncingScrollRef.current = false;
    });
  };

  const handleGanttChartScroll = (e: UIEvent<HTMLDivElement>) => {
    if (isSyncingScrollRef.current) return;
    isSyncingScrollRef.current = true;
    if (taskTableScrollRef.current) {
      taskTableScrollRef.current.scrollTop = e.currentTarget.scrollTop;
    }
    requestAnimationFrame(() => {
      isSyncingScrollRef.current = false;
    });
  };

  // Debounce timer for Firestore saves
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialLoadRef = useRef(true);

  // 1. Listen for Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);

      if (!currentUser) {
        try {
          await signInAnonymously(auth);
        } catch (e) {
          console.warn('Anonymous sign-in unavailable, opening auth modal:', e);
          setIsAuthModalOpen(true);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // 2. Real-time Firestore sync when User is available
  useEffect(() => {
    if (!user) return;

    setSyncStatus('saving');
    const projectsCol = collection(db, 'users', user.uid, 'projects');

    const unsubscribe = onSnapshot(
      projectsCol,
      async (snapshot) => {
        if (!snapshot.empty) {
          const firestoreProjects: Project[] = [];
          snapshot.forEach((docSnap) => {
            firestoreProjects.push({ id: docSnap.id, ...docSnap.data() } as Project);
          });

          firestoreProjects.sort((a, b) => {
            const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
            const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
            return timeB - timeA;
          });

          setProjects(firestoreProjects);
          setCurrentProjectId((prev) => {
            if (prev && firestoreProjects.some((p) => p.id === prev)) {
              return prev;
            }
            return firestoreProjects[0].id;
          });
          setSyncStatus('saved');
        } else if (isInitialLoadRef.current) {
          // Upload local/default projects to Firestore for the user
          const projectsToSync = projects.length > 0 ? projects : [DEFAULT_INITIAL_PROJECT];
          for (const proj of projectsToSync) {
            try {
              const sanitized: Project = {
                ...proj,
                tasks: (proj.tasks || []).map((t) => {
                  const { computedStart, computedEnd, ...raw } = t;
                  return raw;
                }),
                updatedAt: new Date().toISOString(),
              };
              await setDoc(doc(db, 'users', user.uid, 'projects', sanitized.id), sanitized);
            } catch (err) {
              console.error('Error migrating initial project to Firestore:', err);
            }
          }
          setSyncStatus('saved');
        }
        isInitialLoadRef.current = false;
      },
      (error) => {
        console.error('Firestore onSnapshot error:', error);
        setSyncStatus('offline');
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Current active project
  const currentProject = useMemo(() => {
    if (projects.length === 0) return null;
    return projects.find((p) => p.id === currentProjectId) || projects[0];
  }, [projects, currentProjectId]);

  // Computed Gantt parameters for the current project
  const { computedTasks, params: timelineParams } = useMemo(() => {
    if (!currentProject) {
      return {
        computedTasks: [],
        params: { start: new Date(), end: new Date(), totalDays: 30 },
      };
    }
    return computeTaskDates(currentProject.tasks || [], currentProject.j0);
  }, [currentProject]);

  // 3. Save project to Firestore (and LocalStorage backup)
  const persistProject = useCallback(
    (updatedProject: Project) => {
      // Strip computed dates before persisting
      const sanitizedProject: Project = {
        ...updatedProject,
        tasks: (updatedProject.tasks || []).map((t) => {
          const { computedStart, computedEnd, ...raw } = t;
          return raw;
        }),
        updatedAt: new Date().toISOString(),
      };

      // 1. Update local state immediately for 60fps UI
      setProjects((prev) =>
        prev.map((p) => (p.id === sanitizedProject.id ? sanitizedProject : p))
      );

      // Save to localStorage as immediate offline cache
      try {
        localStorage.setItem(
          LOCAL_STORAGE_KEY,
          JSON.stringify({
            currentProjectId: sanitizedProject.id,
            projects: projects.map((p) =>
              p.id === sanitizedProject.id ? sanitizedProject : p
            ),
          })
        );
      } catch (err) {
        // ignore
      }

      // 2. Debounced save to Firestore
      if (user) {
        setSyncStatus('saving');
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

        saveTimeoutRef.current = setTimeout(async () => {
          try {
            const projectRef = doc(db, 'users', user.uid, 'projects', sanitizedProject.id);
            await setDoc(projectRef, sanitizedProject, { merge: true });
            setSyncStatus('saved');
          } catch (err) {
            console.error('Error saving to Firestore:', err);
            setSyncStatus('error');
          }
        }, 400);
      }
    },
    [user, projects]
  );

  // Handlers for Project modifications
  const handleUpdateProjectName = (name: string) => {
    if (!currentProject) return;
    persistProject({ ...currentProject, name });
  };

  const handleUpdateProjectJ0 = (j0: string) => {
    if (!currentProject) return;
    persistProject({ ...currentProject, j0 });
  };

  const handleCreateProject = async (name: string, startDate: string) => {
    const newProject: Project = {
      id: 'proj_' + Math.random().toString(36).substring(2, 9),
      name,
      j0: startDate,
      tasks: JSON.parse(JSON.stringify(DEFAULT_TASKS)),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setProjects((prev) => [...prev, newProject]);
    setCurrentProjectId(newProject.id);

    if (user) {
      try {
        setSyncStatus('saving');
        await setDoc(doc(db, 'users', user.uid, 'projects', newProject.id), newProject);
        setSyncStatus('saved');
      } catch (e) {
        console.error('Error creating project in Firestore:', e);
        setSyncStatus('error');
      }
    }
  };

  const handleDeleteProject = async (id: string) => {
    const remaining = projects.filter((p) => p.id !== id);

    if (remaining.length === 0) {
      // If the last project was deleted, create a fresh empty project
      const freshProject: Project = {
        id: 'proj_' + Math.random().toString(36).substring(2, 9),
        name: 'Nouveau Projet',
        j0: formatDateToISO(new Date()),
        tasks: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setProjects([freshProject]);
      setCurrentProjectId(freshProject.id);

      try {
        localStorage.setItem(
          LOCAL_STORAGE_KEY,
          JSON.stringify({
            currentProjectId: freshProject.id,
            projects: [freshProject],
          })
        );
      } catch (e) {
        // ignore
      }

      if (user) {
        try {
          setSyncStatus('saving');
          await deleteDoc(doc(db, 'users', user.uid, 'projects', id));
          await setDoc(doc(db, 'users', user.uid, 'projects', freshProject.id), freshProject);
          setSyncStatus('saved');
        } catch (e) {
          console.error('Error in Firestore deletion/reset:', e);
          setSyncStatus('error');
        }
      }
    } else {
      setProjects(remaining);
      const nextProjectId = currentProjectId === id ? remaining[0].id : currentProjectId;
      if (currentProjectId === id) {
        setCurrentProjectId(remaining[0].id);
      }

      try {
        localStorage.setItem(
          LOCAL_STORAGE_KEY,
          JSON.stringify({
            currentProjectId: nextProjectId,
            projects: remaining,
          })
        );
      } catch (e) {
        // ignore
      }

      if (user) {
        try {
          setSyncStatus('saving');
          await deleteDoc(doc(db, 'users', user.uid, 'projects', id));
          setSyncStatus('saved');
        } catch (e) {
          console.error('Error deleting project in Firestore:', e);
          setSyncStatus('error');
        }
      }
    }
  };

  // Handlers for Task operations
  const handleAddTask = (newTaskPartial: Partial<Task>) => {
    if (!currentProject) return;
    const newTask: Task = {
      id: newTaskPartial.id || 'T' + (currentProject.tasks.length + 1),
      name: newTaskPartial.name || 'Nouvelle tâche',
      dependsOn: newTaskPartial.dependsOn || null,
      offset: newTaskPartial.offset || 0,
      duration: newTaskPartial.duration || 1,
      color: newTaskPartial.color || 'Bleu',
      manualStart: newTaskPartial.manualStart || currentProject.j0,
    };

    const updatedTasks = [...currentProject.tasks, newTask];
    persistProject({ ...currentProject, tasks: updatedTasks });
  };

  const handleUpdateTask = (updatedTask: Task) => {
    if (!currentProject) return;
    const updatedTasks = currentProject.tasks.map((t) =>
      t.id === updatedTask.id ? updatedTask : t
    );
    persistProject({ ...currentProject, tasks: updatedTasks });
  };

  // Update task from EditTaskModal ("box de paramétrage")
  // Rule: "quand je demande un décalage [...] toutes les taches qui se trouvent apres ce décalage doivent décaler d'autant."
  const handleSaveEditedTask = (updatedTask: Task) => {
    if (!currentProject) return;

    const originalTask = currentProject.tasks.find((t) => t.id === updatedTask.id);
    if (!originalTask) {
      handleUpdateTask(updatedTask);
      return;
    }

    const taskIndex = currentProject.tasks.findIndex((t) => t.id === updatedTask.id);
    if (taskIndex === -1) {
      handleUpdateTask(updatedTask);
      return;
    }

    // Compute task start dates before modification to determine exact shift in days
    const beforeComputed = computeTaskDates(currentProject.tasks, currentProject.j0).computedTasks;
    const oldTaskComputed = beforeComputed.find((t) => t.id === updatedTask.id);
    const oldStartDate = oldTaskComputed?.computedStart || toDate(currentProject.j0);

    // Compute intended new start date for updatedTask
    let newStartDate: Date;
    if (!updatedTask.dependsOn || updatedTask.dependsOn === 'none') {
      newStartDate = toDate(updatedTask.manualStart || currentProject.j0);
    } else if (updatedTask.dependsOn === 'J0') {
      newStartDate = addDays(currentProject.j0, Number(updatedTask.offset) || 0);
    } else {
      const parentComputed = beforeComputed.find((t) => t.id === updatedTask.dependsOn);
      const parentEnd = parentComputed?.computedEnd || toDate(currentProject.j0);
      newStartDate = addDays(parentEnd, Number(updatedTask.offset) || 0);
    }

    const deltaDays = diffDays(oldStartDate, newStartDate);

    let updatedTasks: Task[];
    if (deltaDays !== 0) {
      // User requested a shift.
      // Rule: "tous les éléments apres la box modifiée doivent décaler d'autant de jour."
      // All tasks situated after this task (idx > taskIndex) must shift by deltaDays.
      updatedTasks = currentProject.tasks.map((t, idx) => {
        if (t.id === updatedTask.id) {
          return updatedTask;
        }
        if (idx > taskIndex) {
          // If task has no dependency, shift its manualStart date
          if (!t.dependsOn || t.dependsOn === 'none') {
            const taskBefore = beforeComputed.find((x) => x.id === t.id);
            const curStart =
              taskBefore?.computedStart ||
              (t.manualStart ? toDate(t.manualStart) : toDate(currentProject.j0));
            return {
              ...t,
              manualStart: formatDateToISO(addDays(curStart, deltaDays)),
            };
          }

          // If task has a dependency:
          // Check if its parent is also part of the shifted tasks (i.e. parent index >= taskIndex)
          const parentIdx = currentProject.tasks.findIndex((x) => x.id === t.dependsOn);
          if (parentIdx >= taskIndex) {
            // Parent is ALSO shifted by deltaDays!
            // Therefore, keeping the same relative offset naturally shifts this task by deltaDays.
            // Do NOT touch offset (touching offset would double-shift this task).
            return t;
          } else {
            // Parent is NOT shifted (it is either 'J0' or a task before taskIndex).
            // Therefore, to shift this task by deltaDays, we must increase its offset by deltaDays.
            return {
              ...t,
              offset: (Number(t.offset) || 0) + deltaDays,
            };
          }
        }
        return t;
      });
    } else {
      // No start date shift (e.g. only duration, name, or color changed)
      updatedTasks = currentProject.tasks.map((t) =>
        t.id === updatedTask.id ? updatedTask : t
      );
    }

    persistProject({ ...currentProject, tasks: updatedTasks });
  };

  // Move task directly in calendar ("à la main dans le calendrier")
  // Rule: "si je bouge une tache a la main dans le calendrier [...] seule la tache que j'ai fait glisser bouge."
  const handleMoveTaskInCalendar = (taskId: string, deltaDays: number) => {
    if (!currentProject || deltaDays === 0) return;

    const updatedTasks = currentProject.tasks.map((t) => {
      if (t.id === taskId) {
        if (t.dependsOn && t.dependsOn !== 'none') {
          return { ...t, offset: (Number(t.offset) || 0) + deltaDays };
        } else {
          const curStart = t.manualStart ? toDate(t.manualStart) : toDate(currentProject.j0);
          return { ...t, manualStart: formatDateToISO(addDays(curStart, deltaDays)) };
        }
      }
      // Counteract the shift for immediate children so they remain at their exact current dates!
      if (t.dependsOn === taskId) {
        return { ...t, offset: (Number(t.offset) || 0) - deltaDays };
      }
      return t;
    });

    persistProject({ ...currentProject, tasks: updatedTasks });
  };

  const handleResizeTaskInCalendar = (taskId: string, newDuration: number, deltaDuration: number) => {
    if (!currentProject || deltaDuration === 0) return;

    const updatedTasks = currentProject.tasks.map((t) => {
      if (t.id === taskId) {
        return { ...t, duration: Math.max(1, newDuration) };
      }
      // Counteract duration change for immediate children so they don't shift
      if (t.dependsOn === taskId) {
        return { ...t, offset: (Number(t.offset) || 0) - deltaDuration };
      }
      return t;
    });

    persistProject({ ...currentProject, tasks: updatedTasks });
  };

  const handleDeleteTask = (taskId: string) => {
    if (!currentProject) return;
    // Remove task and clean up dependencies pointing to this task
    const updatedTasks = currentProject.tasks
      .filter((t) => t.id !== taskId)
      .map((t) => (t.dependsOn === taskId ? { ...t, dependsOn: null } : t));
    persistProject({ ...currentProject, tasks: updatedTasks });
  };

  // Reset tasks of current project to default template
  const handleResetCurrentProjectTasks = () => {
    if (!currentProject) return;
    if (
      confirm(
        `Rétablir les 8 tâches du modèle par défaut pour le projet "${currentProject.name}" ?`
      )
    ) {
      persistProject({
        ...currentProject,
        tasks: JSON.parse(JSON.stringify(DEFAULT_TASKS)),
      });
      setTimeout(() => handleAutoScale(), 100);
    }
  };

  // Zoom and Scaling
  const handleZoomIn = () => {
    setDayWidth((prev) => {
      if (isNaN(prev) || prev <= 0) return 30;
      return Math.min(150, prev < 6 ? Number((prev * 1.3).toFixed(2)) : prev + 5);
    });
  };

  const handleZoomOut = () => {
    setDayWidth((prev) => {
      if (isNaN(prev) || prev <= 0) return 30;
      return Math.max(0.05, prev <= 6 ? Number((prev * 0.75).toFixed(2)) : prev - 5);
    });
  };

  const handleAutoScale = useCallback(() => {
    if (!computedTasks || computedTasks.length === 0) return;

    const container =
      ganttChartScrollRef.current || document.getElementById('gantt-chart-wrapper');
    const containerWidth =
      container?.clientWidth ||
      (window.innerWidth - (isSidebarOpen ? 256 : 0) - taskTableWidth - 40);
    const availableWidth = Math.max(containerWidth - 40, 200);

    // Calcul de l'envergure réelle des tâches en jours
    const totalDays = Math.max(1, timelineParams.totalDays);

    // Réserve 160px de marge visuelle pour le nom de la dernière tâche
    const widthForTimeline = Math.max(availableWidth - 160, 100);
    const targetDayWidth = Math.max(0.5, Math.min(widthForTimeline / totalDays, 80));

    setDayWidth(Number(targetDayWidth.toFixed(2)));
    if (ganttChartScrollRef.current) {
      ganttChartScrollRef.current.scrollLeft = 0;
    }
  }, [computedTasks, timelineParams.totalDays, isSidebarOpen, taskTableWidth]);

  // Auto-scale UNIQUEMENT à l'ouverture ou sélection d'un projet
  useEffect(() => {
    if (currentProjectId) {
      const timer = setTimeout(() => {
        handleAutoScale();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [currentProjectId]);

  // Panel Resizer logic
  const handleStartResizePanel = (e: MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = taskTableWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(280, Math.min(startWidth + deltaX, 750));
      setTaskTableWidth(newWidth);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Export & Import JSON
  const handleExportJSON = () => {
    const payload = {
      currentProjectId,
      projects,
      exportedAt: new Date().toISOString(),
    };
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'projets_gantt_teletravan.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportJSON = async (importedProjects: Project[]) => {
    if (!importedProjects || importedProjects.length === 0) return;
    setProjects(importedProjects);
    setCurrentProjectId(importedProjects[0].id);

    // Save each imported project to Firestore
    if (user) {
      setSyncStatus('saving');
      for (const proj of importedProjects) {
        try {
          await setDoc(doc(db, 'users', user.uid, 'projects', proj.id), proj);
        } catch (e) {
          console.error('Error importing project to Firestore:', e);
        }
      }
      setSyncStatus('saved');
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#16304a] text-white">
      {/* Top Header */}
      <Header
        project={currentProject}
        onUpdateProjectName={handleUpdateProjectName}
        onUpdateProjectJ0={handleUpdateProjectJ0}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onAutoScale={handleAutoScale}
        user={user}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        syncStatus={syncStatus}
      />

      {/* Main Gantt Split Screen */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Sidebar */}
        <Sidebar
          isOpen={isSidebarOpen}
          projects={projects}
          currentProjectId={currentProjectId}
          onSelectProject={(id) => setCurrentProjectId(id)}
          onNewProject={() => setIsNewProjectModalOpen(true)}
          onDeleteProject={handleDeleteProject}
          onExportJSON={handleExportJSON}
          onImportJSON={handleImportJSON}
          onResetDefaultTasks={handleResetCurrentProjectTasks}
          syncStatus={syncStatus}
        />

        {/* Task Table Left Panel */}
        <TaskTable
          tasks={computedTasks}
          onAddTask={handleAddTask}
          onEditTask={(task) => setEditingTask(task)}
          onDeleteTask={handleDeleteTask}
          width={taskTableWidth}
          scrollRef={taskTableScrollRef}
          onScroll={handleTaskTableScroll}
        />

        {/* Draggable Divider */}
        <div
          onMouseDown={handleStartResizePanel}
          className="w-1.5 hover:w-2 bg-[#3a75a3] hover:bg-[#5bc0de] cursor-col-resize z-30 transition-all flex items-center justify-center shrink-0"
          title="Glisser pour redimensionner le tableau"
        />

        {/* Gantt Chart Right View */}
        <div id="gantt-chart-wrapper" className="flex-1 h-full overflow-hidden flex flex-col min-w-0">
          <GanttChart
            tasks={computedTasks}
            timelineParams={timelineParams}
            dayWidth={dayWidth}
            onMoveTaskInCalendar={handleMoveTaskInCalendar}
            onResizeTaskInCalendar={handleResizeTaskInCalendar}
            onUpdateTask={handleUpdateTask}
            onSelectTask={(task) => setEditingTask(task)}
            scrollRef={ganttChartScrollRef}
            onScroll={handleGanttChartScroll}
          />
        </div>
      </div>

      {/* Modals */}
      <NewProjectModal
        isOpen={isNewProjectModalOpen}
        onClose={() => setIsNewProjectModalOpen(false)}
        onSubmit={handleCreateProject}
      />

      <EditTaskModal
        task={editingTask}
        allTasks={currentProject?.tasks || []}
        isOpen={Boolean(editingTask)}
        onClose={() => setEditingTask(null)}
        onSave={handleSaveEditedTask}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        canClose={Boolean(user)}
      />
    </div>
  );
}

import { useState, useEffect, useRef, useCallback, FormEvent, useMemo } from "react";
import { CheckCircle2, Circle, ListTodo, PlusCircle, Trash2, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { TodoItem, TodoListProps } from "@/types/ui.types";
import { ScrollArea } from "./scroll-area";

// // Custom hook for managing todos
// const useTodos = () => {
//   const [todos, setTodos] = useState<TodoItem[]>([]);
//   const [isAddingTask, setIsAddingTask] = useState(false);
//   const [newTaskText, setNewTaskText] = useState('');
//   const [isLoading, setIsLoading] = useState(true);
//   const newTaskInputRef = useRef<HTMLInputElement>(null);

//   useEffect(() => {
//     // Load todos from localStorage
//     const savedTodos = localStorage.getItem('learningTodos');
//     if (savedTodos) {
//       setTodos(JSON.parse(savedTodos));
//     }
//     setIsLoading(false);
//   }, []);

//   useEffect(() => {
//     // Save todos to localStorage whenever todos change
//     if (!isLoading) {
//       localStorage.setItem('learningTodos', JSON.stringify(todos));
//     }
//   }, [todos, isLoading]);

//   const addNewTask = (e: React.FormEvent) => {
//     e.preventDefault();
//     if (!newTaskText.trim()) return;

//     const newTodo: TodoItem = {
//       id: Date.now().toString(),
//       text: newTaskText.trim(),
//       completed: false,
//       createdAt: new Date().toISOString()
//     };

//     setTodos(prev => [newTodo, ...prev]);
//     setNewTaskText('');
//     setIsAddingTask(false);
//   };

//   const toggleTodo = (id: string) => {
//     setTodos(prev => prev.map(todo =>
//       todo.id === id ? { ...todo, completed: !todo.completed } : todo
//     ));
//   };

//   const deleteTask = (id: string) => {
//     setTodos(prev => prev.filter(todo => todo.id !== id));
//   };

//   const sortedTasks = [...todos].sort((a, b) => {
//     if (a.completed !== b.completed) {
//       return a.completed ? 1 : -1;
//     }
//     return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
//   });

//   return {
//     todos,
//     setTodos,
//     isAddingTask,
//     setIsAddingTask,
//     newTaskText,
//     setNewTaskText,
//     newTaskInputRef,
//     isLoading,
//     addNewTask,
//     toggleTodo,
//     deleteTask,
//     sortedTasks
//   };
// };

export interface Todo {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
  completedAt: string | null;
}

const STORAGE_KEY = "todo_tasks_v1";

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export function useTodoManager() {
  const [todos, setTodos] = useState<Todo[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [newTaskText, setNewTaskText] = useState("");
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [filter, setFilter] = useState<"all" | "active" | "completed">("active");
  const newTaskInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
    } catch (err) {
      console.error("Failed to save todos:", err);
    }
  }, [todos]);

  // --- Add Task ---
  const addNewTask = useCallback((e: FormEvent) => {
    e.preventDefault();
    const text = newTaskText.trim();
    if (!text) return;

    setTodos((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        text,
        completed: false,
        createdAt: new Date().toISOString(),
        completedAt: null,
      },
    ]);


    setNewTaskText("");
    setIsAddingTask(false);

    // focus back to input
    newTaskInputRef.current?.focus();
  }, [newTaskText]);

  // --- Toggle ---
  const toggleTodo = useCallback((id: string) => {
    setTodos((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;

        const willComplete = !t.completed;

        return {
          ...t,
          completed: willComplete,
          completedAt: willComplete ? new Date().toISOString() : null,
        };
      })
    );
  }, []);

  // --- Delete ---
  const deleteTask = useCallback((id: string) => {
    setTodos(prev => prev.filter(t => t.id !== id));
  }, []);

  // --- Clear completed ---
  const clearCompleted = useCallback(() => {
    setTodos(prev => prev.filter(t => !t.completed));
  }, []);

  // --- Filtering ---
  const filteredTodos = useMemo(() => {
    if (filter === "active") return todos.filter(t => !t.completed);
    if (filter === "completed") return todos.filter(t => t.completed);
    return todos;
  }, [todos, filter]);

  const activeCount = useMemo(
    () => todos.filter(t => !t.completed).length,
    [todos]
  );

  const completedCount = useMemo(
    () => todos.filter(t => t.completed).length,
    [todos]
  );

  return {
    todos,
    setTodos,
    newTaskText,
    setNewTaskText,
    isAddingTask,
    setIsAddingTask,
    newTaskInputRef,
    addNewTask,
    toggleTodo,
    deleteTask,
    clearCompleted,
    filter,
    setFilter,
    filteredTodos,
    activeCount,
    completedCount,
  };
}


export const TodoList = ({ className }: TodoListProps) => {
  const tm = useTodoManager();

  return (
    // <Card className={`border border-sidebar-border dark:bg-[#58442775] overflow-hidden ${className || ''}`}>
    //   <CardHeader className="pb-2">
    //     <CardTitle className="text-sm font-bold">To-Do List </CardTitle>
    //     <CardDescription>
    //       {todoManager.todos.filter(t => !t.completed).length} tasks remaining
    //     </CardDescription>
    //   </CardHeader>

    //   <CardContent>
    //     {todoManager.isLoading ? (
    //       <div className="flex justify-center py-4">
    //         <div className="animate-spin h-6 w-6 border-2 border-primary rounded-full border-t-transparent"></div>
    //       </div>
    //     ) : (
    //       <div className="space-y-3">
    //         {todoManager.sortedTasks.map(todo => (
    //           <div key={todo.id}
    //             className={`flex items-start gap-2 group ${todo.completed ? 'opacity-60' : ''}`}
    //           >
    //             <Button
    //               variant="ghost"
    //               size="icon"
    //               className="h-5 w-5 rounded-full p-0 mt-0.5"
    //               onClick={() => todoManager.toggleTodo(todo.id)}
    //             >
    //               {todo.completed ?
    //                 <CheckCircle2 className="h-5 w-5 text-primary" /> :
    //                 <Circle className="h-5 w-5" />}
    //             </Button>
    //             <span className={`flex-1 text-sm ${todo.completed ? 'line-through' : ''}`}>{todo.text}</span>
    //             <Button
    //               variant="ghost"
    //               size="icon"
    //               className="h-5 w-5 rounded-full p-0 opacity-0 group-hover:opacity-100 transition-opacity"
    //               onClick={() => todoManager.deleteTask(todo.id)}
    //             >
    //               <X className="h-3 w-3" />
    //               <span className="sr-only">Delete task</span>
    //             </Button>
    //           </div>
    //         ))}

    //         {todoManager.isAddingTask ? (
    //           <form onSubmit={todoManager.addNewTask} className="flex items-center gap-2 pt-1">
    //             <Circle className="h-5 w-5 ml-0.5 text-muted-foreground" />
    //             <Input
    //               ref={todoManager.newTaskInputRef}
    //               type="text"
    //               value={todoManager.newTaskText}
    //               onChange={(e) => todoManager.setNewTaskText(e.target.value)}
    //               placeholder="What needs to be done?"
    //               className="h-7 py-1 text-sm border-0 border-b focus-visible:ring-0 rounded-none px-0"
    //               autoFocus
    //               onBlur={() => {
    //                 if (!todoManager.newTaskText.trim()) todoManager.setIsAddingTask(false);
    //               }}
    //             />
    //           </form>
    //         ) : (
    //           <Button
    //             variant="ghost"
    //             size="sm"
    //             className="w-full mt-2 text-muted-foreground hover:text-foreground"
    //             onClick={() => todoManager.setIsAddingTask(true)}
    //           >
    //             <PlusCircle className="mr-2 h-4 w-4" />
    //             Add new task
    //           </Button>
    //         )}
    //       </div>
    //     )}
    //   </CardContent>

    //   <CardFooter>
    //     {todoManager.todos.length > 0 && (
    //       <div className="w-full flex justify-between text-xs text-muted-foreground">
    //         <span>{todoManager.todos.filter(t => !t.completed).length} remaining</span>
    //         {todoManager.todos.some(t => t.completed) && (
    //           <Button
    //             variant="link"
    //             size="sm"
    //             className="h-auto p-0 text-xs"
    //             onClick={() => todoManager.setTodos(todoManager.todos.filter(t => !t.completed))}
    //           >
    //             Clear completed
    //           </Button>
    //         )}
    //       </div>
    //     )}
    //   </CardFooter>
    // </Card>
    <div className="min-h-screen bg-background text-foreground rounded flex flex-col items-center px-2 py-16">
      <div className="w-full max-w-xl sm:max-w-2xl">
        <div className="mb-10 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <ListTodo className="h-7 w-7 text-primary" />
            <h1 className="text-2xl font-semibold tracking-tight">Learning Checklist</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Add and track your personal learning tasks to stay focused
          </p>
        </div>

        <form onSubmit={tm.addNewTask} className="mb-8">
          <div className="rounded-xl border border-border bg-card p-4 sm:p-6 shadow-sm">
            <Input
              ref={tm.newTaskInputRef}
              value={tm.newTaskText}
              onChange={(e) => tm.setNewTaskText(e.target.value)}
              placeholder="What needs to be done?"
              className="h-12 sm:h-14 text-base sm:text-lg px-4 placeholder:text-sm placeholder:text-muted-foreground/70"
            />


            <Button
              type="submit"
              disabled={!tm.newTaskText.trim()}
              className="mt-3 h-11 w-full"
            >
              <PlusCircle className="h-4 w-4 mr-2" />
              Add Task
            </Button>
          </div>
        </form>

        {/* Filters (non-congested, scrollable on small screens) */}
        <div className="mb-5">
          <div className="flex gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {(["active", "completed"] as const).map((f) => (
              <Button
                key={f}
                variant={tm.filter === f ? "default" : "outline"}
                size="sm"
                onClick={() => tm.setFilter(f)}
                className="capitalize h-9 shrink-0"
              >
                {f}
                {f === "active" && ` (${tm.activeCount})`}
                {f === "completed" && ` (${tm.completedCount})`}
              </Button>
            ))}
          </div>
        </div>

        {/* Task list */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/30">
            <p className="text-sm font-medium">
              {tm.filter === "all" && "All tasks"}
              {tm.filter === "active" && "Active tasks"}
              {tm.filter === "completed" && "Completed tasks"}
            </p>
          </div>

          {tm.filteredTodos.length === 0 ? (
            <div className="py-14 text-center text-muted-foreground">
              {tm.todos.length === 0
                ? "No tasks yet. Add one above!"
                : "No tasks match this filter."}
            </div>
          ) : (
            <ScrollArea className="h-[280px]">
              <div className="divide-y divide-border">
                {tm.filteredTodos.map((todo) => (
                  <div
                    key={todo.id}
                    className={`flex items-center gap-3 px-4 py-3 group ${todo.completed ? "opacity-60" : ""
                      }`}
                  >
                    <button
                      type="button"
                      onClick={() => tm.toggleTodo(todo.id)}
                      className="shrink-0 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30"
                      aria-label={todo.completed ? "Mark as active" : "Mark as completed"}
                    >
                      {todo.completed ? (
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />
                      )}
                    </button>

                    <div className="flex flex-col flex-1">
                      <span
                        className={`text-sm sm:text-[15px] ${todo.completed ? "line-through text-muted-foreground" : ""
                          }`}
                      >
                        {todo.text}
                      </span>

                      <span className="text-xs text-muted-foreground mt-0.5">
                        Created: {formatDateTime(todo.createdAt)}
                        {todo.completedAt ? ` • Completed: ${formatDateTime(todo.completedAt)}` : ""}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => tm.deleteTask(todo.id)}
                      className="shrink-0 rounded-md p-1.5
    opacity-100 sm:opacity-0 sm:group-hover:opacity-100
    transition-all
    text-red-500 hover:text-red-600 hover:bg-red-500/10
    focus:outline-none focus:ring-2 focus:ring-red-500/30"
                      aria-label="Delete task"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>

                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>


        {/* Footer */}
        {tm.completedCount > 0 && (
          <div className="flex justify-end mt-4">
            {tm.filter === "completed" && <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={tm.clearCompleted}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Clear completed ({tm.completedCount})
            </Button>
            }
          </div>
        )}
      </div>
    </div>

  );
};

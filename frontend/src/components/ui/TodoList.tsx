import { useState, useEffect, useRef } from "react";
import { CheckCircle2, Circle, PlusCircle, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Todo interface
interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
}

// Custom hook for managing todos
const useTodos = () => {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const newTaskInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Load todos from localStorage
    const savedTodos = localStorage.getItem('learningTodos');
    if (savedTodos) {
      setTodos(JSON.parse(savedTodos));
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    // Save todos to localStorage whenever todos change
    if (!isLoading) {
      localStorage.setItem('learningTodos', JSON.stringify(todos));
    }
  }, [todos, isLoading]);

  const addNewTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;

    const newTodo: TodoItem = {
      id: Date.now().toString(),
      text: newTaskText.trim(),
      completed: false,
      createdAt: new Date().toISOString()
    };

    setTodos(prev => [newTodo, ...prev]);
    setNewTaskText('');
    setIsAddingTask(false);
  };

  const toggleTodo = (id: string) => {
    setTodos(prev => prev.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };

  const deleteTask = (id: string) => {
    setTodos(prev => prev.filter(todo => todo.id !== id));
  };

  const sortedTasks = [...todos].sort((a, b) => {
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return {
    todos,
    setTodos,
    isAddingTask,
    setIsAddingTask,
    newTaskText,
    setNewTaskText,
    newTaskInputRef,
    isLoading,
    addNewTask,
    toggleTodo,
    deleteTask,
    sortedTasks
  };
};

interface TodoListProps {
  className?: string;
}

export const TodoList = ({ className }: TodoListProps) => {
  const todoManager = useTodos();

  return (
    <Card className={`border border-sidebar-border bg-secondary/50 overflow-hidden ${className || ''}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">To-Do List</CardTitle>
        <CardDescription>
          {todoManager.todos.filter(t => !t.completed).length} tasks remaining
        </CardDescription>
      </CardHeader>

      <CardContent>
        {todoManager.isLoading ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin h-6 w-6 border-2 border-primary rounded-full border-t-transparent"></div>
          </div>
        ) : (
          <div className="space-y-3">
            {todoManager.sortedTasks.map(todo => (
              <div key={todo.id}
                className={`flex items-start gap-2 group ${todo.completed ? 'opacity-60' : ''}`}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 rounded-full p-0 mt-0.5"
                  onClick={() => todoManager.toggleTodo(todo.id)}
                >
                  {todo.completed ?
                    <CheckCircle2 className="h-5 w-5 text-primary" /> :
                    <Circle className="h-5 w-5" />}
                </Button>
                <span className={`flex-1 text-sm ${todo.completed ? 'line-through' : ''}`}>{todo.text}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 rounded-full p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => todoManager.deleteTask(todo.id)}
                >
                  <X className="h-3 w-3" />
                  <span className="sr-only">Delete task</span>
                </Button>
              </div>
            ))}

            {todoManager.isAddingTask ? (
              <form onSubmit={todoManager.addNewTask} className="flex items-center gap-2 pt-1">
                <Circle className="h-5 w-5 ml-0.5 text-muted-foreground" />
                <Input
                  ref={todoManager.newTaskInputRef}
                  type="text"
                  value={todoManager.newTaskText}
                  onChange={(e) => todoManager.setNewTaskText(e.target.value)}
                  placeholder="What needs to be done?"
                  className="h-7 py-1 text-sm border-0 border-b focus-visible:ring-0 rounded-none px-0"
                  autoFocus
                  onBlur={() => {
                    if (!todoManager.newTaskText.trim()) todoManager.setIsAddingTask(false);
                  }}
                />
              </form>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2 text-muted-foreground hover:text-foreground"
                onClick={() => todoManager.setIsAddingTask(true)}
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Add new task
              </Button>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter>
        {todoManager.todos.length > 0 && (
          <div className="w-full flex justify-between text-xs text-muted-foreground">
            <span>{todoManager.todos.filter(t => !t.completed).length} remaining</span>
            {todoManager.todos.some(t => t.completed) && (
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs"
                onClick={() => todoManager.setTodos(todoManager.todos.filter(t => !t.completed))}
              >
                Clear completed
              </Button>
            )}
          </div>
        )}
      </CardFooter>
    </Card>
  );
};

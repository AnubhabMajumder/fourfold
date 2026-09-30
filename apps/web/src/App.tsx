import { TaskList } from './components/TaskList.tsx';

export function App() {
  return (
    <div className="app">
      <header className="header">
        <h1>Fourfold</h1>
      </header>
      <div className="body">
        <TaskList />
      </div>
    </div>
  );
}

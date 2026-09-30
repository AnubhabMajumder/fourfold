import { Header } from './components/Header.tsx';
import { Matrix } from './components/Matrix.tsx';
import { TaskList } from './components/TaskList.tsx';
import { useStore } from './store.ts';

export function App() {
  // The app always opens on today; moving between dates comes with ‹ ›.
  const [{ date }] = useStore();
  return (
    <div className="app">
      <Header date={date} />
      <div className="body">
        <TaskList />
        <Matrix />
      </div>
    </div>
  );
}

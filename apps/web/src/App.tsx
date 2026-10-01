import { DragProvider } from './drag/drag.tsx';
import { Header } from './components/Header.tsx';
import { Matrix } from './components/Matrix.tsx';
import { NotRunning } from './components/NotRunning.tsx';
import { TaskList } from './components/TaskList.tsx';
import { useStore } from './store.ts';

export function App() {
  // The app always opens on today; moving between dates comes with ‹ ›.
  const [{ date, unreachable }] = useStore();
  return (
    <DragProvider>
      <div className="app" inert={unreachable}>
        <Header date={date} />
        <div className="body">
          <TaskList />
          <Matrix />
        </div>
      </div>
      {unreachable && <NotRunning />}
    </DragProvider>
  );
}

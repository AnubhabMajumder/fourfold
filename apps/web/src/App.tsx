import { localDate } from '@fourfold/core';
import { Header } from './components/Header.tsx';
import { Matrix } from './components/Matrix.tsx';
import { TaskList } from './components/TaskList.tsx';

export function App() {
  // The app always opens on today; moving between dates comes with ‹ ›.
  const date = localDate(new Date());
  return (
    <div className="app">
      <Header date={date} />
      <div className="body">
        <TaskList />
        <Matrix date={date} />
      </div>
    </div>
  );
}

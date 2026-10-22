import { Home } from './components/Home';
import { Session } from './components/Session';
import { AuthorEasterEgg } from './components/AuthorEasterEgg';
export function App() {
  const match = location.pathname.match(/^\/s\/([A-Z2-9]{8})\/?$/i);
  return (
    <>
      {match ? <Session code={match[1].toUpperCase()} /> : <Home />}
      <AuthorEasterEgg />
    </>
  );
}

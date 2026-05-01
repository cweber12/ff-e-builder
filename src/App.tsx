import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { CatalogView } from './components/CatalogView';
import { catalogProjectFixture, catalogRoomsFixture } from './data/catalogFixture';

function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <main className="flex min-h-screen items-center justify-center bg-surface-muted">
            <div className="flex flex-col items-center gap-4 text-center">
              <h1 className="text-4xl font-bold text-brand-500">FF&amp;E Builder</h1>
              <Link
                to="/projects/demo-project/catalog"
                className="rounded-md border border-brand-500 bg-white px-4 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50"
              >
                Open catalog
              </Link>
            </div>
          </main>
        }
      />
      <Route
        path="/projects/:id/catalog"
        element={<CatalogView project={catalogProjectFixture} rooms={catalogRoomsFixture} />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;

/** 404 page. Sends users somewhere useful instead of a dead end. */
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center px-4 py-24 text-center">
      <p className="text-5xl font-bold text-primary">404</p>
      <h1 className="mt-4 text-xl font-semibold text-foreground">Page not found</h1>
      <p className="mt-2 text-muted-foreground">That route doesn't exist in Zenith.</p>
      <div className="mt-6 flex gap-3">
        <Button asChild variant="outline">
          <Link to="/">Home</Link>
        </Button>
        <Button asChild>
          <Link to="/app">Go to app</Link>
        </Button>
      </div>
    </div>
  );
}

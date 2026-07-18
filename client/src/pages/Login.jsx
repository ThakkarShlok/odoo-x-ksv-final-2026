/**
 * Login page. react-hook-form for local validation UX; the SERVER is the real validator — a
 * failed login surfaces the server's generic "Invalid email or password" (no user enumeration).
 * Supports two quick-fill paths so the demo is one click:
 *   - navigation state from the landing "Use" buttons ({ email, password })
 *   - inline demo-credential buttons here
 * Also reads ?expired=1 (set by the axios 401 interceptor) to explain an auto-logout.
 */
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext.jsx';
import { getErrorMessage } from '@/api/axios.js';
import { DEMO_CREDENTIALS } from '@/lib/demo-credentials.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Where to go after login: back where they were headed (set by ProtectedRoute), else /app.
  const redirectTo = location.state?.from?.pathname ?? '/app';

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    // Prefill from the landing "Use" button if present.
    defaultValues: {
      email: location.state?.email ?? '',
      password: location.state?.password ?? '',
    },
  });

  useEffect(() => {
    if (searchParams.get('expired')) {
      toast('Your session expired. Please log in again.', { icon: '🔒' });
    }
  }, [searchParams]);

  async function onSubmit(values) {
    try {
      const user = await login(values);
      toast.success(`Welcome back, ${user.name}.`);
      navigate(redirectTo, { replace: true });
    } catch (error) {
      // Server message is intentionally generic; we relay it verbatim.
      toast.error(getErrorMessage(error, 'Login failed.'));
    }
  }

  function fillDemo(cred) {
    setValue('email', cred.email);
    setValue('password', cred.password);
  }

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>Log in</CardTitle>
          <CardDescription>Welcome back to Zenith ERP.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                aria-invalid={Boolean(errors.email)}
                {...register('email', { required: 'Email is required.' })}
              />
              {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                aria-invalid={Boolean(errors.password)}
                {...register('password', { required: 'Password is required.' })}
              />
              {errors.password ? (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              ) : null}
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in…' : 'Log in'}
            </Button>
          </form>

          <div className="mt-6">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Demo accounts
            </p>
            <div className="flex flex-wrap gap-2">
              {DEMO_CREDENTIALS.map((c) => (
                <Button key={c.email} type="button" variant="outline" size="sm" onClick={() => fillDemo(c)}>
                  {c.label}
                </Button>
              ))}
            </div>
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            No account?{' '}
            <Link to="/register" className="font-medium text-primary hover:underline">
              Sign up
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

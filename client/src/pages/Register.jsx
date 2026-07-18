/**
 * Register page. The frontend password rule (min 8) MIRRORS the backend rule — it is a UX
 * convenience, not the security boundary. The backend re-checks every field (see
 * auth.validators.js); a request via curl that skips this form still gets validated server-side.
 * That mirroring is the explicit fix for last round's frontend-only check.
 * New accounts are always EMPLOYEE — there is no role selector, by design.
 */
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext.jsx';
import { getErrorMessage, getFieldErrors } from '@/api/axios.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

const PASSWORD_MIN = 8; // must match server/src/modules/auth/auth.validators.js

export default function Register() {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { name: '', email: '', password: '' } });

  async function onSubmit(values) {
    try {
      const user = await registerUser(values);
      toast.success(`Account created. Welcome, ${user.name}.`);
      navigate('/app', { replace: true });
    } catch (error) {
      // Map server field errors ([{field,message}]) back onto the form inputs so the message
      // appears under the offending field, not just as a toast.
      const fieldErrors = getFieldErrors(error);
      if (fieldErrors.length) {
        fieldErrors.forEach((fe) => setError(fe.field, { message: fe.message }));
      } else {
        toast.error(getErrorMessage(error, 'Registration failed.'));
      }
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>Create your account</CardTitle>
          <CardDescription>You'll start with an Employee role.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                autoComplete="name"
                aria-invalid={Boolean(errors.name)}
                {...register('name', { required: 'Name is required.' })}
              />
              {errors.name ? <p className="text-xs text-destructive">{errors.name.message}</p> : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                aria-invalid={Boolean(errors.email)}
                {...register('email', {
                  required: 'Email is required.',
                  pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email.' },
                })}
              />
              {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                aria-invalid={Boolean(errors.password)}
                {...register('password', {
                  required: 'Password is required.',
                  minLength: { value: PASSWORD_MIN, message: `At least ${PASSWORD_MIN} characters.` },
                })}
              />
              {errors.password ? (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              ) : (
                <p className="text-xs text-muted-foreground">Minimum {PASSWORD_MIN} characters.</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Creating…' : 'Create account'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

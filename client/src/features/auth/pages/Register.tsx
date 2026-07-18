import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage, getFieldErrors } from '@/api/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

const PASSWORD_MIN = 8;

export default function Register() {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { name: '', email: '', password: '' } });

  async function onSubmit(values: any) {
    try {
      const user = await registerUser(values);
      toast.success(`Account created. Welcome, ${user.name}.`);
      navigate('/app', { replace: true });
    } catch (error) {
      const fieldErrors = getFieldErrors(error);
      if (fieldErrors.length) {
        fieldErrors.forEach((fe: { field: string; message: string }) => {
          setError(fe.field as any, { message: fe.message });
        });
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

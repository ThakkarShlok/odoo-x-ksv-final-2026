import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useAuth } from '@/features/auth/context/AuthContext';
import api, { getErrorMessage } from '@/api/axios';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { UserCircle } from 'lucide-react';
import { useEffect } from 'react';

export default function Profile() {
  const { user } = useAuth();
  const { register, handleSubmit, reset, formState: { errors, isSubmitting, isDirty } } = useForm();

  // Load user data on mount
  useEffect(() => {
    async function load() {
      try {
        const res = await api.get('/users/profile');
        const p = res.data.data;
        reset({
          fullName: p.fullName || '',
          phoneNumber: p.phoneNumber || '',
          address: p.address || '',
        });
      } catch (err) {
        toast.error('Failed to load profile');
      }
    }
    load();
  }, [reset]);

  async function onSubmit(values) {
    try {
      await api.patch('/users/profile', values);
      // Let AuthContext catch up on next load, or we just toast
      toast.success('Profile updated successfully.');
      reset(values); // reset isDirty
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update profile'));
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Profile</h1>
        <p className="text-sm text-muted-foreground">Manage your account and contact information.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <div className="h-16 w-16 rounded-full overflow-hidden border-2 border-primary/20 bg-muted shrink-0">
            <img 
              src={`https://api.dicebear.com/7.x/initials/svg?seed=${user?.email || 'User'}&backgroundColor=0f172a&textColor=ffffff`} 
              alt="Avatar" 
              className="h-full w-full object-cover"
            />
          </div>
          <div>
            <CardTitle className="text-xl">Account Details</CardTitle>
            <CardDescription>Update your personal info and billing address.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Email Address</Label>
              <Input type="email" value={user?.email || ''} disabled className="bg-muted" />
              <p className="text-[10px] text-muted-foreground">Email address cannot be changed.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                {...register('fullName', { required: 'Name is required' })}
              />
              {errors.fullName && <p className="text-xs text-destructive">{errors.fullName.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <Input
                id="phoneNumber"
                type="tel"
                {...register('phoneNumber', { required: 'Phone is required' })}
              />
              {errors.phoneNumber && <p className="text-xs text-destructive">{errors.phoneNumber.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="address">Billing Address</Label>
              <Input
                id="address"
                {...register('address', { required: 'Address is required' })}
              />
              {errors.address && <p className="text-xs text-destructive">{errors.address.message}</p>}
            </div>

            <div className="pt-2">
              <Button type="submit" disabled={!isDirty || isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

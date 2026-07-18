import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import api, { getErrorMessage } from '@/api/axios';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loading } from '@/components/common/Loading';
import { User, Phone, MapPin, Mail, Award } from 'lucide-react';

export default function Profile() {
  const [loading, setLoading] = useState(true);
  const { register, handleSubmit, reset, formState: { isSubmitting, errors } } = useForm();

  useEffect(() => {
    api.get('/users/profile')
      .then(res => {
        const user = res.data.data.user;
        reset({
          fullName: user.fullName || '',
          phoneNumber: user.phoneNumber || '',
          address: user.address || '',
          email: user.email || '',
          role: user.role || ''
        });
      })
      .catch(err => {
        toast.error(getErrorMessage(err, 'Failed to load profile.'));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [reset]);

  const onSubmit = async (data) => {
    try {
      const res = await api.patch('/users/profile', {
        fullName: data.fullName,
        phoneNumber: data.phoneNumber,
        address: data.address
      });
      toast.success('Profile updated successfully.');
      reset(res.data.data.user);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update profile.'));
    }
  };

  if (loading) {
    return <Loading label="Loading profile data..." />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profile Settings</h1>
        <p className="text-muted-foreground">Manage your account information and default shipping addresses.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account Details</CardTitle>
          <CardDescription>View and update your personal details.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="fullName" className="flex items-center gap-1.5">
                  <User className="size-4 text-muted-foreground" /> Full Name
                </Label>
                <Input
                  id="fullName"
                  {...register('fullName', { required: 'Name is required' })}
                  aria-invalid={Boolean(errors.fullName)}
                />
                {errors.fullName && <p className="text-xs text-destructive">{errors.fullName.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="phoneNumber" className="flex items-center gap-1.5">
                  <Phone className="size-4 text-muted-foreground" /> Phone Number
                </Label>
                <Input
                  id="phoneNumber"
                  {...register('phoneNumber', { required: 'Phone is required' })}
                  aria-invalid={Boolean(errors.phoneNumber)}
                />
                {errors.phoneNumber && <p className="text-xs text-destructive">{errors.phoneNumber.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="flex items-center gap-1.5">
                  <Mail className="size-4 text-muted-foreground" /> Email Address
                </Label>
                <Input
                  id="email"
                  disabled
                  className="bg-muted text-muted-foreground cursor-not-allowed"
                  {...register('email')}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="role" className="flex items-center gap-1.5">
                  <Award className="size-4 text-muted-foreground" /> Account Clearance Role
                </Label>
                <Input
                  id="role"
                  disabled
                  className="bg-muted text-muted-foreground cursor-not-allowed font-semibold uppercase tracking-wider"
                  {...register('role')}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="address" className="flex items-center gap-1.5">
                <MapPin className="size-4 text-muted-foreground" /> Default Shipping Address
              </Label>
              <textarea
                id="address"
                rows={3}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                {...register('address', { required: 'Default address is required' })}
                aria-invalid={Boolean(errors.address)}
              />
              {errors.address && <p className="text-xs text-destructive">{errors.address.message}</p>}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

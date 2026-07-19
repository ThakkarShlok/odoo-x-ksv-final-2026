import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useApi } from '@/hooks/useApi';
import api from '@/api/axios';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Settings, Shield, Clock, AlertTriangle } from 'lucide-react';

export default function RentalSettings() {
  const { data: settings, loading, refetch } = useApi('/settings');
  
  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting, isDirty } } = useForm({
    defaultValues: {
      depositRuleType: 'PERCENTAGE',
      depositValue: '20',
      gracePeriodHours: '0',
      lateFeeRuleType: 'PER_DAY_FLAT',
      lateFeeValue: '500',
      maxLateFeeCap: '5000',
    }
  });

  const depositType = watch('depositRuleType');
  const lateFeeType = watch('lateFeeRuleType');

  useEffect(() => {
    if (settings) {
      reset({
        depositRuleType: settings.depositRuleType || 'PERCENTAGE',
        depositValue: settings.depositValue || '20',
        gracePeriodHours: settings.gracePeriodHours?.toString() || '0',
        lateFeeRuleType: settings.lateFeeRuleType || 'PER_DAY_FLAT',
        lateFeeValue: settings.lateFeeValue || '500',
        maxLateFeeCap: settings.maxLateFeeCap || '5000',
      });
    }
  }, [settings, reset]);

  async function onSubmit(values) {
    try {
      await api.put('/settings', values);
      toast.success('Rental settings saved successfully');
      refetch();
    } catch (err) {
      toast.error('Failed to save settings: ' + (err.response?.data?.message || err.message));
    }
  }

  if (loading) return <div className="p-8">Loading settings...</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Rental Settings</h1>
        <p className="text-sm text-muted-foreground">Configure global policies for deposits, returns, and penalties.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        
        {/* Deposit Policy */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" /> Security Deposit Policy
            </CardTitle>
            <CardDescription>Rules applied at checkout to secure against damage or loss.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Rule Type</Label>
                <select 
                  {...register('depositRuleType')} 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="PERCENTAGE">Percentage of Base Cost</option>
                  <option value="FLAT">Flat Amount</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>{depositType === 'PERCENTAGE' ? 'Percentage (%)' : 'Amount ($)'}</Label>
                <Input
                  type="number"
                  step="0.01"
                  {...register('depositValue', { required: 'This field is required', min: 0 })}
                />
                {errors.depositValue && <p className="text-xs text-destructive">{errors.depositValue.message}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Grace Period */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" /> Return Grace Period
            </CardTitle>
            <CardDescription>Time allowed after the rental end date before late fees trigger.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5 max-w-[200px]">
              <Label>Grace Period (Hours)</Label>
              <Input
                type="number"
                {...register('gracePeriodHours', { required: 'Required', min: 0 })}
              />
              {errors.gracePeriodHours && <p className="text-xs text-destructive">{errors.gracePeriodHours.message}</p>}
            </div>
          </CardContent>
        </Card>

        {/* Late Fee Policy */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" /> Late Return Penalties
            </CardTitle>
            <CardDescription>Configure how penalties are calculated for overdue returns.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Penalty Rule</Label>
                <select 
                  {...register('lateFeeRuleType')}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="PER_DAY_FLAT">Flat Fee Per Day Late</option>
                  <option value="PER_DAY_PERCENTAGE">Percentage Per Day Late</option>
                  <option value="FLAT">One-time Flat Penalty</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>{lateFeeType.includes('PERCENTAGE') ? 'Percentage (%)' : 'Amount ($)'}</Label>
                <Input
                  type="number"
                  step="0.01"
                  {...register('lateFeeValue', { required: 'Required', min: 0 })}
                />
                {errors.lateFeeValue && <p className="text-xs text-destructive">{errors.lateFeeValue.message}</p>}
              </div>
            </div>

            <div className="space-y-1.5 max-w-[200px] pt-2 border-t border-border">
              <Label>Maximum Penalty Cap ($)</Label>
              <Input
                type="number"
                step="0.01"
                {...register('maxLateFeeCap', { required: 'Required', min: 0 })}
              />
              <p className="text-[10px] text-muted-foreground">Maximum amount that can be charged.</p>
              {errors.maxLateFeeCap && <p className="text-xs text-destructive">{errors.maxLateFeeCap.message}</p>}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={!isDirty || isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </form>
    </div>
  );
}

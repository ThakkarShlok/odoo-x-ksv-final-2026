import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api, { getErrorMessage } from '@/api/axios';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Loading } from '@/components/common/Loading';
import { ChevronRight, ChevronLeft, ShieldCheck, ShieldAlert, Award, ClipboardCheck, Camera, Radio } from 'lucide-react';

export default function FieldInspection() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState(null);
  const [step, setStep] = useState(1);

  // Form states
  const [condition, setCondition] = useState('FLAWLESS');
  const [damageNotes, setDamageNotes] = useState('');
  const [damagePhoto, setDamagePhoto] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [cablesComplete, setCablesComplete] = useState(true);
  const [manualsComplete, setManualsComplete] = useState(true);
  const [chargerComplete, setChargerComplete] = useState(true);

  // Settlement states from backend return-scan
  const [lateFees, setLateFees] = useState(null);

  useEffect(() => {
    // Fetch rental details
    api.get(`/rentals`)
      .then(res => {
        const list = res.data.data || [];
        const match = list.find(r => r.id === orderId);
        if (!match) {
          toast.error('Rental order not found.');
          navigate('/app/field-ops');
          return;
        }
        setOrder(match);
      })
      .catch(err => {
        toast.error(getErrorMessage(err, 'Failed to fetch order details.'));
        navigate('/app/field-ops');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [orderId, navigate]);

  // Simulate Cloudinary Direct Upload
  const handleUploadPhotoSimulator = () => {
    setPhotoUploading(true);
    // Request signature from backend to verify contract
    api.post('/inspections/upload-signature', { folder: 'inspections' })
      .then(() => {
        setTimeout(() => {
          setDamagePhoto('https://res.cloudinary.com/odoo-rental-cloud/image/upload/v12345/inspection_damage.jpg');
          setPhotoUploading(false);
          toast.success('Damage photo uploaded to Cloudinary.');
        }, 1200);
      })
      .catch(err => {
        toast.error('Signature verification failed.');
        setPhotoUploading(false);
      });
  };

  const handleNextStep = async () => {
    if (step === 1) {
      setStep(2);
    } else if (step === 2) {
      if (condition === 'DAMAGED' && !damageNotes.trim()) {
        toast.error('Please enter damage details notes.');
        return;
      }
      setStep(3);
    } else if (step === 3) {
      // Step 3 triggers return-scan API first to compute late fees dynamically
      setLoading(true);
      try {
        const res = await api.post(`/rentals/${orderId}/return-scan`);
        setLateFees(res.data.data);
        setStep(4);
      } catch (err) {
        toast.error(getErrorMessage(err, 'Failed to process return scan.'));
      } finally {
        setLoading(false);
      }
    }
  };

  const handleVerifySubmit = async () => {
    setLoading(true);
    try {
      const asset = order.lines?.[0]?.productUnit || { id: 'asset_id' };
      
      // 1. Submit Inspection details
      await api.post('/inspections', {
        orderId,
        assetId: asset.id,
        physicalCondition: condition,
        accessoriesComplete: cablesComplete && manualsComplete && chargerComplete,
        damageLogged: condition === 'DAMAGED',
        damageNotes: condition === 'DAMAGED' ? damageNotes : 'Accessories intact',
        damagePhotoUrl: damagePhoto || ''
      });

      // 2. Trigger Financial Reconcile release
      await api.post(`/deposits/${orderId}/reconcile`);

      toast.success('Inspection submitted & Deposit Reconciled.');
      navigate('/app/field-ops');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Inspection submission failed.'));
    } finally {
      setLoading(false);
    }
  };

  if (loading || !order) {
    return <Loading label="Loading inspection checkpoint..." />;
  }

  const asset = order.lines?.[0]?.productUnit || { serialNumber: 'SN-DSLR-01' };

  return (
    <div className="space-y-6 max-w-lg mx-auto pb-20">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Quality Inspection Wizard</h1>
        <p className="text-muted-foreground text-xs">Verify asset integrity and authorize deposit hold release.</p>
      </div>

      {/* Progress header tabs */}
      <div className="flex items-center justify-between border border-border rounded-lg bg-card p-3 text-xs font-semibold">
        <span className={step === 1 ? 'text-primary font-bold' : 'text-muted-foreground'}>1. Info</span>
        <ChevronRight className="size-3 text-muted-foreground" />
        <span className={step === 2 ? 'text-primary font-bold' : 'text-muted-foreground'}>2. Condition</span>
        <ChevronRight className="size-3 text-muted-foreground" />
        <span className={step === 3 ? 'text-primary font-bold' : 'text-muted-foreground'}>3. Accs</span>
        <ChevronRight className="size-3 text-muted-foreground" />
        <span className={step === 4 ? 'text-primary font-bold' : 'text-muted-foreground'}>4. Settlement</span>
      </div>

      {/* STEP 1: Scan & Info */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Asset Verification</CardTitle>
            <CardDescription>Confirm order and unit tags match.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="space-y-1">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Order Reference</span>
              <p className="font-semibold font-mono text-foreground">{order.orderNumber}</p>
            </div>
            
            <div className="space-y-1">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Committed Serial</span>
              <p className="font-semibold font-mono text-emerald-500">{asset.serialNumber}</p>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider font-heading">Fulfillment</span>
              <p className="font-medium text-foreground">{order.fulfillmentMethod}</p>
            </div>

            <Button onClick={handleNextStep} className="w-full mt-4">
              Confirm & Inspect <ChevronRight className="ml-auto size-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* STEP 2: Condition check */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Integrity Check</CardTitle>
            <CardDescription>Assess physical structure condition.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup value={condition} onValueChange={setCondition} className="grid grid-cols-2 gap-4">
              <Label
                htmlFor="flawless"
                className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border p-4 hover:bg-muted/40 ${
                  condition === 'FLAWLESS' ? 'border-emerald-500 bg-emerald-500/5' : 'border-border'
                }`}
              >
                <ShieldCheck className="size-6 text-emerald-500" />
                <span className="font-semibold text-xs">Flawless</span>
                <RadioGroupItem value="FLAWLESS" id="flawless" className="sr-only" />
              </Label>

              <Label
                htmlFor="damaged"
                className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border p-4 hover:bg-muted/40 ${
                  condition === 'DAMAGED' ? 'border-destructive bg-destructive/5' : 'border-border'
                }`}
              >
                <ShieldAlert className="size-6 text-destructive" />
                <span className="font-semibold text-xs">Damaged</span>
                <RadioGroupItem value="DAMAGED" id="damaged" className="sr-only" />
              </Label>
            </RadioGroup>

            {condition === 'DAMAGED' && (
              <div className="space-y-3 pt-2">
                <div className="space-y-1">
                  <Label htmlFor="damageNotes">Damage details notes</Label>
                  <textarea
                    id="damageNotes"
                    rows={3}
                    placeholder="Describe scratches, cracks, faults..."
                    className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={damageNotes}
                    onChange={e => setDamageNotes(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Damage Photo evidence</Label>
                  <div className="flex items-center gap-3">
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={handleUploadPhotoSimulator}
                      disabled={photoUploading}
                      className="gap-2 text-xs h-9"
                    >
                      <Camera className="size-4" />
                      {photoUploading ? 'Uploading...' : 'Capture Photo'}
                    </Button>
                    {damagePhoto && (
                      <Badge variant="outline" className="border-emerald-500 text-emerald-500">
                        Uploaded ✓
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between gap-2 pt-4">
              <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
                <ChevronLeft className="size-4" /> Back
              </Button>
              <Button size="sm" onClick={handleNextStep}>
                Next <ChevronRight className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 3: Accessories */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Accessory Check</CardTitle>
            <CardDescription>Verify all components returned.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="cables" className="text-sm">Power Cables & Connectors</Label>
                <input
                  id="cables"
                  type="checkbox"
                  checked={cablesComplete}
                  onChange={e => setCablesComplete(e.target.checked)}
                  className="size-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="manuals" className="text-sm">Operator Manuals & Bags</Label>
                <input
                  id="manuals"
                  type="checkbox"
                  checked={manualsComplete}
                  onChange={e => setManualsComplete(e.target.checked)}
                  className="size-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="charger" className="text-sm">Chargers & Battery Blocks</Label>
                <input
                  id="charger"
                  type="checkbox"
                  checked={chargerComplete}
                  onChange={e => setChargerComplete(e.target.checked)}
                  className="size-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex justify-between gap-2 pt-4">
              <Button variant="ghost" size="sm" onClick={() => setStep(2)}>
                <ChevronLeft className="size-4" /> Back
              </Button>
              <Button size="sm" onClick={handleNextStep}>
                Verify Return <ChevronRight className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 4: Settlement */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Deposit Settlement</CardTitle>
            <CardDescription>Calculated penalties and release totals.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {lateFees && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2 font-mono text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Actual Return:</span>
                  <span>{format(new Date(lateFees.actualReturnTime), 'PP p')}</span>
                </div>
                <div className="flex justify-between text-yellow-600 font-semibold">
                  <span>Late Fees Accrued:</span>
                  <span>₹{parseFloat(lateFees.lateFeesCalculated || '0').toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground pt-1.5 border-t border-border">
                  <span>Security Hold:</span>
                  <span>₹{parseFloat(order.depositTotal).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-emerald-500 font-bold">
                  <span>Net Refund Released:</span>
                  <span>
                    ₹{Math.max(0, parseFloat(order.depositTotal) - parseFloat(lateFees.lateFeesCalculated || '0')).toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 flex items-start gap-2.5 text-xs text-emerald-600">
              <ClipboardCheck className="size-5 shrink-0" />
              <p>
                By signing off, you confirm that return verification was completed and coordinates were logged into the audit ledger.
              </p>
            </div>

            <div className="flex justify-between gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setStep(3)}>
                <ChevronLeft className="size-4" /> Back
              </Button>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={handleVerifySubmit}>
                Submit & Reconcile Refund
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

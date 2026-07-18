import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api, { getErrorMessage } from '@/api/axios';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Loading } from '@/components/common/Loading';
import { Plus, Settings, ShieldAlert, Barcode, Wrench } from 'lucide-react';

export default function Inventory() {
  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState([]);
  const [categories, setCategories] = useState([]);
  
  // Create Category States
  const [catName, setCatName] = useState('');
  const [depositMethod, setDepositMethod] = useState('PERCENTAGE');
  const [depositValue, setDepositValue] = useState(20);
  const [baseHourly, setBaseHourly] = useState(100);
  const [baseDaily, setBaseDaily] = useState(500);
  const [openCatModal, setOpenCatModal] = useState(false);

  // Add Asset States
  const [assetBarcode, setAssetBarcode] = useState('');
  const [assetBrand, setAssetBrand] = useState('');
  const [assetCatId, setAssetCatId] = useState('');
  const [openAssetModal, setOpenAssetModal] = useState(false);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.get('/inventory?limit=100'),
      api.get('/products')
    ]).then(([assetsRes, catRes]) => {
      setAssets(assetsRes.data.data || []);
      setCategories(catRes.data.data || []);
    }).catch(err => {
      toast.error(getErrorMessage(err, 'Failed to fetch inventory files.'));
    }).finally(() => {
      setLoading(false);
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!catName.trim()) return;

    setLoading(true);
    try {
      await api.post('/products', {
        name: catName.trim(),
        depositMethod,
        depositValue: parseFloat(depositValue),
        baseHourlyRate: parseFloat(baseHourly),
        baseDailyRate: parseFloat(baseDaily)
      });
      toast.success('Category created successfully.');
      setOpenCatModal(false);
      loadData();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to create category.'));
      setLoading(false);
    }
  };

  const handleAddAsset = async (e) => {
    e.preventDefault();
    if (!assetBarcode.trim() || !assetBrand.trim() || !assetCatId) return;

    setLoading(true);
    try {
      await api.post('/inventory', {
        barcode: assetBarcode.trim(),
        brand: assetBrand.trim(),
        categoryId: assetCatId,
        status: 'AVAILABLE'
      });
      toast.success('Asset unit added to fleet.');
      setOpenAssetModal(false);
      loadData();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to add asset unit.'));
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const s = status.toUpperCase();
    switch (s) {
      case 'AVAILABLE':
        return <Badge variant="outline" className="border-emerald-500 text-emerald-500 bg-emerald-500/10">Available</Badge>;
      case 'RENTED':
      case 'RESERVED':
        return <Badge variant="outline" className="border-accent-500 text-accent-500 bg-accent-500/10">Rented</Badge>;
      case 'MAINTENANCE':
        return <Badge variant="outline" className="border-warning-500 text-warning-500 bg-warning-500/10">Maintenance</Badge>;
      case 'DAMAGED':
        return <Badge variant="destructive">Damaged</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return <Loading label="Syncing database fleet records..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fleet Directory</h1>
          <p className="text-muted-foreground text-xs">Manage catalog categories and physical asset tracking units.</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Create Category Modal */}
          <Dialog open={openCatModal} onOpenChange={setOpenCatModal}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                <Plus className="size-4" /> Category
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Setup Rental Category</DialogTitle>
                <DialogDescription>Create a rentable item specification and its deposit hold rules.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateCategory} className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="catName">Category Name</Label>
                  <Input id="catName" placeholder="e.g. DSLR Camera Kit" value={catName} onChange={e => setCatName(e.target.value)} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="depMethod">Deposit Method</Label>
                    <select
                      id="depMethod"
                      className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
                      value={depositMethod}
                      onChange={e => setDepositMethod(e.target.value)}
                    >
                      <option value="PERCENTAGE">Percentage (%)</option>
                      <option value="FIXED">Flat (₹)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="depVal">Deposit Value</Label>
                    <Input id="depVal" type="number" value={depositValue} onChange={e => setDepositValue(e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="baseHourly">Hourly Rate (₹)</Label>
                    <Input id="baseHourly" type="number" value={baseHourly} onChange={e => setBaseHourly(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="baseDaily">Daily Rate (₹)</Label>
                    <Input id="baseDaily" type="number" value={baseDaily} onChange={e => setBaseDaily(e.target.value)} />
                  </div>
                </div>

                <Button type="submit" className="w-full">Create Category</Button>
              </form>
            </DialogContent>
          </Dialog>

          {/* Add Asset Modal */}
          <Dialog open={openAssetModal} onOpenChange={setOpenAssetModal}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1 bg-emerald-600 hover:bg-emerald-700">
                <Plus className="size-4" /> Add Asset unit
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Provision Physical Fleet Unit</DialogTitle>
                <DialogDescription>Register a specific barcode and brand tag to compile physical telemetry.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddAsset} className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="barcode">Asset Barcode / Serial</Label>
                  <div className="relative">
                    <Barcode className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="barcode" placeholder="e.g. SN-DSLR-01" className="pl-9" value={assetBarcode} onChange={e => setAssetBarcode(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="brand">Brand</Label>
                  <Input id="brand" placeholder="e.g. Canon, Bosch" value={assetBrand} onChange={e => setAssetBrand(e.target.value)} />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="catId">Catalog Category Type</Label>
                  <select
                    id="catId"
                    className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
                    value={assetCatId}
                    onChange={e => setAssetCatId(e.target.value)}
                  >
                    <option value="">Select Category</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <Button type="submit" className="w-full">Provision Unit</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Directory Table */}
      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base">Asset Directory</CardTitle>
          <CardDescription>Directory of all physical objects in stock.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                  <th className="p-4">Serial / Barcode</th>
                  <th className="p-4">Brand</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Run Hours</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {assets.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      No assets found in database. Create categories and provision units.
                    </td>
                  </tr>
                ) : (
                  assets.map(asset => (
                    <tr key={asset.id} className="hover:bg-muted/30">
                      <td className="p-4 font-mono font-semibold">{asset.barcode}</td>
                      <td className="p-4">{asset.brand}</td>
                      <td className="p-4">{asset.product?.name || 'Unassigned'}</td>
                      <td className="p-4 font-mono">{parseFloat(asset.totalHoursRun || '0').toFixed(1)} hrs</td>
                      <td className="p-4">{getStatusBadge(asset.status)}</td>
                      <td className="p-4 text-right">
                        <Button variant="ghost" size="sm">
                          <Wrench className="size-4 text-muted-foreground" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

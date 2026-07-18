/**
 * Admin product create / edit. react-hook-form with validation mirroring the backend rules (name +
 * category required, rates non-negative, serials required). On CREATE we POST the product (with
 * optional rates + initial unit serials) then redirect to this same page in EDIT mode, where the
 * image manager and unit manager become available (both need a product id to attach to). Image
 * upload shows a live preview; the primary image is the catalogue thumbnail.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Upload, Star, Trash2, Plus, ImageOff } from 'lucide-react';
import {
  fetchAdminProduct, fetchAdminCategories, createProduct, updateProduct,
  createCategory, uploadProductImage, setPrimaryImage, deleteProductImage,
  createUnit, deleteUnit,
} from '../api/catalog';
import { getErrorMessage, getFieldErrors } from '@/api/axios';
import { assetUrl } from '@/lib/assets';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loading } from '@/components/common/Loading';
import { ErrorState } from '@/components/common/ErrorState';

const RATE_FIELDS = [['DAILY', 'Daily'], ['WEEKLY', 'Weekly'], ['HOURLY', 'Hourly'], ['MONTHLY', 'Monthly']];

function Field({ label, error, children, required }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}{required ? <span className="text-destructive"> *</span> : null}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

export default function AdminProductForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { name: '', categoryId: '', description: '', brand: '', manufacturer: '', color: '', size: '', sku: '', isRentable: true, rates: {}, serials: '' },
  });

  const [categories, setCategories] = useState([]);
  const [loadState, setLoadState] = useState({ status: isEdit ? 'loading' : 'ready', error: null });
  const [product, setProduct] = useState(null); // edit mode: full detail (images, units)
  const [newCat, setNewCat] = useState('');
  const [addingCat, setAddingCat] = useState(false);
  const [imgBusy, setImgBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const [newSerial, setNewSerial] = useState('');
  const fileRef = useRef(null);

  const loadCategories = useCallback(() => fetchAdminCategories().then(setCategories).catch(() => {}), []);

  const loadProduct = useCallback(async () => {
    if (!isEdit) return;
    setLoadState({ status: 'loading', error: null });
    try {
      const p = await fetchAdminProduct(id);
      setProduct(p);
      reset({
        name: p.name, categoryId: p.categoryId, description: p.description ?? '', brand: p.brand ?? '',
        manufacturer: p.manufacturer ?? '', color: p.color ?? '', size: p.size ?? '', sku: p.sku ?? '',
        isRentable: p.isRentable, rates: p.rates ?? {}, serials: '',
      });
      setLoadState({ status: 'ready', error: null });
    } catch (error) {
      setLoadState({ status: 'error', error: getErrorMessage(error) });
    }
  }, [id, isEdit, reset]);

  useEffect(() => { loadCategories(); }, [loadCategories]);
  useEffect(() => { loadProduct(); }, [loadProduct]);

  // Map any backend field errors (422) onto the form fields.
  function applyFieldErrors(error) {
    for (const fe of getFieldErrors(error)) {
      setError(fe.field, { type: 'server', message: fe.message });
    }
  }

  function buildBody(values) {
    const rates = {};
    for (const [k] of RATE_FIELDS) {
      const v = values.rates?.[k];
      if (v !== '' && v != null) rates[k] = Number(v);
    }
    const body = {
      name: values.name.trim(),
      categoryId: values.categoryId,
      description: values.description?.trim() || null,
      brand: values.brand?.trim() || null,
      manufacturer: values.manufacturer?.trim() || null,
      color: values.color?.trim() || null,
      size: values.size?.trim() || null,
      sku: values.sku?.trim() || null,
      isRentable: Boolean(values.isRentable),
      rates,
    };
    return body;
  }

  async function onSubmit(values) {
    try {
      if (isEdit) {
        await updateProduct(id, buildBody(values));
        toast.success('Product saved.');
        loadProduct();
      } else {
        const body = buildBody(values);
        const serials = (values.serials || '').split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
        if (serials.length) body.units = serials.map((serialNumber) => ({ serialNumber }));
        const created = await createProduct(body);
        toast.success('Product created. Add images below.');
        navigate(`/app/products/${created.id}/edit`, { replace: true });
      }
    } catch (error) {
      applyFieldErrors(error);
      toast.error(getErrorMessage(error, 'Could not save product.'));
    }
  }

  async function onAddCategory() {
    if (!newCat.trim()) return;
    setAddingCat(true);
    try {
      const cat = await createCategory({ name: newCat.trim() });
      toast.success('Category added.');
      setNewCat('');
      await loadCategories();
      // select the just-created category
      reset((prev) => ({ ...prev, categoryId: cat.id }));
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setAddingCat(false);
    }
  }

  function onPickFile(e) {
    const file = e.target.files?.[0];
    if (!file) return setPreview(null);
    setPreview({ url: URL.createObjectURL(file), name: file.name, file });
  }

  async function onUpload() {
    if (!preview?.file) return;
    setImgBusy(true);
    try {
      await uploadProductImage(id, preview.file);
      toast.success('Image uploaded.');
      setPreview(null);
      if (fileRef.current) fileRef.current.value = '';
      loadProduct();
    } catch (error) {
      toast.error(getErrorMessage(error)); // 422 for bad type/size
    } finally {
      setImgBusy(false);
    }
  }

  async function onSetPrimary(imageId) {
    try { await setPrimaryImage(id, imageId); loadProduct(); } catch (error) { toast.error(getErrorMessage(error)); }
  }
  async function onDeleteImage(imageId) {
    try { await deleteProductImage(id, imageId); loadProduct(); } catch (error) { toast.error(getErrorMessage(error)); }
  }
  async function onAddUnit() {
    if (!newSerial.trim()) return;
    try {
      await createUnit(id, { serialNumber: newSerial.trim() });
      toast.success('Unit added.');
      setNewSerial('');
      loadProduct();
    } catch (error) { toast.error(getErrorMessage(error)); } // 409 duplicate serial
  }
  async function onDeleteUnit(unitId) {
    try { await deleteUnit(unitId); loadProduct(); } catch (error) { toast.error(getErrorMessage(error)); }
  }

  if (loadState.status === 'loading') return <Loading label="Loading product…" />;
  if (loadState.status === 'error') return <ErrorState message={loadState.error} onRetry={loadProduct} />;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2"><Link to="/app/products"><ArrowLeft className="h-4 w-4" /> Back to products</Link></Button>
      <h1 className="text-2xl font-bold tracking-tight">{isEdit ? 'Edit product' : 'New product'}</h1>

      {/* Details form */}
      <Card>
        <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Field label="Name" required error={errors.name?.message}>
              <Input {...register('name', { required: 'Name is required.', maxLength: { value: 200, message: 'Too long.' } })} placeholder="e.g. 4K Projector" />
            </Field>

            <Field label="Category" required error={errors.categoryId?.message}>
              <select {...register('categoryId', { required: 'Category is required.' })} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                <option value="">Select a category…</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <div className="mt-1 flex gap-2">
                <Input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="…or add a new category" className="h-8 text-sm" />
                <Button type="button" size="sm" variant="outline" onClick={onAddCategory} disabled={addingCat || !newCat.trim()}>Add</Button>
              </div>
            </Field>

            <Field label="Description" error={errors.description?.message}>
              <textarea {...register('description')} rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="What is it, what's included…" />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Brand"><Input {...register('brand')} /></Field>
              <Field label="Manufacturer"><Input {...register('manufacturer')} /></Field>
              <Field label="Colour"><Input {...register('color')} /></Field>
              <Field label="Size"><Input {...register('size')} /></Field>
              <Field label="SKU" error={errors.sku?.message}><Input {...register('sku')} placeholder="Optional, unique" /></Field>
              <Field label="Rentable">
                <label className="flex h-9 items-center gap-2 text-sm"><input type="checkbox" {...register('isRentable')} className="h-4 w-4" /> Listed for rent</label>
              </Field>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Rates (₹)</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {RATE_FIELDS.map(([key, label]) => (
                  <Field key={key} label={label} error={errors.rates?.[key]?.message}>
                    <Input type="number" min="0" step="0.01" placeholder="—" {...register(`rates.${key}`, { min: { value: 0, message: '≥ 0' } })} />
                  </Field>
                ))}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Leave blank to skip a duration. Rates are saved to the default pricelist.</p>
            </div>

            {!isEdit ? (
              <Field label="Initial units (serial numbers)" error={errors.serials?.message}>
                <textarea {...register('serials')} rows={2} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="One per line or comma-separated, e.g. SN-PROJ-01, SN-PROJ-02" />
                <p className="text-xs text-muted-foreground">Optional. You can also add units after creating.</p>
              </Field>
            ) : null}

            <div className="flex gap-2">
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create product'}</Button>
              <Button asChild type="button" variant="outline"><Link to="/app/products">Cancel</Link></Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Image + unit managers — edit mode only (need a product id to attach to) */}
      {isEdit && product ? (
        <>
          <Card>
            <CardHeader><CardTitle className="text-base">Images</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {product.images.length ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {product.images.map((img) => (
                    <div key={img.id} className={`group relative overflow-hidden rounded-lg border ${img.isPrimary ? 'border-primary ring-1 ring-primary' : 'border-border'}`}>
                      <img src={assetUrl(img.url)} alt="" className="aspect-[3/2] w-full object-cover" />
                      {img.isPrimary ? <span className="absolute left-1.5 top-1.5 rounded bg-primary px-1.5 py-0.5 text-[0.65rem] font-medium text-primary-foreground">Primary</span> : null}
                      <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/60 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                        {!img.isPrimary ? <button onClick={() => onSetPrimary(img.id)} title="Make primary" className="rounded bg-white/90 p-1 text-foreground hover:bg-white"><Star className="h-3.5 w-3.5" /></button> : null}
                        <button onClick={() => onDeleteImage(img.id)} title="Delete" className="rounded bg-white/90 p-1 text-destructive hover:bg-white"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground"><ImageOff className="h-4 w-4" /> No images yet.</div>
              )}

              <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
                {preview ? <img src={preview.url} alt="preview" className="h-16 w-24 rounded border border-border object-cover" /> : null}
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={onPickFile} className="text-sm" aria-label="Choose image" />
                <Button type="button" size="sm" onClick={onUpload} disabled={!preview || imgBusy}><Upload className="h-4 w-4" /> {imgBusy ? 'Uploading…' : 'Upload'}</Button>
                <span className="text-xs text-muted-foreground">JPEG/PNG/WebP/GIF, max 5 MB.</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Units ({product.units.length})</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {product.units.length ? (
                <ul className="divide-y divide-border text-sm">
                  {product.units.map((u) => (
                    <li key={u.id} className="flex items-center justify-between py-2">
                      <span className="font-mono text-xs">{u.serialNumber}</span>
                      <span className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">{u.status}</span>
                        <button onClick={() => onDeleteUnit(u.id)} title="Delete unit" className="text-destructive hover:opacity-70"><Trash2 className="h-4 w-4" /></button>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted-foreground">No units. Add at least one to make this product rentable.</p>}
              <div className="flex gap-2">
                <Input value={newSerial} onChange={(e) => setNewSerial(e.target.value)} placeholder="New serial number, e.g. SN-PROJ-03" className="h-9" />
                <Button type="button" size="sm" variant="outline" onClick={onAddUnit} disabled={!newSerial.trim()}><Plus className="h-4 w-4" /> Add unit</Button>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}

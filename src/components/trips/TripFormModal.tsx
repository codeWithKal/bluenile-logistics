import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, ArrowRight, Route, CheckCircle2, ShieldCheck, DollarSign } from 'lucide-react';
import { Trip, Truck, ConstructionCompany, Project, Location, SandType, TripStatus, RouteTariff } from '../../types';
import { api } from '../../lib/api';

interface TripFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTripSaved: () => void;
  tripToEdit?: Trip | null;
  trucks: Truck[];
  companies: ConstructionCompany[];
  locations: Location[];
}

export const TripFormModal: React.FC<TripFormModalProps> = ({
  isOpen,
  onClose,
  onTripSaved,
  tripToEdit,
  trucks,
  companies,
  locations,
}) => {
  const isEditing = Boolean(tripToEdit);

  // Form State
  const [tripDate, setTripDate] = useState('');
  const [truckId, setTruckId] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [loadingLocationId, setLoadingLocationId] = useState('');
  const [loadingDatetime, setLoadingDatetime] = useState('');
  const [sandType, setSandType] = useState<SandType>('00');
  const [quantityLoadedM3, setQuantityLoadedM3] = useState('');
  const [loadingNotes, setLoadingNotes] = useState('');
  const [unloadingLocationId, setUnloadingLocationId] = useState('');
  const [unloadingDatetime, setUnloadingDatetime] = useState('');
  const [quantityDeliveredM3, setQuantityDeliveredM3] = useState('');
  const [deliveryOutcome, setDeliveryOutcome] = useState('Delivered');
  const [deliveryProofRef, setDeliveryProofRef] = useState('');
  const [unloadingNotes, setUnloadingNotes] = useState('');
  const [status, setStatus] = useState<TripStatus>('Delivered');
  const [statusReason, setStatusReason] = useState('');

  // Fixed Route Transport Fee State (Auto-Determined by Route Corridor)
  const [transportRateEtbPerM3, setTransportRateEtbPerM3] = useState<string>('450');
  const [totalTransportFeeEtb, setTotalTransportFeeEtb] = useState<string>('0');
  const [activeRouteTariff, setActiveRouteTariff] = useState<RouteTariff | null>(null);
  const [isLookingUpTariff, setIsLookingUpTariff] = useState(false);
  const [allowManualTariffOverride, setAllowManualTariffOverride] = useState(false);

  // Warnings & Overrides
  const [projectsList, setProjectsList] = useState<Project[]>([]);
  const [capacityWarningPrompt, setCapacityWarningPrompt] = useState<string | null>(null);
  const [capacityWarningAcknowledged, setCapacityWarningAcknowledged] = useState(false);
  const [duplicateWarningPrompt, setDuplicateWarningPrompt] = useState<string | null>(null);
  const [allowDuplicate, setAllowDuplicate] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedTruck = trucks.find(t => t.id === truckId);

  // Crusher sites strictly serve as loading origins
  const crusherPlants = locations.filter(l => l.is_active && (l.location_type === 'Loading' || !l.location_type || l.location_type === 'Both'));

  useEffect(() => {
    if (tripToEdit) {
      setTripDate(tripToEdit.trip_date);
      setTruckId(tripToEdit.truck_id);
      setCompanyId(tripToEdit.company_id);
      setProjectId(tripToEdit.project_id || tripToEdit.unloading_location_id || '');
      setLoadingLocationId(tripToEdit.loading_location_id);
      setLoadingDatetime(tripToEdit.loading_datetime ? tripToEdit.loading_datetime.slice(0, 16) : '');
      setSandType(tripToEdit.sand_type);
      setQuantityLoadedM3(tripToEdit.quantity_loaded_m3.toString());
      setLoadingNotes(tripToEdit.loading_notes || '');
      setUnloadingLocationId(tripToEdit.unloading_location_id || tripToEdit.project_id || '');
      setUnloadingDatetime(tripToEdit.unloading_datetime ? tripToEdit.unloading_datetime.slice(0, 16) : '');
      setQuantityDeliveredM3(tripToEdit.quantity_delivered_m3.toString());
      setDeliveryOutcome(tripToEdit.delivery_outcome || 'Delivered');
      setDeliveryProofRef(tripToEdit.delivery_proof_ref || '');
      setUnloadingNotes(tripToEdit.unloading_notes || '');
      setStatus(tripToEdit.status);
      setStatusReason(tripToEdit.status_reason || '');
      setCapacityWarningAcknowledged(tripToEdit.capacity_warning_acknowledged === 1);
      setTransportRateEtbPerM3(tripToEdit.transport_rate_etb_per_m3 ? tripToEdit.transport_rate_etb_per_m3.toString() : '450');
      setTotalTransportFeeEtb(tripToEdit.total_transport_fee_etb ? tripToEdit.total_transport_fee_etb.toString() : '0');
      setAllowManualTariffOverride(false);
    } else {
      const today = new Date().toISOString().split('T')[0];
      setTripDate(today);
      const initialTruck = trucks.filter(t => t.is_active)[0];
      const initialTruckCap = initialTruck?.capacity_m3 ? initialTruck.capacity_m3.toFixed(2) : '20.00';
      setTruckId(initialTruck?.id || '');
      setCompanyId(companies.filter(c => c.is_active)[0]?.id || '');
      setProjectId('');
      setLoadingLocationId(crusherPlants[0]?.id || '');
      setLoadingDatetime('');
      setSandType('00');
      setQuantityLoadedM3(initialTruckCap);
      setLoadingNotes('');
      setUnloadingLocationId('');
      setUnloadingDatetime('');
      setQuantityDeliveredM3(initialTruckCap);
      setDeliveryOutcome('Delivered');
      setDeliveryProofRef('');
      setUnloadingNotes('');
      setStatus('Delivered');
      setStatusReason('');
      setCapacityWarningAcknowledged(false);
      setTransportRateEtbPerM3('8500');
      setTotalTransportFeeEtb('8500');
      setAllowManualTariffOverride(false);
    }
    setCapacityWarningPrompt(null);
    setDuplicateWarningPrompt(null);
    setAllowDuplicate(false);
    setFormError(null);
  }, [tripToEdit, isOpen]);

  // Load destination projects for the selected construction company (one company -> one or more projects)
  useEffect(() => {
    if (companyId) {
      api.getProjects(companyId).then((projs) => {
        setProjectsList(projs);
        if (!tripToEdit && projs.length > 0) {
          if (!projectId || !projs.some(p => p.id === projectId)) {
            setProjectId(projs[0].id);
            setUnloadingLocationId(projs[0].id);
          }
        }
      }).catch(() => setProjectsList([]));
    } else {
      setProjectsList([]);
    }
  }, [companyId]);

  useEffect(() => {
    if (projectId) {
      setUnloadingLocationId(projectId);
    }
  }, [projectId]);

  // Auto-fill quantity loaded and delivered to match truck capacity whenever truck changes
  const handleTruckSelect = (selectedId: string) => {
    setTruckId(selectedId);
    const trk = trucks.find(t => t.id === selectedId);
    if (trk && trk.capacity_m3 && trk.capacity_m3 > 0) {
      const capStr = trk.capacity_m3.toFixed(2);
      setQuantityLoadedM3(capStr);
      setQuantityDeliveredM3(capStr);
      setCapacityWarningAcknowledged(false);
      setCapacityWarningPrompt(null);
    }
  };

  // Auto-resolve Fixed Route Tariff when Crusher Site (Loading) or Destination (Unloading) changes
  useEffect(() => {
    if (!loadingLocationId || !unloadingLocationId) {
      setActiveRouteTariff(null);
      return;
    }
    setIsLookingUpTariff(true);
    api.lookupRouteTariff(loadingLocationId, unloadingLocationId)
      .then((res) => {
        if (res.tariff) {
          setActiveRouteTariff(res.tariff);
          const feePerTrip = res.tariff.fee_per_trip_etb || res.tariff.fixed_trip_fee_etb || (res.tariff.rate_per_m3_etb * 20) || 8500;
          if (!allowManualTariffOverride && !tripToEdit) {
            setTransportRateEtbPerM3(feePerTrip.toString());
            setTotalTransportFeeEtb(feePerTrip.toFixed(2));
          }
        }
      })
      .catch((err) => console.error('Route tariff lookup failed:', err))
      .finally(() => setIsLookingUpTariff(false));
  }, [loadingLocationId, unloadingLocationId]);

  // Fixed transport fee is PER TRIP (not per m3)
  useEffect(() => {
    const feePerTrip = parseFloat(transportRateEtbPerM3) || 8500;
    if (status === 'Cancelled') {
      setTotalTransportFeeEtb('0.00');
    } else {
      setTotalTransportFeeEtb(feePerTrip.toFixed(2));
    }
  }, [transportRateEtbPerM3, status]);

  const loadedNum = parseFloat(quantityLoadedM3) || 0;
  const deliveredNum = parseFloat(quantityDeliveredM3) || 0;
  const remainingQty = (loadedNum - deliveredNum).toFixed(2);
  const isOverDelivered = deliveredNum > loadedNum;
  const isPartial = deliveredNum > 0 && deliveredNum < loadedNum;

  const handleDeliveredChange = (val: string) => {
    setQuantityDeliveredM3(val);
    const dVal = parseFloat(val);
    if (!isNaN(dVal)) {
      if (dVal === loadedNum && loadedNum > 0) {
        setStatus('Delivered');
        setDeliveryOutcome('Delivered');
      } else if (dVal > 0 && dVal < loadedNum) {
        setStatus('Partially Delivered');
        setDeliveryOutcome('Partial Delivery');
      } else if (dVal === 0) {
        setStatus('Unsuccessful');
        setDeliveryOutcome('Rejected');
      }
    }
  };

  const handleLoadedChange = (val: string) => {
    setQuantityLoadedM3(val);
    const lVal = parseFloat(val);
    if (!tripToEdit && status === 'Delivered') {
      setQuantityDeliveredM3(val);
    }
    if (selectedTruck?.capacity_m3 && lVal > selectedTruck.capacity_m3) {
      setCapacityWarningPrompt(
        `Loaded quantity (${lVal} m³) exceeds truck registered capacity (${selectedTruck.capacity_m3} m³)`
      );
    } else {
      setCapacityWarningPrompt(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!tripDate || !truckId || !companyId || !loadingLocationId || !unloadingLocationId) {
      setFormError('Please fill in all required trip identification fields.');
      return;
    }
    if (loadedNum <= 0) {
      setFormError('Loaded quantity must be greater than zero.');
      return;
    }
    if (deliveredNum < 0) {
      setFormError('Delivered quantity cannot be negative.');
      return;
    }
    if (deliveredNum > loadedNum) {
      setFormError(`Delivered quantity (${deliveredNum} m³) cannot exceed loaded quantity (${loadedNum} m³).`);
      return;
    }
    if (['Unsuccessful', 'Partially Delivered', 'Cancelled'].includes(status) && !statusReason.trim()) {
      setFormError(`An explanation reason is strictly required when a trip is marked as ${status}.`);
      return;
    }
    if (selectedTruck?.capacity_m3 && loadedNum > selectedTruck.capacity_m3 && !capacityWarningAcknowledged) {
      setCapacityWarningPrompt(
        `Loaded quantity (${loadedNum} m³) exceeds truck ${selectedTruck.plate_number}'s rated capacity (${selectedTruck.capacity_m3} m³). You must acknowledge this before submitting.`
      );
      return;
    }

    if (!isEditing && !allowDuplicate) {
      try {
        const dupCheck = await api.checkDuplicateTrip({
          truck_id: truckId,
          trip_date: tripDate,
          loading_location_id: loadingLocationId,
          unloading_location_id: unloadingLocationId,
          sand_type: sandType,
        });
        if (dupCheck.duplicate) {
          setDuplicateWarningPrompt(dupCheck.message || 'Duplicate trip detected with matching truck, date, pit, destination, and sand type.');
          return;
        }
      } catch (err: any) {
        console.error('Duplicate check error:', err);
      }
    }

    setIsSubmitting(true);
    try {
      const payload = {
        trip_date: tripDate,
        truck_id: truckId,
        company_id: companyId,
        project_id: projectId || null,
        loading_location_id: loadingLocationId,
        loading_datetime: loadingDatetime || null,
        sand_type: sandType,
        quantity_loaded_m3: loadedNum,
        loading_notes: loadingNotes || null,
        unloading_location_id: unloadingLocationId,
        unloading_datetime: unloadingDatetime || null,
        quantity_delivered_m3: deliveredNum,
        delivery_outcome: deliveryOutcome,
        delivery_proof_ref: deliveryProofRef || null,
        unloading_notes: unloadingNotes || null,
        status,
        status_reason: statusReason || null,
        capacity_warning_acknowledged: capacityWarningAcknowledged ? 1 : 0,
        allow_duplicate: allowDuplicate,
        transport_rate_etb_per_m3: parseFloat(transportRateEtbPerM3) || 450,
        total_transport_fee_etb: parseFloat(totalTransportFeeEtb) || 0,
      };

      if (isEditing && tripToEdit) {
        await api.updateTrip(tripToEdit.id, payload);
      } else {
        await api.createTrip(payload);
      }
      onTripSaved();
      onClose();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save trip record');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
      <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div>
            <div className="text-xs font-mono text-slate-500 uppercase tracking-wider">
              {isEditing ? `Trip ${tripToEdit?.id}` : 'New Unified Delivery Record'}
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              {isEditing ? 'Update Truck Trip Record' : 'Register Sand Truck Trip'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-sm rounded flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {duplicateWarningPrompt && (
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-md text-slate-800 space-y-2">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-bold text-amber-900">Potential Duplicate Trip Detected</div>
                  <p className="text-xs text-amber-800 mt-0.5">{duplicateWarningPrompt}</p>
                </div>
              </div>
              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setAllowDuplicate(true);
                    setDuplicateWarningPrompt(null);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors cursor-pointer"
                >
                  Confirm Intentional Additional Trip
                </button>
                <button
                  type="button"
                  onClick={() => setDuplicateWarningPrompt(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Adjust Parameters
                </button>
              </div>
            </div>
          )}

          {/* Section 1: Trip Identification & Hired Fleet Dispatch */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-slate-200">
              <span className="text-xs font-bold text-slate-900 tracking-wider uppercase font-mono">
                1. Trip Identification &amp; Hired Fleet Dispatch
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                Single Unified Trip Record
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Trip Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={tripDate}
                  onChange={(e) => setTripDate(e.target.value)}
                  className="w-full text-xs font-mono px-3 py-2 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-amber-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Hired Truck Plate <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={truckId}
                  onChange={(e) => handleTruckSelect(e.target.value)}
                  className="w-full text-xs font-mono px-3 py-2 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:border-amber-500 focus:outline-hidden"
                >
                  <option value="">Select Truck</option>
                  {trucks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.plate_number} ({t.capacity_m3 ? `${t.capacity_m3} m³` : 'No Cap'})
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  External Truck Owner (Auto-populated from Registry)
                </label>
                <div className="w-full text-xs px-3 py-2 bg-slate-100 border border-slate-200 rounded text-slate-800 flex items-center justify-between">
                  <span className="font-medium truncate">
                    {selectedTruck ? selectedTruck.owner_name : 'Select truck to auto-populate owner'}
                  </span>
                  {selectedTruck?.capacity_m3 && (
                    <span className="text-[11px] font-mono text-slate-500 shrink-0">
                      Cap: {selectedTruck.capacity_m3} m³
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Loading Information at Crusher Site */}
          <div className="space-y-3 p-4 bg-amber-50/50 rounded-lg border border-amber-200/90">
            <div className="flex items-center justify-between pb-1 border-b border-amber-200/60">
              <span className="text-xs font-bold text-amber-950 tracking-wider uppercase font-mono">
                2. Sand Loading Point &amp; Specifications (Crusher Site Source)
              </span>
              <span className="text-[11px] font-semibold text-amber-900 bg-amber-200/60 px-2 py-0.5 rounded font-mono">
                Crusher Site Loading
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Loading Point (Crusher Plant) <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={loadingLocationId}
                  onChange={(e) => setLoadingLocationId(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded focus:border-amber-500 focus:outline-hidden"
                >
                  <option value="">Select Loading Point (Crusher Plant)</option>
                  {crusherPlants.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} {loc.address ? `(${loc.address})` : ''}
                    </option>
                  ))}
                </select>
                <div className="text-[10px] text-slate-500 mt-1">
                  Commercial crusher plant or quarry origin where materials are loaded
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Loading Date &amp; Time (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={loadingDatetime}
                  onChange={(e) => setLoadingDatetime(e.target.value)}
                  className="w-full text-xs font-mono px-3 py-2 bg-white border border-slate-300 rounded focus:border-amber-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Sand Type Category <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['00', '01', '02'] as SandType[]).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setSandType(st)}
                      className={`py-1.5 px-2 text-xs font-mono font-bold rounded border text-center transition-all cursor-pointer ${
                        sandType === st
                          ? 'bg-amber-500 border-amber-600 text-slate-950 shadow-xs ring-1 ring-amber-500'
                          : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
                <div className="text-[10px] text-slate-500 mt-1 font-mono">
                  {sandType === '00' && '00: Fine masonry / mortar sand'}
                  {sandType === '01' && '01: Medium washed concrete sand'}
                  {sandType === '02' && '02: Coarse road bedding aggregate'}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Quantity Loaded (m³) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={quantityLoadedM3}
                    onChange={(e) => handleLoadedChange(e.target.value)}
                    className="w-full text-xs font-mono font-semibold px-3 py-2 bg-white border border-slate-300 rounded pr-10 focus:border-amber-500 focus:outline-hidden tabular-nums"
                    placeholder="0.00"
                  />
                  <span className="absolute right-3 top-2 text-xs font-mono text-slate-500 pointer-events-none">
                    m³
                  </span>
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Crusher Loading Notes (Scale ticket #, hopper, moisture)
                </label>
                <input
                  type="text"
                  value={loadingNotes}
                  onChange={(e) => setLoadingNotes(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded focus:border-amber-500 focus:outline-hidden"
                  placeholder="e.g. Crusher scale certified, ticket #8841"
                />
              </div>
            </div>

            {capacityWarningPrompt && (
              <div className="p-3 bg-red-50 border border-red-300 rounded text-red-900 text-xs flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Truck Capacity Warning: </span>
                    {capacityWarningPrompt}
                  </div>
                </div>
                <label className="flex items-center gap-1.5 shrink-0 cursor-pointer font-semibold text-red-800">
                  <input
                    type="checkbox"
                    checked={capacityWarningAcknowledged}
                    onChange={(e) => setCapacityWarningAcknowledged(e.target.checked)}
                    className="rounded text-red-600 focus:ring-red-500"
                  />
                  <span>Authorize Overload</span>
                </label>
              </div>
            )}
          </div>

          {/* Section 3: Destination Project (Unloading Delivery Site) */}
          <div className="space-y-3 p-4 bg-blue-50/40 rounded-lg border border-blue-200/90">
            <div className="flex items-center justify-between pb-1 border-b border-blue-200/60">
              <span className="text-xs font-bold text-blue-950 tracking-wider uppercase font-mono">
                3. Destination Project (Unloading Delivery Site)
              </span>
              <span className="text-[11px] font-semibold text-blue-900 bg-blue-200/60 px-2 py-0.5 rounded font-mono">
                Destination Project Unloading
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-2 border-b border-blue-100">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Receiving Construction Client / Company <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={companyId}
                  onChange={(e) => {
                    const newCompId = e.target.value;
                    setCompanyId(newCompId);
                    setProjectId('');
                    setUnloadingLocationId('');
                  }}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded focus:border-blue-500 focus:outline-hidden"
                >
                  <option value="">Select Construction Company</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <div className="text-[10px] text-slate-500 mt-1">
                  Client commissioning the sand delivery
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Destination Project (Unloading Delivery Site) <span className="text-red-500">*</span></span>
                  {companyId && projectsList.length > 0 && (
                    <span className="text-[10px] text-blue-700 font-mono font-bold">
                      {projectsList.length} Project{projectsList.length > 1 ? 's' : ''} on file
                    </span>
                  )}
                </label>
                <select
                  required
                  value={projectId}
                  onChange={(e) => {
                    const pId = e.target.value;
                    setProjectId(pId);
                    setUnloadingLocationId(pId);
                  }}
                  disabled={!companyId || projectsList.length === 0}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded focus:border-blue-500 focus:outline-hidden disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <option value="">
                    {!companyId
                      ? 'Select Construction Client First'
                      : projectsList.length === 0
                      ? 'No Destination Projects registered for this Client'
                      : 'Select Destination Project'}
                  </option>
                  {projectsList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.address ? `— ${p.address}` : ''}
                    </option>
                  ))}
                </select>
                <div className="text-[10px] text-slate-500 mt-1">
                  Destination jobsite where materials loaded from crusher are unloaded
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Unloading Date &amp; Time (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={unloadingDatetime}
                  onChange={(e) => setUnloadingDatetime(e.target.value)}
                  className="w-full text-xs font-mono px-3 py-2 bg-white border border-slate-300 rounded focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Quantity Delivered (m³) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={quantityDeliveredM3}
                    onChange={(e) => handleDeliveredChange(e.target.value)}
                    className={`w-full text-xs font-mono font-semibold px-3 py-2 bg-white border rounded pr-10 focus:outline-hidden tabular-nums ${
                      isOverDelivered
                        ? 'border-red-500 bg-red-50 text-red-900'
                        : isPartial
                        ? 'border-amber-500 bg-amber-50 text-amber-900'
                        : 'border-slate-300 text-slate-900'
                    }`}
                    placeholder="0.00"
                  />
                  <span className="absolute right-3 top-2 text-xs font-mono text-slate-500 pointer-events-none">
                    m³
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Outstanding / Undelivered (m³)
                </label>
                <div className="w-full text-xs font-mono font-semibold px-3 py-2 bg-slate-100 border border-slate-200 rounded text-slate-800 flex items-center justify-between tabular-nums">
                  <span className={parseFloat(remainingQty) > 0 ? 'text-amber-700 font-bold' : ''}>
                    {remainingQty} m³
                  </span>
                  {parseFloat(remainingQty) > 0 ? (
                    <span className="text-[10px] text-amber-800 font-sans font-medium">Shortage</span>
                  ) : (
                    <span className="text-[10px] text-emerald-700 font-sans font-medium">Balanced</span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Delivery Outcome
                </label>
                <select
                  value={deliveryOutcome}
                  onChange={(e) => setDeliveryOutcome(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded focus:border-blue-500 focus:outline-hidden"
                >
                  <option value="Delivered">Delivered (Complete)</option>
                  <option value="Partial Delivery">Partial Delivery</option>
                  <option value="Rejected">Rejected at Site</option>
                  <option value="Access Blocked">Access Blocked / Weather</option>
                  <option value="Mechanical Breakdown">Mechanical Breakdown</option>
                  <option value="Measurement Discrepancy">Measurement Discrepancy</option>
                  <option value="Cancelled">Cancelled Before Pour</option>
                  <option value="Pending">Pending / En Route</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Proof of Delivery / Ticket Ref
                </label>
                <input
                  type="text"
                  value={deliveryProofRef}
                  onChange={(e) => setDeliveryProofRef(e.target.value)}
                  className="w-full text-xs font-mono px-3 py-2 bg-white border border-slate-300 rounded focus:border-blue-500 focus:outline-hidden"
                  placeholder="e.g. POD-88201 or Ticket #441"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Destination Project Unloading Notes (Supervisor signature, chute used, access details)
                </label>
                <input
                  type="text"
                  value={unloadingNotes}
                  onChange={(e) => setUnloadingNotes(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded focus:border-blue-500 focus:outline-hidden"
                  placeholder="e.g. Received at Foundation Trench Pier 4"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Fixed Route Transport Fee & Tariff (Auto-Calculated - No Manual Entry) */}
          <div className="space-y-3 p-4 bg-emerald-50/50 rounded-lg border border-emerald-200/90">
            <div className="flex items-center justify-between pb-1 border-b border-emerald-200/60">
              <div className="flex items-center gap-2">
                <Route className="w-4 h-4 text-emerald-700" />
                <span className="text-xs font-bold text-emerald-950 tracking-wider uppercase font-mono">
                  4. Fixed Route Transport Fee &amp; Tariff
                </span>
              </div>
              <span className="text-[11px] font-semibold text-emerald-900 bg-emerald-200/60 px-2 py-0.5 rounded font-mono flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                <span>Auto-Determined by Route</span>
              </span>
            </div>

            <div className="bg-white p-3.5 rounded border border-emerald-200/80 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-800">Haul Corridor:</span>
                  <span className="font-medium text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    {locations.find(l => l.id === loadingLocationId)?.name || 'Select Crusher'}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="font-medium text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {projectsList.find(p => p.id === projectId)?.name || locations.find(l => l.id === unloadingLocationId)?.name || 'Select Destination'}
                  </span>
                </div>
                {activeRouteTariff?.distance_km && (
                  <span className="font-mono text-slate-500 text-[11px] shrink-0">
                    Distance: {activeRouteTariff.distance_km} km
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-1">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Fixed Transport Fee (ETB / trip)
                    </label>
                    <button
                      type="button"
                      onClick={() => setAllowManualTariffOverride(!allowManualTariffOverride)}
                      className="text-[10px] text-amber-700 hover:text-amber-800 underline font-medium cursor-pointer"
                    >
                      {allowManualTariffOverride ? 'Re-lock Route Tariff' : 'Override Fee'}
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      disabled={!allowManualTariffOverride}
                      value={transportRateEtbPerM3}
                      onChange={(e) => setTransportRateEtbPerM3(e.target.value)}
                      className={`w-full text-xs font-mono font-bold px-3 py-2 border rounded pr-20 tabular-nums ${
                        allowManualTariffOverride
                          ? 'bg-amber-50 border-amber-400 text-slate-900'
                          : 'bg-slate-100 border-slate-200 text-slate-800 cursor-not-allowed'
                      }`}
                    />
                    <span className="absolute right-2.5 top-2 text-[11px] font-mono text-slate-500 pointer-events-none">
                      ETB / trip
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    {activeRouteTariff ? 'Fixed corridor fee per trip' : 'Standard flat fee per trip'}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Delivered Sand Quantity
                  </label>
                  <div className="w-full text-xs font-mono font-bold px-3 py-2 bg-slate-100 border border-slate-200 rounded text-slate-900 flex items-center justify-between tabular-nums">
                    <span>{deliveredNum.toFixed(2)} m³</span>
                    <span className="text-[10px] text-slate-500 font-sans font-normal">
                      Cap: {selectedTruck?.capacity_m3 ? `${selectedTruck.capacity_m3} m³` : 'N/A'}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    Delivered sand volume
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-emerald-950 mb-1">
                    Total Transport Fee for Truck (ETB)
                  </label>
                  <div className="w-full text-xs font-mono font-bold px-3 py-2 bg-emerald-50 border border-emerald-300 rounded text-emerald-800 flex items-center justify-between tabular-nums shadow-2xs">
                    <span>{parseFloat(totalTransportFeeEtb || '0').toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB</span>
                    <span className="text-[10px] font-sans font-medium text-emerald-900">Per Trip</span>
                  </div>
                  <div className="text-[10px] text-emerald-800 font-semibold mt-1">
                    Flat rate per trip (not per m³)
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>Fixed Trip Tariff:</strong> The transport fee is billed per trip based on the pre-configured corridor rate ({Number(transportRateEtbPerM3 || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB / trip).
                </span>
              </div>
            </div>
          </div>

          {/* Section 5: Operational Status & Explanation */}
          <div className="space-y-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center justify-between pb-1 border-b border-slate-200">
              <span className="text-xs font-bold text-slate-900 tracking-wider uppercase font-mono">
                5. Operational Status &amp; Validation
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Trip Operational Status <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TripStatus)}
                  className="w-full text-xs font-semibold px-3 py-2 bg-white border border-slate-300 rounded focus:border-amber-500 focus:outline-hidden"
                >
                  <option value="Delivered">Delivered (Fully Successful)</option>
                  <option value="Partially Delivered">Partially Delivered (Delivered &lt; Loaded)</option>
                  <option value="Unsuccessful">Unsuccessful (Delivery Failed)</option>
                  <option value="Loaded / In Transit">Loaded / In Transit (Active)</option>
                  <option value="Loading">Loading (Active)</option>
                  <option value="Registered">Registered (Active)</option>
                  <option value="Cancelled">Cancelled (Excluded)</option>
                </select>
                <div className="text-[11px] text-slate-500 mt-1">
                  Only trips marked <span className="font-semibold text-emerald-700">Delivered</span> count as fully successful.
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Status Explanation Reason
                  {['Unsuccessful', 'Partially Delivered', 'Cancelled'].includes(status) && (
                    <span className="text-red-500"> (Required for {status})</span>
                  )}
                </label>
                <input
                  type="text"
                  required={['Unsuccessful', 'Partially Delivered', 'Cancelled'].includes(status)}
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  className={`w-full text-xs px-3 py-2 bg-white border rounded focus:outline-hidden ${
                    ['Unsuccessful', 'Partially Delivered', 'Cancelled'].includes(status) && !statusReason.trim()
                      ? 'border-amber-400 bg-amber-50/50'
                      : 'border-slate-300'
                  }`}
                  placeholder="e.g. Partial unloading due to trench collapse risk / Customer rejected batch"
                />
              </div>
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
            <span className="font-mono text-slate-800">
              {(deliveredNum > 0 ? deliveredNum : loadedNum).toFixed(2)} m³ billed
            </span>
            <span aria-hidden="true">•</span>
            <span className="font-mono font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded border border-emerald-300">
              Fixed Fee: {parseFloat(totalTransportFeeEtb || '0').toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB ({transportRateEtbPerM3} ETB/m³)
            </span>
            <span aria-hidden="true">•</span>
            <span>Grade {sandType}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              {isSubmitting ? (
                <span>Saving Trip...</span>
              ) : (
                <>
                  <span>{isEditing ? 'Save Changes' : 'Record Trip'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { X, Edit, Truck as TruckIcon, MapPin, Building2, History, Route, Trash2 } from 'lucide-react';
import { Trip, TripStatusHistory, Truck, TripStatus } from '../../types';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

interface TripDetailModalProps {
  tripId: string | null;
  onClose: () => void;
  onEditTrip: (trip: Trip) => void;
  onStatusUpdated: () => void;
  onTripDeleted?: () => void;
  onViewTruckDossier?: (truckId: string) => void;
}

export const TripDetailModal: React.FC<TripDetailModalProps> = ({
  tripId,
  onClose,
  onEditTrip,
  onStatusUpdated,
  onTripDeleted,
  onViewTruckDossier,
}) => {
  const { canEdit } = useAuth();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [history, setHistory] = useState<TripStatusHistory[]>([]);
  const [truck, setTruck] = useState<Truck | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Quick Status Update inline form
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState<TripStatus>('Delivered');
  const [statusReason, setStatusReason] = useState('');
  const [updateError, setUpdateError] = useState<string | null>(null);

  const loadTripData = () => {
    if (!tripId) return;
    setIsLoading(true);
    api.getTrip(tripId)
      .then((res) => {
        setTrip(res.trip);
        setHistory(res.history);
        if (res.truck) setTruck(res.truck);
        setNewStatus(res.trip.status);
      })
      .catch((err) => console.error('Failed to load trip', err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadTripData();
  }, [tripId]);

  const handleQuickStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trip) return;
    setUpdateError(null);
    if (['Unsuccessful', 'Partially Delivered', 'Cancelled'].includes(newStatus) && !statusReason.trim()) {
      setUpdateError(`An explanation reason is required when setting status to ${newStatus}.`);
      return;
    }
    try {
      await api.updateTrip(trip.id, {
        status: newStatus,
        status_reason: statusReason,
      });
      setIsUpdatingStatus(false);
      setStatusReason('');
      loadTripData();
      onStatusUpdated();
    } catch (err: any) {
      setUpdateError(err.message || 'Failed to update status');
    }
  };

  const handleDeleteTrip = async () => {
    if (!trip) return;
    if (!window.confirm(`Are you sure you want to permanently delete trip record ${trip.id} for truck ${trip.truck_plate} (${trip.sand_type}, ${trip.quantity_loaded_m3} m³)?`)) {
      return;
    }
    try {
      await api.deleteTrip(trip.id);
      onClose();
      if (onTripDeleted) {
        onTripDeleted();
      } else {
        onStatusUpdated();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete trip record');
    }
  };

  if (!tripId) return null;

  const getStatusColor = (st: TripStatus) => {
    switch (st) {
      case 'Delivered':
        return 'bg-emerald-100 text-emerald-900 border-emerald-300';
      case 'Partially Delivered':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'Unsuccessful':
        return 'bg-red-100 text-red-900 border-red-300';
      case 'Cancelled':
        return 'bg-slate-200 text-slate-800 border-slate-300';
      case 'Loaded / In Transit':
        return 'bg-sky-100 text-sky-900 border-sky-300';
      case 'Loading':
        return 'bg-indigo-100 text-indigo-900 border-indigo-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
      <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-800">
              {trip?.id}
            </span>
            <div className="text-xs text-slate-500 font-mono">
              Trip Date: <strong className="text-slate-800">{trip?.trip_date}</strong>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && trip && (
              <>
                <button
                  type="button"
                  onClick={() => onEditTrip(trip)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded transition-colors shadow-2xs cursor-pointer"
                >
                  <Edit className="w-3.5 h-3.5 text-slate-600" />
                  <span>Edit Record</span>
                </button>
                <button
                  type="button"
                  onClick={handleDeleteTrip}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 bg-white border border-red-200 hover:bg-red-50 rounded transition-colors shadow-2xs cursor-pointer"
                  title="Delete Trip Record"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  <span>Delete</span>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading || !trip ? (
            <div className="py-12 text-center text-xs text-slate-500 font-mono">Loading trip details...</div>
          ) : (
            <>
              {/* Primary Status Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg bg-slate-50 border border-slate-200">
                <div className="space-y-1">
                  <div className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">
                    Delivery Outcome Status
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-bold border ${getStatusColor(trip.status)}`}>
                      {trip.status}
                    </span>
                    {trip.delivery_outcome && (
                      <span className="text-xs text-slate-600 font-medium">
                        Outcome: <span className="text-slate-900 font-semibold">{trip.delivery_outcome}</span>
                      </span>
                    )}
                  </div>
                  {trip.status_reason && (
                    <p className="text-xs text-slate-600 italic mt-1">
                      Reason: "{trip.status_reason}"
                    </p>
                  )}
                </div>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => setIsUpdatingStatus(!isUpdatingStatus)}
                    className="self-start sm:self-center px-3 py-1.5 text-xs font-semibold text-amber-950 bg-amber-400 hover:bg-amber-300 rounded transition-colors shrink-0 cursor-pointer"
                  >
                    {isUpdatingStatus ? 'Cancel Status Change' : 'Update Status'}
                  </button>
                )}
              </div>

              {/* Quick Status Update Form */}
              {isUpdatingStatus && (
                <form onSubmit={handleQuickStatusSubmit} className="p-4 bg-amber-50/60 border border-amber-200 rounded-lg space-y-3">
                  <div className="text-xs font-bold text-amber-950 font-mono">Update Operational Status</div>
                  {updateError && (
                    <div className="text-xs text-red-700 bg-red-50 p-2 rounded border border-red-200">
                      {updateError}
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">New Status</label>
                      <select
                        value={newStatus}
                        onChange={(e) => setNewStatus(e.target.value as TripStatus)}
                        className="w-full text-xs font-semibold px-3 py-1.5 bg-white border border-slate-300 rounded focus:border-amber-500"
                      >
                        <option value="Delivered">Delivered (Fully Successful)</option>
                        <option value="Partially Delivered">Partially Delivered</option>
                        <option value="Unsuccessful">Unsuccessful</option>
                        <option value="Loaded / In Transit">Loaded / In Transit</option>
                        <option value="Loading">Loading</option>
                        <option value="Registered">Registered</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Reason / Notes {['Unsuccessful', 'Partially Delivered', 'Cancelled'].includes(newStatus) && '*'}
                      </label>
                      <input
                        type="text"
                        value={statusReason}
                        onChange={(e) => setStatusReason(e.target.value)}
                        placeholder="Reason for status change"
                        className="w-full text-xs px-3 py-1.5 bg-white border border-slate-300 rounded focus:border-amber-500"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsUpdatingStatus(false)}
                      className="px-3 py-1 text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded cursor-pointer"
                    >
                      Save Status
                    </button>
                  </div>
                </form>
              )}

              {/* Side-by-Side: Crusher Loading Point & Construction Unloading Destination */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Crusher Loading Section */}
                <div className="p-4 rounded-lg border border-amber-200 bg-amber-50/20 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold font-mono text-amber-950 border-b border-amber-200/60 pb-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-amber-600" />
                      <span>Crusher Loading Point (Source)</span>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-200 text-amber-900">
                      Crusher Plant
                    </span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[11px]">Crusher Loading Facility:</span>
                      <strong className="text-slate-900 text-sm">{trip.loading_location_name}</strong>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <span className="text-slate-500 block text-[11px]">Sand Type Category:</span>
                        <span className="font-mono font-bold text-sm text-amber-700 px-2 py-0.5 bg-amber-100 border border-amber-300 rounded inline-block">
                          Grade {trip.sand_type}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Quantity Loaded:</span>
                        <span className="font-mono font-bold text-sm text-slate-900 tabular-nums">
                          {trip.quantity_loaded_m3.toFixed(2)} m³
                        </span>
                      </div>
                    </div>
                    {trip.loading_datetime && (
                      <div>
                        <span className="text-slate-500 block text-[11px]">Crusher Loading Time:</span>
                        <span className="font-mono text-slate-800">
                          {new Date(trip.loading_datetime).toLocaleString()}
                        </span>
                      </div>
                    )}
                    {trip.loading_notes && (
                      <div>
                        <span className="text-slate-500 block text-[11px]">Crusher Loading Notes:</span>
                        <p className="text-slate-700 bg-white p-2 rounded text-xs border border-amber-200/70">{trip.loading_notes}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Destination Project Unloading Section */}
                <div className="p-4 rounded-lg border border-blue-200 bg-blue-50/20 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold font-mono text-blue-950 border-b border-blue-200/60 pb-2">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-blue-600" />
                      <span>Destination Project (Unloading)</span>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-200 text-blue-900">
                      Destination Project
                    </span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[11px]">Client &amp; Destination Project:</span>
                      <strong className="text-slate-900 text-sm block">{trip.company_name}</strong>
                      {trip.project_name && (
                        <span className="text-xs text-blue-700 font-medium block">
                          Destination Project: {trip.project_name}
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Unloading Staging Point:</span>
                      <strong className="text-slate-800 text-xs">{trip.unloading_location_name}</strong>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <span className="text-slate-500 block text-[11px]">Quantity Delivered:</span>
                        <span className="font-mono font-bold text-sm text-slate-900 tabular-nums">
                          {trip.quantity_delivered_m3.toFixed(2)} m³
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Outstanding Shortage:</span>
                        <span className={`font-mono font-bold text-sm tabular-nums ${trip.quantity_remaining_m3 > 0 ? 'text-amber-700 font-bold' : 'text-slate-600'}`}>
                          {trip.quantity_remaining_m3.toFixed(2)} m³
                        </span>
                      </div>
                    </div>
                    {trip.unloading_datetime && (
                      <div>
                        <span className="text-slate-500 block text-[11px]">Unloading Time:</span>
                        <span className="font-mono text-slate-800">
                          {new Date(trip.unloading_datetime).toLocaleString()}
                        </span>
                      </div>
                    )}
                    {trip.delivery_proof_ref && (
                      <div>
                        <span className="text-slate-500 block text-[11px]">Proof of Delivery (POD Ticket):</span>
                        <span className="font-mono text-slate-900 font-semibold px-2 py-0.5 bg-white border border-blue-200 rounded inline-block">
                          {trip.delivery_proof_ref}
                        </span>
                      </div>
                    )}
                    {trip.unloading_notes && (
                      <div>
                        <span className="text-slate-500 block text-[11px]">Destination Project Notes:</span>
                        <p className="text-slate-700 bg-white p-2 rounded text-xs border border-blue-200/70">{trip.unloading_notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Fixed Route Transport Fee Card */}
              <div className="p-4 rounded-lg border border-emerald-200 bg-emerald-50/30 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold font-mono text-emerald-950 border-b border-emerald-200/60 pb-2">
                  <div className="flex items-center gap-2">
                    <Route className="w-4 h-4 text-emerald-700" />
                    <span>Fixed Route Transport Fee (ETB)</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-200/80 text-emerald-900 font-semibold font-mono">
                    Auto-Resolved Tariff
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div className="bg-white p-3 rounded border border-emerald-100">
                    <span className="text-slate-500 block text-[11px]">Corridor Fixed Tariff:</span>
                    <span className="font-mono font-bold text-base text-amber-700 tabular-nums">
                      {Number(trip.total_transport_fee_etb || trip.transport_rate_etb_per_m3 || 8500).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-normal text-slate-500">ETB / trip</span>
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Fixed rate per truck trip</span>
                  </div>
                  <div className="bg-white p-3 rounded border border-emerald-100">
                    <span className="text-slate-500 block text-[11px]">Delivered Volume:</span>
                    <span className="font-mono font-bold text-base text-slate-900 tabular-nums">
                      {trip.quantity_delivered_m3.toFixed(2)} <span className="text-xs font-normal text-slate-500">m³</span>
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Verified site receipt
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded border border-emerald-200 bg-emerald-50/20">
                    <span className="text-emerald-900 font-semibold block text-[11px]">Total Transport Fee / Truck:</span>
                    <span className="font-mono font-bold text-base text-emerald-700 tabular-nums">
                      {trip.total_transport_fee_etb ? Number(trip.total_transport_fee_etb).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'} <span className="text-xs font-normal text-emerald-800">ETB</span>
                    </span>
                    <span className="text-[10px] text-emerald-700 block mt-0.5 font-medium">
                      Flat fee settlement per trip
                    </span>
                  </div>
                </div>
              </div>

              {/* Truck & Construction Client Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Truck Card */}
                <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/60 space-y-2 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                    <div className="flex items-center gap-2 font-bold font-mono text-slate-800">
                      <TruckIcon className="w-4 h-4 text-slate-600" />
                      <span>Hired Truck Assignment</span>
                    </div>
                    {onViewTruckDossier && (
                      <button
                        type="button"
                        onClick={() => onViewTruckDossier(trip.truck_id)}
                        className="text-[11px] font-semibold text-amber-700 hover:text-amber-800 hover:underline cursor-pointer"
                      >
                        View Truck Report Dossier →
                      </button>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Plate Number:</span>
                    <span className="font-mono font-bold text-slate-900 text-sm bg-white px-2 py-0.5 rounded border border-slate-200">
                      {trip.truck_plate}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">External Truck Owner:</span>
                    <span className="font-semibold text-slate-800">{trip.truck_owner}</span>
                  </div>
                  {truck?.capacity_m3 && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Registered Capacity:</span>
                      <span className="font-mono text-slate-700">{truck.capacity_m3} m³</span>
                    </div>
                  )}
                  {truck?.owner_phone && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Owner Contact:</span>
                      <span className="font-mono text-slate-700">{truck.owner_phone}</span>
                    </div>
                  )}
                </div>

                {/* Construction Company & Project */}
                <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/60 space-y-2 text-xs">
                  <div className="flex items-center gap-2 font-bold font-mono text-slate-800 border-b border-slate-200 pb-1.5">
                    <Building2 className="w-4 h-4 text-slate-600" />
                    <span>Client &amp; Project Association</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Construction Company:</span>
                    <span className="font-semibold text-slate-900">{trip.company_name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Project / Site:</span>
                    <span className="font-semibold text-slate-800">
                      {trip.project_name || 'General / Direct Delivery'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
                    <span>Recorded By:</span>
                    <span>{trip.created_by_user_name || 'Operator'}</span>
                  </div>
                </div>
              </div>

              {/* Status Change History Timeline */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 text-xs font-bold font-mono text-slate-800 border-b border-slate-200 pb-1.5">
                  <History className="w-4 h-4 text-slate-600" />
                  <span>Audit &amp; Status Change History</span>
                </div>
                <div className="space-y-2">
                  {history.length === 0 ? (
                    <div className="text-xs text-slate-400 italic">No status change history recorded.</div>
                  ) : (
                    history.map((h, i) => (
                      <div key={h.id || i} className="flex items-start gap-3 text-xs p-2.5 rounded bg-slate-50 border border-slate-100">
                        <div className="w-2 h-2 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                        <div className="flex-1 space-y-0.5">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-900">
                              {h.previous_status ? `${h.previous_status} → ${h.new_status}` : `Initial Status: ${h.new_status}`}
                            </span>
                            <span className="text-[11px] font-mono text-slate-500">
                              {new Date(h.created_at).toLocaleString()}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-600 flex items-center gap-2">
                            <span>Changed by {h.changed_by_user_name}</span>
                            {h.reason && (
                              <>
                                <span aria-hidden="true">•</span>
                                <span className="italic">"{h.reason}"</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500 font-mono">
            AB Trading Unified Dispatch &amp; Delivery Record
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SpecificTruckDossier } from '../types';

export interface ExportColumn {
  header: string;
  key: string;
  format?: (value: any, row?: any) => string;
}

export function exportToCsv(filename: string, columns: ExportColumn[], rows: any[]) {
  const headerLine = columns.map(c => `"${c.header.replace(/"/g, '""')}"`).join(',');
  const rowLines = rows.map(row => {
    return columns.map(c => {
      let val = row[c.key];
      if (c.format) {
        val = c.format(val, row);
      } else if (val === null || val === undefined) {
        val = '';
      }
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(',');
  });

  const csvContent = '\uFEFF' + [headerLine, ...rowLines].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportToPdf(
  title: string,
  filterInfo: string,
  columns: ExportColumn[],
  rows: any[],
  summaryNotes?: string
) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4',
  });

  // Header Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(title, 40, 40);

  // Subtitle / Filters
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Alex Logistics • Generated: ${new Date().toLocaleString()} • ${filterInfo}`, 40, 56);

  if (summaryNotes) {
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    doc.text(summaryNotes, 40, 72);
  }

  const tableHeaders = columns.map(c => c.header);
  const tableData = rows.map(r =>
    columns.map(c => {
      if (c.format) {
        return c.format(r[c.key], r);
      }
      const val = r[c.key];
      return val === null || val === undefined ? '-' : String(val);
    })
  );

  autoTable(doc, {
    startY: summaryNotes ? 84 : 70,
    head: [tableHeaders],
    body: tableData,
    margin: { left: 40, right: 40, bottom: 40 },
    theme: 'striped',
    headStyles: {
      fillColor: [30, 41, 59], // slate-800
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'left',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // slate-50
    },
    styles: {
      cellPadding: 4,
      overflow: 'linebreak',
    },
    didDrawPage: (data) => {
      const pageCount = (doc as any).internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Page ${data.pageNumber} of ${pageCount}`,
        doc.internal.pageSize.getWidth() - 80,
        doc.internal.pageSize.getHeight() - 20
      );
    },
  });

  doc.save(`${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}.pdf`);
}

export function exportTruckDossierPdf(dossier: SpecificTruckDossier, filterPeriod: string) {
  const doc = new jsPDF({
    orientation: dossier.isAllTrucks ? 'landscape' : 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const { truck, summary, sandBreakdown, trips, isAllTrucks, trucksComparison } = dossier;

  // Header Box
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(40, 30, doc.internal.pageSize.getWidth() - 80, 60, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(245, 158, 11); // amber-500
  doc.text(
    isAllTrucks ? 'CONSOLIDATED FLEET AUDIT REPORT (ALL TRUCKS)' : `TRUCK AUDIT DOSSIER: ${truck.plate_number}`,
    55,
    58
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225); // slate-300
  if (isAllTrucks) {
    doc.text(`Fleet Scope: All Registered Hired Trucks | Distinct Units Mobilized: ${summary.distinctTrucksCount || 0} | Total Fleet Capacity: ${truck.capacity_m3 ? `${truck.capacity_m3} m³` : 'N/A'}`, 55, 75);
  } else {
    doc.text(`Owner: ${truck.owner_name} | Contact: ${truck.owner_phone || 'N/A'} | Rated Cap: ${truck.capacity_m3 ? `${truck.capacity_m3} m³` : 'N/A'}`, 55, 75);
  }

  // Subheader & Filter Info
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.text(`Generated: ${new Date().toLocaleString()} | Filter Scope: ${filterPeriod}`, 40, 105);

  // KPI Summary Table
  const kpiData = [
    [
      'Total Dispatches / Trips', `${summary.totalTrips}`,
      'Full Delivered Trips', `${summary.successfulTrips}`,
      'Partial Shortage Trips', `${summary.partialTrips}`
    ],
    [
      'Unsuccessful / Aborted', `${summary.unsuccessfulTrips}`,
      'Total Sand Loaded (m³)', `${summary.totalLoadedM3.toFixed(2)} m³`,
      'Total Sand Delivered (m³)', `${summary.totalDeliveredM3.toFixed(2)} m³`
    ],
    [
      'Total Shortage (m³)', `${summary.totalShortageM3.toFixed(2)} m³`,
      'Delivery Success Rate', summary.successRate !== null ? `${summary.successRate}%` : 'N/A',
      isAllTrucks ? 'Overload Incidents' : 'Avg Load / Capacity Util.',
      isAllTrucks ? `${summary.overloadTripsCount} loads` : `${summary.avgLoadM3.toFixed(2)} m³ (${summary.capacityUtilization !== null ? `${summary.capacityUtilization}%` : 'N/A'})`
    ]
  ];

  autoTable(doc, {
    startY: 115,
    head: [[isAllTrucks ? 'FLEET-WIDE OPERATIONAL KPI SUMMARY' : 'OPERATIONAL KPI SUMMARY METRICS', '', '', '', '', '']],
    body: kpiData,
    margin: { left: 40, right: 40 },
    theme: 'grid',
    headStyles: {
      fillColor: [71, 85, 105],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'left',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [15, 23, 42],
    },
    styles: { cellPadding: 4 },
  });

  let currentY = (doc as any).lastAutoTable.finalY + 15;

  // If All Trucks, print the Comparative Trucks Breakdown Matrix
  if (isAllTrucks && trucksComparison && trucksComparison.length > 0) {
    const compHeaders = ['Truck Plate', 'Owner', 'Capacity (m³)', 'Trips', 'Loaded (m³)', 'Delivered (m³)', 'Shortage (m³)', 'Overloads', 'Success Rate'];
    const compRows = trucksComparison.map(t => [
      t.truck_plate,
      t.truck_owner,
      t.capacity_m3 ? `${Number(t.capacity_m3).toFixed(2)} m³` : '-',
      t.total_trips,
      Number(t.total_loaded_m3 || 0).toFixed(2),
      Number(t.total_delivered_m3 || 0).toFixed(2),
      Number(t.total_shortage_m3 || 0).toFixed(2),
      t.overload_count || 0,
      t.success_rate_label || 'N/A'
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [compHeaders],
      body: compRows,
      margin: { left: 40, right: 40 },
      theme: 'striped',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold',
      },
      bodyStyles: { fontSize: 8 },
      styles: { cellPadding: 3 },
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;
  }

  // Sand Grade Distribution Table
  const sandData = sandBreakdown.map(s => [
    `Grade ${s.sand_type} (${s.sand_type === '00' ? 'Fine Mortar' : s.sand_type === '01' ? 'Medium Concrete' : 'Coarse Road Bedding'})`,
    `${s.trip_count} trips`,
    `${s.loaded_m3.toFixed(2)} m³`,
    `${s.delivered_m3.toFixed(2)} m³`,
    `${s.shortage_m3.toFixed(2)} m³`
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['Sand Grade Category', 'Trips', 'Loaded Volume', 'Delivered Volume', 'Shortage Volume']],
    body: sandData,
    margin: { left: 40, right: 40 },
    theme: 'striped',
    headStyles: {
      fillColor: [47, 63, 86],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
    },
    bodyStyles: { fontSize: 8 },
    styles: { cellPadding: 3 },
  });

  currentY = (doc as any).lastAutoTable.finalY + 15;

  // Itemized Trips Table
  const tripHeaders = isAllTrucks
    ? ['Trip ID', 'Date', 'Truck Plate', 'Crusher Plant (Origin)', 'Construction Site (Destination)', 'Client', 'Grade', 'Loaded', 'Delivered', 'Status']
    : ['Trip ID', 'Date', 'Crusher Plant (Origin)', 'Construction Site (Destination)', 'Client', 'Grade', 'Loaded', 'Delivered', 'Status'];

  const tripRows = trips.map(t => isAllTrucks ? [
    t.id,
    t.trip_date,
    t.truck_plate,
    t.loading_location_name,
    t.unloading_location_name,
    t.company_name,
    `Grade ${t.sand_type}`,
    `${t.quantity_loaded_m3.toFixed(2)} m³`,
    `${t.quantity_delivered_m3.toFixed(2)} m³`,
    t.status
  ] : [
    t.id,
    t.trip_date,
    t.loading_location_name,
    t.unloading_location_name,
    t.company_name,
    `Grade ${t.sand_type}`,
    `${t.quantity_loaded_m3.toFixed(2)} m³`,
    `${t.quantity_delivered_m3.toFixed(2)} m³`,
    t.status
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [tripHeaders],
    body: tripRows,
    margin: { left: 40, right: 40, bottom: 40 },
    theme: 'striped',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontSize: 7,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 7,
      textColor: [30, 41, 59],
    },
    styles: { cellPadding: 3, overflow: 'linebreak' },
    didDrawPage: (data) => {
      const pageCount = (doc as any).internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Alex Logistics • ${isAllTrucks ? 'Consolidated Fleet Report' : `Truck ${truck.plate_number}`} • Page ${data.pageNumber} of ${pageCount}`,
        doc.internal.pageSize.getWidth() - 260,
        doc.internal.pageSize.getHeight() - 15
      );
    },
  });

  const fileSlug = isAllTrucks ? 'consolidated_fleet_all_trucks' : `truck_${truck.plate_number.replace(/[^a-zA-Z0-9]/g, '_')}`;
  doc.save(`${fileSlug}_dossier_${Date.now()}.pdf`);
}

export function exportRegisteredTripsAndTrucksPdf(
  filterPeriod: string,
  truckPerformanceRows: any[],
  registeredTripRows: any[],
  kpis: {
    totalTrips: number;
    totalLoadedM3: number;
    totalDeliveredM3: number;
    totalShortageM3: number;
    activeTrucksCount: number;
    successRate: string | number;
  }
) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Header Box
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(40, 25, pageWidth - 80, 55, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(245, 158, 11); // amber-500
  doc.text('ALEX LOGISTICS — REGISTERED TRIPS & TRUCK PERFORMANCE REPORT', 55, 48);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text(`Generated: ${new Date().toLocaleString()} • ${filterPeriod}`, 55, 66);

  // Executive KPI summary bar
  let currentY = 92;
  doc.setFillColor(241, 245, 249); // slate-100
  doc.roundedRect(40, currentY, pageWidth - 80, 28, 4, 4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  const kpiText = `Total Dispatches: ${kpis.totalTrips} | Active Hired Trucks: ${kpis.activeTrucksCount} | Loaded: ${kpis.totalLoadedM3.toFixed(2)} m³ | Delivered: ${kpis.totalDeliveredM3.toFixed(2)} m³ | Shortage: ${kpis.totalShortageM3.toFixed(2)} m³ | Fleet Success: ${kpis.successRate}%`;
  doc.text(kpiText, 52, currentY + 18);

  currentY += 40;

  // Section 1 Title: Truck Performance Matrix
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text('1. Hired Truck Fleet Performance Matrix', 40, currentY);

  const truckHeaders = [
    'Plate', 'Owner / Carrier', 'Phone', 'Capacity', 'Trips',
    'Loaded (m³)', 'Delivered (m³)', 'Shortage', 'Sand 00', 'Sand 01', 'Sand 02', 'Success Rate'
  ];

  const truckData = truckPerformanceRows.map(t => [
    t.truck_plate || '',
    t.truck_owner || '',
    t.owner_phone || '-',
    t.capacity_m3 ? `${Number(t.capacity_m3).toFixed(2)} m³` : (t.truck_capacity_m3 ? `${Number(t.truck_capacity_m3).toFixed(2)} m³` : '-'),
    t.total_trips || 0,
    Number(t.total_loaded_m3 || 0).toFixed(2),
    Number(t.total_delivered_m3 || 0).toFixed(2),
    Number(t.total_shortage_m3 || 0).toFixed(2),
    Number(t.delivered_sand_00 || 0).toFixed(2),
    Number(t.delivered_sand_01 || 0).toFixed(2),
    Number(t.delivered_sand_02 || 0).toFixed(2),
    t.success_rate_label || (t.success_rate !== null && t.success_rate !== undefined ? `${t.success_rate}%` : 'N/A')
  ]);

  autoTable(doc, {
    startY: currentY + 6,
    head: [truckHeaders],
    body: truckData,
    margin: { left: 40, right: 40 },
    theme: 'striped',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
    },
    bodyStyles: { fontSize: 7, textColor: [30, 41, 59] },
    styles: { cellPadding: 2.5 },
  });

  currentY = (doc as any).lastAutoTable.finalY + 20;

  // Section 2 Title: Registered Trips Detail
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text('2. Unified Registered Trips Log', 40, currentY);

  const tripHeaders = [
    'Trip ID', 'Date', 'Truck Plate', 'Carrier / Owner', 'Crusher (Origin)',
    'Destination Project', 'Client', 'Grade', 'Loaded', 'Delivered', 'Status', 'POD Ref'
  ];

  const tripData = registeredTripRows.map(t => [
    t.id,
    t.trip_date,
    t.truck_plate,
    t.truck_owner,
    t.loading_location_name,
    t.unloading_location_name,
    t.company_name,
    `Grade ${t.sand_type}`,
    `${Number(t.quantity_loaded_m3 || 0).toFixed(2)} m³`,
    `${Number(t.quantity_delivered_m3 || 0).toFixed(2)} m³`,
    t.status,
    t.delivery_proof_ref || '-'
  ]);

  autoTable(doc, {
    startY: currentY + 6,
    head: [tripHeaders],
    body: tripData,
    margin: { left: 40, right: 40, bottom: 35 },
    theme: 'striped',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontSize: 7,
      fontStyle: 'bold',
    },
    bodyStyles: { fontSize: 6.5, textColor: [30, 41, 59] },
    styles: { cellPadding: 2.5, overflow: 'linebreak' },
    didDrawPage: (data) => {
      const pageCount = (doc as any).internal.getNumberOfPages();
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Alex Logistics • Registered Trips & Truck Performance Report • Page ${data.pageNumber} of ${pageCount}`,
        pageWidth - 310,
        doc.internal.pageSize.getHeight() - 15
      );
    },
  });

  doc.save(`alex_logistics_trips_and_truck_performance_${Date.now()}.pdf`);
}

export function exportTruckTransportPivotPdf(
  truckGroups: any[],
  kpis: {
    totalHiredTrucks: number;
    totalTrips: number;
    totalTransportFeesEtb: number;
    avgFeePerTruckEtb: number;
    totalDeliveredM3: number;
  },
  filterInfo: string
) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Header Title
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 55, 'F');

  // Gold accent bar
  doc.setFillColor(245, 158, 11); // amber-500
  doc.rect(0, 52, pageWidth, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('Hired Trucks Trip History & Transport Fees Report (Pivoted by Truck Plate)', 40, 28);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text(`Alex Logistics Sand Transport • Generated: ${new Date().toLocaleString()} • ${filterInfo}`, 40, 44);

  // Executive KPI summary bar
  let currentY = 70;
  doc.setFillColor(248, 250, 252); // slate-50
  doc.roundedRect(40, currentY, pageWidth - 80, 28, 4, 4, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(40, currentY, pageWidth - 80, 28, 4, 4, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  const kpiText = `Hired Trucks: ${kpis.totalHiredTrucks} | Total Dispatches: ${kpis.totalTrips} | Total Transport Fees: ETB ${Number(kpis.totalTransportFeesEtb || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | Avg Fee/Truck: ETB ${Number(kpis.avgFeePerTruckEtb || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | Total Volume: ${Number(kpis.totalDeliveredM3 || 0).toFixed(2)} m³`;
  doc.text(kpiText, 52, currentY + 18);

  currentY += 40;

  // Build rows matching exact reference layout with rowSpan
  const tableRows: any[] = [];
  const headers = [
    'Truck Plate',
    'Truck Owner',
    'Total Trips',
    'Loading Point',
    'Company',
    'Destination Project',
    'Number of Trips',
    'Date',
    'Loading Time',
    'Sand Type',
    'Loaded (m³)',
    'Individual Price',
    'Subtotal price',
    'Grand Total'
  ];

  truckGroups.forEach((group) => {
    const rawTrips: any[] = group.trips || [];
    if (rawTrips.length === 0) {
      tableRows.push([
        { content: group.truck_plate || '-', styles: { fontStyle: 'bold', halign: 'center' } },
        group.truck_owner || '-',
        '0',
        '-',
        '-',
        '-',
        '0',
        '-',
        '-',
        '-',
        '0.00',
        '0',
        '0',
        '0'
      ]);
      return;
    }

    // Group trips by Loading Point + Company + Destination Project
    const routeMap = new Map<string, any[]>();
    rawTrips.forEach((t) => {
      const loading = (t.loading_location_name || '-').trim();
      const comp = (t.company_name || '-').trim();
      const dest = ((t.project_name && t.project_name !== '-') ? t.project_name : (t.unloading_location_name || '-')).trim();
      const key = `${loading}__${comp}__${dest}`;
      if (!routeMap.has(key)) routeMap.set(key, []);
      routeMap.get(key)!.push(t);
    });

    const routeGroups: Array<{
      loadingPoint: string;
      company: string;
      destinationProject: string;
      trips: any[];
      subtotalPrice: number;
    }> = [];

    routeMap.forEach((tripsInRoute) => {
      const first = tripsInRoute[0];
      const subtotal = tripsInRoute.reduce((sum, tr) => sum + (Number(tr.individual_transport_fee_etb) || 0), 0);
      routeGroups.push({
        loadingPoint: (first.loading_location_name || '-').trim(),
        company: (first.company_name || '-').trim(),
        destinationProject: ((first.project_name && first.project_name !== '-') ? first.project_name : (first.unloading_location_name || '-')).trim(),
        trips: tripsInRoute,
        subtotalPrice: subtotal
      });
    });

    const truckTotalRows = rawTrips.length;
    const grandTotal = group.calculated_total_transport_fee_etb ?? routeGroups.reduce((acc, rg) => acc + rg.subtotalPrice, 0);

    routeGroups.forEach((routeGroup, rgIdx) => {
      routeGroup.trips.forEach((trip, tIdx) => {
        const isFirstOfTruck = rgIdx === 0 && tIdx === 0;
        const isFirstOfRoute = tIdx === 0;
        const row: any[] = [];

        // 1. Truck Plate, Owner, Total Trips (spanned across entire truck)
        if (isFirstOfTruck) {
          row.push({
            content: group.truck_plate,
            rowSpan: truckTotalRows,
            styles: { valign: 'middle', halign: 'center', fontStyle: 'bold' }
          });
          row.push({
            content: group.truck_owner,
            rowSpan: truckTotalRows,
            styles: { valign: 'middle', halign: 'left' }
          });
          row.push({
            content: String(rawTrips.length),
            rowSpan: truckTotalRows,
            styles: { valign: 'middle', halign: 'center', fontStyle: 'bold' }
          });
        }

        // 2. Loading Point, Company, Destination Project, Number of Trips (spanned across route group)
        if (isFirstOfRoute) {
          row.push({
            content: routeGroup.loadingPoint,
            rowSpan: routeGroup.trips.length,
            styles: { valign: 'middle', halign: 'left' }
          });
          row.push({
            content: routeGroup.company,
            rowSpan: routeGroup.trips.length,
            styles: { valign: 'middle', halign: 'left' }
          });
          row.push({
            content: routeGroup.destinationProject,
            rowSpan: routeGroup.trips.length,
            styles: { valign: 'middle', halign: 'left' }
          });
          row.push({
            content: String(routeGroup.trips.length),
            rowSpan: routeGroup.trips.length,
            styles: { valign: 'middle', halign: 'center', fontStyle: 'bold' }
          });
        }

        // 3. Detail Trip Row
        let timeStr = '10:00:00 PM';
        try {
          const rawTime = trip.loading_datetime || trip.created_at;
          if (rawTime) {
            const dt = new Date(rawTime);
            if (!isNaN(dt.getTime())) {
              timeStr = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
            }
          }
        } catch {
          timeStr = '10:00:00 PM';
        }

        const sandGrade = (trip.sand_type === '00' ? '0' : trip.sand_type === '01' ? '1' : trip.sand_type === '02' ? '2' : (trip.sand_type || '0'));
        const loadedVol = Number(trip.quantity_loaded_m3 || 0).toFixed(2);
        const indPrice = Number(trip.individual_transport_fee_etb || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

        row.push({ content: trip.trip_date || '-', styles: { halign: 'center' } });
        row.push({ content: timeStr, styles: { halign: 'center' } });
        row.push({ content: sandGrade, styles: { halign: 'center' } });
        row.push({ content: loadedVol, styles: { halign: 'right' } });
        row.push({ content: indPrice, styles: { halign: 'right' } });

        // 4. Subtotal price (spanned across route group)
        if (isFirstOfRoute) {
          row.push({
            content: Number(routeGroup.subtotalPrice).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }),
            rowSpan: routeGroup.trips.length,
            styles: { valign: 'middle', halign: 'right', fontStyle: 'bold' }
          });
        }

        // 5. Grand Total (spanned across entire truck)
        if (isFirstOfTruck) {
          row.push({
            content: Number(grandTotal).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }),
            rowSpan: truckTotalRows,
            styles: { valign: 'middle', halign: 'right', fontStyle: 'bold' }
          });
        }

        tableRows.push(row);
      });
    });
  });

  autoTable(doc, {
    startY: currentY,
    head: [headers],
    body: tableRows,
    margin: { left: 25, right: 25, bottom: 30 },
    theme: 'grid',
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontSize: 6.8,
      fontStyle: 'bold',
      halign: 'left',
      lineWidth: 0.5,
      lineColor: [203, 213, 225]
    },
    bodyStyles: {
      fontSize: 6.2,
      textColor: [30, 41, 59],
      lineWidth: 0.5,
      lineColor: [203, 213, 225]
    },
    columnStyles: {
      0: { fontStyle: 'bold', halign: 'center', cellWidth: 50 }, // Truck Plate
      1: { cellWidth: 65 }, // Owner
      2: { halign: 'center', cellWidth: 35 }, // Total Trips
      3: { cellWidth: 70 }, // Loading Point
      4: { cellWidth: 70 }, // Company
      5: { cellWidth: 85 }, // Destination Project
      6: { halign: 'center', cellWidth: 35 }, // Number of Trips
      7: { halign: 'center', cellWidth: 48 }, // Date
      8: { halign: 'center', cellWidth: 48 }, // Loading Time
      9: { halign: 'center', cellWidth: 30 }, // Sand Type
      10: { halign: 'right', cellWidth: 35 }, // Loaded (m3)
      11: { halign: 'right', cellWidth: 45 }, // Individual Price
      12: { halign: 'right', fontStyle: 'bold', cellWidth: 45 }, // Subtotal price
      13: { halign: 'right', fontStyle: 'bold', cellWidth: 45 } // Grand Total
    },
    styles: { cellPadding: 2.5, overflow: 'linebreak' },
    didDrawPage: (data) => {
      const pageCount = (doc as any).internal.getNumberOfPages();
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Alex Logistics • Hired Trucks Transport Fees Pivot Ledger • Page ${data.pageNumber} of ${pageCount}`,
        pageWidth - 280,
        pageHeight - 12
      );
    },
  });

  doc.save(`hired_trucks_transport_fees_pivot_${new Date().toISOString().split('T')[0]}.pdf`);
}


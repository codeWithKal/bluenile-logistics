/**
 * Ethiopian Sand & Aggregate Logistics Sample Dataset
 * Seed data provided by user:
 * - 30 Hired Trucks (plates, owners, capacity 16.74/16.14 m³, phone numbers)
 * - 31 Construction Companies (names, contact persons, phone numbers, addresses)
 * - 31 Project Sites (destination projects linked to construction companies)
 * - 7 Crusher Sites (strictly loading facilities in Sendafa, Aleltu, Chole, Fiche)
 */

export interface SeedTruck {
  plate_number: string;
  owner_name: string;
  capacity_m3: number;
  owner_phone: string;
  notes?: string;
}

export interface SeedCompany {
  name: string;
  contact_person: string;
  phone: string;
  address: string;
}

export interface SeedProject {
  project_name: string;
  company_name: string;
  address: string;
  lat: number;
  lng: number;
}

export interface SeedCrusher {
  name: string;
  address: string;
  contact_person: string;
  phone: string;
  lat: number;
  lng: number;
}

export const SEED_TRUCKS: SeedTruck[] = [
  { plate_number: 'A12453', owner_name: 'Abebe Kebede', capacity_m3: 16.74, owner_phone: '+2519123452', notes: 'Tri-axle aggregate tipper' },
  { plate_number: 'AA23451', owner_name: 'Tesfaye Alemu', capacity_m3: 16.14, owner_phone: '+251911234567', notes: 'Tandem dump truck' },
  { plate_number: 'OR34512', owner_name: 'Gemechu Tolera', capacity_m3: 16.74, owner_phone: '+251922345678', notes: 'Heavy end dump tipper' },
  { plate_number: 'AM45623', owner_name: 'Mulugeta Assefa', capacity_m3: 16.14, owner_phone: '+251933456789', notes: 'Standard 2-axle dump' },
  { plate_number: 'AA56734', owner_name: 'Dawit Haile', capacity_m3: 16.74, owner_phone: '+251944567890', notes: 'Tri-axle heavy hauler' },
  { plate_number: 'OR67845', owner_name: 'Chala Dinka', capacity_m3: 16.14, owner_phone: '+251955678901', notes: 'Medium dump unit' },
  { plate_number: 'SN78956', owner_name: 'Bekele Wolde', capacity_m3: 16.74, owner_phone: '+251966789012', notes: 'Tri-axle end tipper' },
  { plate_number: 'AM89067', owner_name: 'Yohannes Girma', capacity_m3: 16.14, owner_phone: '+251977890123', notes: 'Tandem gravel carrier' },
  { plate_number: 'AA90178', owner_name: 'Solomon Tadesse', capacity_m3: 16.74, owner_phone: '+251988901234', notes: 'High sideboard tipper' },
  { plate_number: 'TG01289', owner_name: 'Hagos Gebre', capacity_m3: 16.14, owner_phone: '+251999012345', notes: 'Standard aggregate hauler' },
  { plate_number: 'AA12390', owner_name: 'Fikru Negash', capacity_m3: 16.74, owner_phone: '+251910123456', notes: 'Heavy 3-axle tipper' },
  { plate_number: 'OR23401', owner_name: 'Lelisa Bekele', capacity_m3: 16.14, owner_phone: '+251921234567', notes: 'Tandem dump chassis' },
  { plate_number: 'AM34512', owner_name: 'Tewodros Kassahun', capacity_m3: 16.74, owner_phone: '+251932345678', notes: 'Heavy duty tri-axle' },
  { plate_number: 'SN45623', owner_name: 'Aberash Demeke', capacity_m3: 16.14, owner_phone: '+251943456789', notes: 'Washed sand specialist' },
  { plate_number: 'AA56735', owner_name: 'Kebede Molla', capacity_m3: 16.74, owner_phone: '+251954567890', notes: 'Tri-axle heavy dump' },
  { plate_number: 'OR67846', owner_name: 'Desta Lemma', capacity_m3: 16.14, owner_phone: '+251965678901', notes: 'Tandem aggregate tipper' },
  { plate_number: 'AA78956', owner_name: 'Girma Bekele', capacity_m3: 16.74, owner_phone: '+251976789012', notes: 'Tri-axle end dump' },
  { plate_number: 'AM89068', owner_name: 'Sewnet Ayele', capacity_m3: 16.14, owner_phone: '+251987890123', notes: 'Standard tandem dump' },
  { plate_number: 'TG90178', owner_name: 'Kidane Tesfay', capacity_m3: 16.74, owner_phone: '+251998901234', notes: 'Tri-axle heavy transport' },
  { plate_number: 'AA01289', owner_name: 'Mekdes Alemu', capacity_m3: 16.14, owner_phone: '+251909012345', notes: '2-axle tipper' },
  { plate_number: 'OR12390', owner_name: 'Tolosa Gemechu', capacity_m3: 16.74, owner_phone: '+251919123456', notes: 'Tri-axle dump' },
  { plate_number: 'AM23401', owner_name: 'Zelalem Tadesse', capacity_m3: 16.14, owner_phone: '+251929234567', notes: 'Tandem dump truck' },
  { plate_number: 'SN34512', owner_name: 'Wondimu Assefa', capacity_m3: 16.74, owner_phone: '+251939345678', notes: 'Heavy end tipper' },
  { plate_number: 'AA45623', owner_name: 'Birtukan Haile', capacity_m3: 16.14, owner_phone: '+251949456789', notes: 'Standard tipper' },
  { plate_number: 'OR56734', owner_name: 'Feyisa Deressa', capacity_m3: 16.74, owner_phone: '+251959567890', notes: 'Tri-axle tipper' },
  { plate_number: 'AM67845', owner_name: 'Endale Worku', capacity_m3: 16.14, owner_phone: '+251969678901', notes: 'Tandem gravel carrier' },
  { plate_number: 'AA78957', owner_name: 'Tigist Mekonnen', capacity_m3: 16.74, owner_phone: '+251979789012', notes: 'Tri-axle end dump' },
  { plate_number: 'TG89067', owner_name: 'Berhe Weldu', capacity_m3: 16.14, owner_phone: '+251989890123', notes: 'Tandem dump truck' },
  { plate_number: 'OR90178', owner_name: 'Guta Wakjira', capacity_m3: 16.74, owner_phone: '+251999901234', notes: 'Tri-axle heavy hauler' },
  { plate_number: 'AA01290', owner_name: 'Hana Girma', capacity_m3: 16.14, owner_phone: '+251910012345', notes: '2-axle tipper unit' }
];

export const SEED_COMPANIES: SeedCompany[] = [
  { name: 'Dugda Construction', contact_person: 'Eng. Engida', phone: '+25193532345', address: 'Bole, Addis Ababa' },
  { name: 'Midroc Ethiopia Construction', contact_person: 'Eng. Samuel Halala', phone: '+251911223344', address: 'Kirkos, Addis Ababa' },
  { name: 'Sunshine Construction', contact_person: 'Eng. Yonas Ayele', phone: '+251922334455', address: 'Bole, Addis Ababa' },
  { name: 'Tekleberhan Ambaye Construction', contact_person: 'Eng. Tekleberhan Ambaye', phone: '+251933445566', address: 'Yeka, Addis Ababa' },
  { name: 'Sur Construction', contact_person: 'Eng. Dawit Bekele', phone: '+251944556677', address: 'Nifas Silk, Addis Ababa' },
  { name: 'Ethiopian Construction Works Corporation', contact_person: 'Eng. Abera Mekonnen', phone: '+251955667788', address: 'Arada, Addis Ababa' },
  { name: 'Rama Construction', contact_person: 'Eng. Fikremariam Tadesse', phone: '+251966778899', address: 'Gulele, Addis Ababa' },
  { name: 'Flintstone Engineering', contact_person: 'Eng. Henok Girma', phone: '+251977889900', address: 'Lideta, Addis Ababa' },
  { name: 'Ovid Construction', contact_person: 'Eng. Mesfin Alemu', phone: '+251988990011', address: 'Bole, Addis Ababa' },
  { name: 'China Communications Construction (CCCC)', contact_person: 'Eng. Li Wei', phone: '+251999001122', address: 'Bole, Addis Ababa' },
  { name: 'CGCOC Ethiopia', contact_person: 'Eng. Zhang Ming', phone: '+251910112233', address: 'Kirkos, Addis Ababa' },
  { name: 'Ashewa Construction', contact_person: 'Eng. Getachew Assefa', phone: '+251921223344', address: 'Adama, Oromia' },
  { name: 'Alemayehu Ketema General Contractor', contact_person: 'Eng. Alemayehu Ketema', phone: '+251932334455', address: 'Bole, Addis Ababa' },
  { name: 'Haji Yassin Construction', contact_person: 'Eng. Yassin Mohammed', phone: '+251943445566', address: 'Dire Dawa' },
  { name: 'BAM International Ethiopia', contact_person: 'Eng. Pieter Van Dijk', phone: '+251954556677', address: 'Bole, Addis Ababa' },
  { name: 'Trans Ethiopian Construction', contact_person: 'Eng. Hailemariam Desalegn', phone: '+251965667788', address: 'Hawassa, Sidama' },
  { name: 'Yotek Construction', contact_person: 'Eng. Yohannes Tekle', phone: '+251976778899', address: 'Mekelle, Tigray' },
  { name: 'Gift Construction', contact_person: 'Eng. Solomon Tesfaye', phone: '+251987889900', address: 'Bahir Dar, Amhara' },
  { name: 'Tsehay Industry', contact_person: 'Eng. Tsehay Ayalew', phone: '+251998990011', address: 'Addis Ababa' },
  { name: 'Kefeta Construction', contact_person: 'Eng. Bantie Worku', phone: '+251909001122', address: 'Gondar, Amhara' },
  { name: 'Walia Construction', contact_person: 'Eng. Tariku Lemma', phone: '+251919112233', address: 'Addis Ababa' },
  { name: 'Zemen Construction', contact_person: 'Eng. Meron Hailu', phone: '+251929223344', address: 'Bole, Addis Ababa' },
  { name: 'Bedele Construction', contact_person: 'Eng. Girma Wakjira', phone: '+251939334455', address: 'Jimma, Oromia' },
  { name: 'Nib Insurance Construction', contact_person: 'Eng. Ato Berhanu', phone: '+251949445566', address: 'Kirkos, Addis Ababa' },
  { name: 'Afro-Tsion Construction', contact_person: 'Eng. Tsion Gebremariam', phone: '+251959556677', address: 'Addis Ababa' },
  { name: 'Hidase Construction', contact_person: 'Eng. Ayele Bekele', phone: '+251969667788', address: 'Hawassa, Sidama' },
  { name: 'Gedeb Engineering', contact_person: 'Eng. Feyisa Deressa', phone: '+251979778899', address: 'Adama, Oromia' },
  { name: 'Wonji Construction', contact_person: 'Eng. Lelisa Gemechu', phone: '+251989889900', address: 'Wonji, Oromia' },
  { name: 'Awash Construction', contact_person: 'Eng. Ahmed Nur', phone: '+251999990011', address: 'Awash, Afar' },
  { name: 'Moyale Construction', contact_person: 'Eng. Boru Guyo', phone: '+251910001122', address: 'Moyale, Oromia' },
  { name: 'Ethiopian Airlines', contact_person: 'Capt. Mesfin Tasew', phone: '+251911200000', address: 'Bole International Airport, Addis Ababa' }
];

export const SEED_CRUSHERS: SeedCrusher[] = [
  { name: 'TDT Crusher Plant', address: 'Sendafa', contact_person: 'Ato Ayele Kejela', phone: '+25197234543', lat: 9.1520, lng: 39.0230 },
  { name: 'HATI Crusher Facility', address: 'Aleltu', contact_person: 'Asnake Legesse', phone: '+25197234543', lat: 9.2050, lng: 39.1480 },
  { name: 'Jabi Construction Crusher', address: 'Aleltu', contact_person: 'Tekle basha', phone: '+25197234543', lat: 9.2150, lng: 39.1550 },
  { name: 'Tilaye Sand Quarry', address: 'Aleltu', contact_person: 'Tilaye kebede', phone: '+2519234534', lat: 9.1980, lng: 39.1350 },
  { name: 'Solsafe Crusher Station', address: 'Chole', contact_person: 'Solomon Seifu', phone: '+2519234534', lat: 8.7100, lng: 39.6100 },
  { name: 'Bezabih Aggregate Plant', address: 'Aleltu', contact_person: 'Bezabih Kebede', phone: '+251973123415', lat: 9.2200, lng: 39.1600 },
  { name: 'Batena Rock & Sand Crusher', address: 'Fiche', contact_person: 'Wegayew Werkiye', phone: '+25197234543', lat: 9.8050, lng: 38.7350 }
];

export const SEED_PROJECTS: SeedProject[] = [
  { project_name: 'Bishoftu Airlines Project', company_name: 'Ethiopian Airlines', address: 'Bishoftu', lat: 8.7520, lng: 38.9780 },
  { project_name: 'Bole Airport Expansion', company_name: 'Midroc Ethiopia Construction', address: 'Bole, Addis Ababa', lat: 8.9806, lng: 38.7994 },
  { project_name: 'Addis Ababa Light Rail Extension', company_name: 'Sunshine Construction', address: 'Kirkos, Addis Ababa', lat: 9.0100, lng: 38.7500 },
  { project_name: 'Meskel Square Grand Palace', company_name: 'Tekleberhan Ambaye Construction', address: 'Arada, Addis Ababa', lat: 9.0105, lng: 38.7636 },
  { project_name: 'Addis-Djibouti Railway Corridor', company_name: 'Sur Construction', address: 'Adama, Oromia', lat: 8.5400, lng: 39.2700 },
  { project_name: 'Grand Ethiopian Renaissance Dam Access Roads', company_name: 'Ethiopian Construction Works Corporation', address: 'Guba, Benishangul-Gumuz', lat: 11.2150, lng: 35.0920 },
  { project_name: 'Kazanchis Business Tower', company_name: 'Rama Construction', address: 'Kirkos, Addis Ababa', lat: 9.0180, lng: 38.7700 },
  { project_name: 'Entoto Park Development', company_name: 'Flintstone Engineering', address: 'Gulele, Addis Ababa', lat: 9.0850, lng: 38.7600 },
  { project_name: 'Addis Ababa Ring Road Phase IV', company_name: 'Ovid Construction', address: 'Nifas Silk, Addis Ababa', lat: 8.9600, lng: 38.7300 },
  { project_name: 'Modjo-Hawassa Expressway', company_name: 'China Communications Construction (CCCC)', address: 'Modjo, Oromia', lat: 8.5900, lng: 39.1200 },
  { project_name: 'Hawassa Industrial Park', company_name: 'CGCOC Ethiopia', address: 'Hawassa, Sidama', lat: 7.0500, lng: 38.4700 },
  { project_name: 'Adama Industrial Park', company_name: 'Ashewa Construction', address: 'Adama, Oromia', lat: 8.5500, lng: 39.2800 },
  { project_name: 'Dire Dawa-Dewale Railway', company_name: 'Alemayehu Ketema General Contractor', address: 'Dire Dawa', lat: 9.6000, lng: 41.8600 },
  { project_name: 'Dire Dawa Free Trade Zone', company_name: 'Haji Yassin Construction', address: 'Dire Dawa', lat: 9.6100, lng: 41.8700 },
  { project_name: 'Bole Lemi Industrial Park Phase II', company_name: 'BAM International Ethiopia', address: 'Bole, Addis Ababa', lat: 8.9600, lng: 38.8600 },
  { project_name: 'Hawassa Airport Upgrade', company_name: 'Trans Ethiopian Construction', address: 'Hawassa, Sidama', lat: 7.0600, lng: 38.4800 },
  { project_name: 'Mekelle Industrial Park', company_name: 'Yotek Construction', address: 'Mekelle, Tigray', lat: 13.4900, lng: 39.4700 },
  { project_name: 'Bahir Dar University Expansion', company_name: 'Gift Construction', address: 'Bahir Dar, Amhara', lat: 11.5900, lng: 37.3900 },
  { project_name: 'Tsehay Real Estate Complex', company_name: 'Tsehay Industry', address: 'Bole, Addis Ababa', lat: 8.9950, lng: 38.7850 },
  { project_name: 'Gondar University Teaching Hospital', company_name: 'Kefeta Construction', address: 'Gondar, Amhara', lat: 12.6000, lng: 37.4600 },
  { project_name: 'Walia Logistics Hub', company_name: 'Walia Construction', address: 'Lideta, Addis Ababa', lat: 9.0050, lng: 38.7350 },
  { project_name: 'Zemen Bank Headquarters', company_name: 'Zemen Construction', address: 'Bole, Addis Ababa', lat: 9.0150, lng: 38.7800 },
  { project_name: 'Jimma Agricultural Research Center', company_name: 'Bedele Construction', address: 'Jimma, Oromia', lat: 7.6700, lng: 36.8300 },
  { project_name: 'Nib Insurance Tower', company_name: 'Nib Insurance Construction', address: 'Kirkos, Addis Ababa', lat: 9.0120, lng: 38.7650 },
  { project_name: 'Afro-Tsion Commercial Center', company_name: 'Afro-Tsion Construction', address: 'Yeka, Addis Ababa', lat: 9.0300, lng: 38.7950 },
  { project_name: 'Sidama Regional Stadium', company_name: 'Hidase Construction', address: 'Hawassa, Sidama', lat: 7.0400, lng: 38.4900 },
  { project_name: 'Adama Science University Campus', company_name: 'Gedeb Engineering', address: 'Adama, Oromia', lat: 8.5600, lng: 39.2900 },
  { project_name: 'Wonji Sugar Factory Expansion', company_name: 'Wonji Construction', address: 'Wonji, Oromia', lat: 8.4500, lng: 39.2800 },
  { project_name: 'Awash-Woldia Railway Extension', company_name: 'Awash Construction', address: 'Awash, Afar', lat: 8.9900, lng: 40.1600 },
  { project_name: 'Moyale Border Trade Center', company_name: 'Moyale Construction', address: 'Moyale, Oromia', lat: 3.5300, lng: 39.0500 },
  { project_name: 'Dugda Industrial Complex', company_name: 'Dugda Construction', address: 'Bole, Addis Ababa', lat: 8.9700, lng: 38.8100 }
];

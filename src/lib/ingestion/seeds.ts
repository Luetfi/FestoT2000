// Seed query definitions for YouTube video discovery - server-only
// Keyword search queries targeting Festo products, problems, and interfaces
import 'server-only';

export interface SeedQuery {
  query: string;
  lang: 'de' | 'en';
}

/**
 * Seed queries for initial video corpus discovery
 * Each query is tagged with a relevanceLanguage to avoid running all queries twice.
 * - German-specific queries → lang: 'de'
 * - English-specific queries → lang: 'en'
 * - Product/interface queries → lang: 'de' (default, finds multilingual content)
 */
export const SEED_QUERIES: SeedQuery[] = [
  // Product families (de — YouTube surfaces both DE and EN results for product names)
  { query: 'Festo CPX', lang: 'de' },
  { query: 'Festo VTUG', lang: 'de' },
  { query: 'Festo MPA', lang: 'de' },
  { query: 'Festo CMMT-AS', lang: 'de' },
  { query: 'Festo CECC', lang: 'de' },
  { query: 'Festo CPX-AP', lang: 'de' },
  { query: 'Festo DSBC', lang: 'de' },
  { query: 'Festo VTEM', lang: 'de' },
  { query: 'Festo EHPS', lang: 'de' },

  // Problems (German)
  { query: 'Festo Druck baut sich nicht auf', lang: 'de' },
  { query: 'Festo startet nicht', lang: 'de' },
  { query: 'Festo Fehlercode', lang: 'de' },
  { query: 'Festo keine Kommunikation', lang: 'de' },
  { query: 'Festo Inbetriebnahme', lang: 'de' },

  // Problems (English)
  { query: 'Festo no pressure', lang: 'en' },
  { query: 'Festo error code', lang: 'en' },
  { query: 'Festo commissioning', lang: 'en' },

  // Interfaces (de — technical terms are universal)
  { query: 'Festo PROFINET', lang: 'de' },
  { query: 'Festo EtherNet/IP', lang: 'de' },
  { query: 'Festo IO-Link', lang: 'de' },

  // Specific combinations
  { query: 'CMMT-AS E123', lang: 'de' },
  { query: 'CPX valve terminal', lang: 'en' },

  // Tutorials & software
  { query: 'Festo Automation Suite', lang: 'de' },
  { query: 'Festo Handling Guide', lang: 'de' },

  // German terms
  { query: 'Festo Wartung', lang: 'de' },
  { query: 'Festo Konfiguration', lang: 'de' },
  { query: 'Festo Pneumatik', lang: 'de' },

  // English tutorials & guides
  { query: 'Festo tutorial English', lang: 'en' },
  { query: 'Festo commissioning guide', lang: 'en' },
  { query: 'Festo servo drive setup', lang: 'en' },
  { query: 'Festo pneumatic troubleshooting', lang: 'en' },
  { query: 'Festo valve terminal configuration', lang: 'en' },

  // English applications
  { query: 'Festo pneumatic cylinder tutorial', lang: 'en' },
  { query: 'Festo servo motor setup', lang: 'en' },
  { query: 'Festo gripper configuration', lang: 'en' },

  // Community discovery queries (broader terms to find third-party content)
  { query: 'FluidSIM Pneumatik Tutorial', lang: 'de' },
  { query: 'FluidSIM tutorial pneumatic circuit', lang: 'en' },
  { query: 'Elektropneumatik Tutorial Uebung', lang: 'de' },
  { query: 'MPS station PLC tutorial', lang: 'en' },
  { query: 'CODESYS Festo PLC Programmierung', lang: 'de' },
  { query: 'Festo TIA Portal PROFINET Siemens', lang: 'en' },
  { query: 'CMMT servo drive tutorial commissioning', lang: 'en' },
  { query: 'CIROS simulation Festo tutorial', lang: 'en' },
  { query: 'Pneumatikzylinder Wartung Dichtung', lang: 'de' },
  { query: 'pneumatic valve 5/2 way tutorial', lang: 'en' },
];

/**
 * Curated community video IDs for direct ingestion
 * Hand-picked from popular non-official YouTube channels
 * These bypass the search API (1 unit per video instead of 100 per query)
 */
export const COMMUNITY_VIDEO_IDS: string[] = [
  // -- FluidSIM Tutorials --
  'ajLRtRs92lY',  // Hegamurl - Pneumatics Basics FluidSIM Part 1
  '73KjKu2_WH0',  // Elex digiGuy - A+ B+ A- B- FluidSim
  '88RxsPRrulw',  // Pyae Htoo Khant - FluidSIM Pneumatic & Electrical Control
  'i-q5nKyfhvE',  // CHINMAY ACADEMY - Electro Pneumatic FluidSim
  'MoFnq-rYkyQ',  // Hegamurl - Electric Control FluidSIM
  '2CxYWda4OzY',  // Enginuity Hub - First Pneumatic System FluidSIM

  // -- Pneumatik & Elektropneumatik --
  'DxftV8vh2gk',  // Matthias Bachmann - TP201 Elektropneumatik (DE)
  'Fq3quAsiGJs',  // smiling-eye - Einfuehrung Elektropneumatik Teil 3 (DE)
  'W8lqzzx13Rg',  // EduVision - Elektropneumatik Praxis (DE)
  '_qNMpBMth8M',  // buschtorsten - Festo Elektropneumatik (DE)
  'c0El15iMr3s',  // Mat-mat Garcenila - Double acting cylinder tutorial

  // -- Ventile --
  'k_T5c27EhEw',  // Landefeld - 3/2 Wegeventile (DE)
  'AuYCtVOuP5k',  // Landefeld - 5/2-way valves
  'OA5Qt3Co1Ok',  // Landefeld - 5/3-way valves
  'kjDoKjm-vpc',  // Landefeld - UND-Ventil (DE)
  '9ECpbMYYTe4',  // Landefeld - How does a pneumatic cylinder work
  'GQkQfsUNcH4',  // Wolfgang Hesse - 5/2 Wegeventil (DE)

  // -- MPS Station / Mechatronik --
  'wGjJfqNJzjI',  // Electronics Engineering Guru - MPS Robot Tutorial
  '6sct2K-l8Dk',  // Sep - MPS Stations Full HD
  'HbcpN6Mzo8I',  // CL Mechatronics - MPS Sorting Station
  'TKy_tZEcopI',  // WMCP Lab - MPS Distribution complete cycle
  'bgRfz5uxOL4',  // Automate Stuff - MPS Handling and Sorting
  'dXjdZWDO2-E',  // john bill - PLC controlling MPS Distribution

  // -- CPX / Remote I/O --
  'qrWxQpD2q4k',  // Sebastian Balos - CPX-AP-I Walk Through
  'pWK2JhaGSFI',  // Jian Zang - CPX FB36 + Logix Designer
  '5EjWYjMPVh0',  // Mark Maginty - FST Project Creation CPX

  // -- CODESYS / PLC --
  'm0jHjJ131x4',  // CL Mechatronics - CODESYS CECCLK PLC Project
  'hJPrh-qF4hM',  // CODESYS North America - Deep Dive FESTO
  'AlaHP5TTsD4',  // omar osama - Electropneumatic process control CODESYS

  // -- TIA Portal / PROFINET / Siemens --
  'fILOUTwiEGw',  // Alberto Mercado - CPX-AP-I-PN + Siemens S71200
  'FQPy7gfInoA',  // EandM - VTUX + S7-1200 integration
  'LwXLMtmWh9g',  // zeller automation - CMMP AS PROFINET commissioning
  'YyV07-Zd8VQ',  // Alberto Mercado - CMMT-AS-PN + Siemens S7-1200

  // -- CMMT Servo --
  'zc_Z4w5z_JA',  // Jack Automation - CMMT Servo Config
  'YlcH9vVfUuk',  // Threes Soup01 - CMMT-ST commissioning tutorial
  'dai-xeIIO18',  // Threes Soup01 - CMMT-ST absolute positioning
  'c5OtKlNRxNE',  // Threes Soup01 - CMMT-ST jog operation

  // -- VTEM Motion Terminal --
  'EFeKd-lFL-A',  // Sebastian Balos - VTEM overview
  'K7wsRW8e3wU',  // Sandro Quintero - VTEM WebVisu

  // -- CIROS Simulation --
  'llwGnfrEPaI',  // VEROSIM Solutions - CIROS CP Factory
  'Q3efUItPWKE',  // Jose Maria Delgado - CIROS + TIA Portal
  'FDVxtAKTy9U',  // Talos Electronico - CIROS Fundamentals

  // -- Zylinder Wartung --
  '8tU8iB6D1lE',  // Sebastian Balos - DSNU Cylinder Setup
  '8-zr86wbWgw',  // Landefeld - Seal pneumatic cylinders
  'fP_tNYW6XGQ',  // Landefeld - Pneumatikzylinder einstellen (DE)

  // -- Industry 4.0 / Allgemein --
  'QA__3LXq1EY',  // CL Mechatronics - Electro-Pneumatics Intro
  'andW38zxavU',  // EandM - Compressed Air Preparation Webinar
];

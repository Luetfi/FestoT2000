/**
 * Comprehensive Festo product database
 *
 * Contains all major Festo product series with designations, descriptions,
 * categories, and search-relevant synonyms. Used to build the browse/filter
 * categories (PRODUCT_CATEGORIES) for the home page.
 *
 * Sources: Festo official catalog, product pages, and technical documentation.
 */

export interface FestoProduct {
  /** Product type designation (e.g. "DSBC") */
  type: string;
  /** Full product name in German */
  name_de: string;
  /** Full product name in English */
  name_en: string;
  /** Category ID for grouping */
  category: string;
  /** Additional search terms / synonyms (DE + EN mixed) */
  synonyms: string[];
}

export interface FestoProductCategory {
  id: string;
  label_de: string;
  label_en: string;
  /** General category-level search keywords */
  keywords: string[];
}

// ─── Product Categories ──────────────────────────────────────────────

export const FESTO_CATEGORIES: FestoProductCategory[] = [
  {
    id: 'pneumatic-cylinders',
    label_de: 'Pneumatische Zylinder',
    label_en: 'Pneumatic Cylinders',
    keywords: ['zylinder', 'cylinder', 'pneumatikzylinder', 'kolbenstange', 'piston rod', 'hub', 'stroke'],
  },
  {
    id: 'electric-actuators',
    label_de: 'Elektrische Antriebe',
    label_en: 'Electric Actuators',
    keywords: ['elektrisch', 'electric', 'elektrozylinder', 'spindelantrieb', 'spindle', 'zahnriemen', 'toothed belt', 'linearachse', 'linear axis'],
  },
  {
    id: 'motors-drives',
    label_de: 'Motoren und Antriebsregler',
    label_en: 'Motors and Servo Drives',
    keywords: ['motor', 'servo', 'servomotor', 'antriebsregler', 'drive controller', 'servoantrieb', 'frequenzumrichter'],
  },
  {
    id: 'grippers',
    label_de: 'Greifer',
    label_en: 'Grippers',
    keywords: ['greifer', 'gripper', 'greifen', 'gripping', 'parallelgreifer', 'parallel gripper', 'winkelgreifer', 'angular gripper', 'radialgreifer'],
  },
  {
    id: 'rotary-actuators',
    label_de: 'Schwenkantriebe und Drehantriebe',
    label_en: 'Rotary and Swivel Actuators',
    keywords: ['schwenkantrieb', 'drehantrieb', 'rotary', 'swivel', 'drehen', 'schwenken', 'rotation'],
  },
  {
    id: 'vacuum',
    label_de: 'Vakuumtechnik',
    label_en: 'Vacuum Technology',
    keywords: ['vakuum', 'vacuum', 'sauger', 'suction', 'sauggreifer', 'saugnapf', 'suction cup', 'ejektor', 'ejector', 'vakuumerzeuger', 'vacuum generator'],
  },
  {
    id: 'valves',
    label_de: 'Ventile',
    label_en: 'Valves',
    keywords: ['ventil', 'valve', 'magnetventil', 'solenoid valve', 'wegeventil', 'directional valve', 'proportionalventil', 'proportional valve'],
  },
  {
    id: 'valve-terminals',
    label_de: 'Ventilinseln',
    label_en: 'Valve Terminals',
    keywords: ['ventilinsel', 'valve terminal', 'valve manifold', 'ventilbatterie'],
  },
  {
    id: 'motion-terminal',
    label_de: 'Motion Terminal',
    label_en: 'Motion Terminal',
    keywords: ['motion terminal', 'motion app', 'digitalisierte pneumatik', 'digitized pneumatics', 'VTEM'],
  },
  {
    id: 'sensors',
    label_de: 'Sensoren',
    label_en: 'Sensors',
    keywords: ['sensor', 'näherungsschalter', 'proximity', 'drucksensor', 'pressure sensor', 'endlagensensor', 'positionssensor', 'position sensor', 'durchflusssensor', 'flow sensor'],
  },
  {
    id: 'air-preparation',
    label_de: 'Druckluftaufbereitung',
    label_en: 'Compressed Air Preparation',
    keywords: ['druckluft', 'compressed air', 'air preparation', 'wartungseinheit', 'service unit', 'filter', 'regler', 'regulator', 'öler', 'lubricator', 'trockner', 'dryer'],
  },
  {
    id: 'connection-technology',
    label_de: 'Verbindungstechnik',
    label_en: 'Connection Technology',
    keywords: ['verbindung', 'connection', 'fitting', 'schlauch', 'tubing', 'steckverbindung', 'push-in', 'verschraubung', 'anschluss', 'kabel', 'cable', 'stecker', 'connector'],
  },
  {
    id: 'controls-io',
    label_de: 'Steuerungstechnik und Remote I/O',
    label_en: 'Control Technology and Remote I/O',
    keywords: ['steuerung', 'controller', 'plc', 'sps', 'remote i/o', 'remote io', 'dezentral', 'decentralized', 'feldbusknoten', 'fieldbus', 'io-link'],
  },
  {
    id: 'software',
    label_de: 'Software und Engineering Tools',
    label_en: 'Software and Engineering Tools',
    keywords: ['software', 'tool', 'engineering', 'inbetriebnahme', 'commissioning', 'parametrierung', 'configuration', 'programmierung', 'programming'],
  },
  {
    id: 'handling-systems',
    label_de: 'Handhabungssysteme',
    label_en: 'Handling Systems',
    keywords: ['handling', 'handhabung', 'portalsystem', 'gantry', 'roboter', 'robot', 'pick and place', 'kartesisch', 'cartesian'],
  },
  {
    id: 'process-automation',
    label_de: 'Prozessautomation',
    label_en: 'Process Automation',
    keywords: ['prozessautomation', 'process automation', 'prozessventil', 'process valve', 'stellungsregler', 'positioner'],
  },
  {
    id: 'accessories',
    label_de: 'Zubehör und Befestigung',
    label_en: 'Accessories and Mounting',
    keywords: ['zubehör', 'accessories', 'befestigung', 'mounting', 'adapter', 'halter', 'bracket', 'endlage', 'stopper'],
  },
  {
    id: 'didactic',
    label_de: 'Festo Didactic / Schulung',
    label_en: 'Festo Didactic / Training',
    keywords: ['didactic', 'schulung', 'training', 'lernsystem', 'learning system', 'ausbildung', 'education', 'MPS', 'CP Factory', 'CP Lab'],
  },
];

// ─── Complete Product Database ───────────────────────────────────────

export const FESTO_PRODUCTS: FestoProduct[] = [
  // ── Pneumatic Cylinders: Standards-based (ISO 15552) ──
  { type: 'DSBC', name_de: 'Normzylinder', name_en: 'Standards-based cylinder', category: 'pneumatic-cylinders', synonyms: ['ISO 15552', 'Profilzylinder', 'PPS', 'Endlagendämpfung', 'cushioning'] },
  { type: 'DSBG', name_de: 'Normzylinder (groß)', name_en: 'Standards-based cylinder (large)', category: 'pneumatic-cylinders', synonyms: ['ISO 15552', 'großer Zylinder', 'big bore'] },
  { type: 'DSBF', name_de: 'Normzylinder (Edelstahl)', name_en: 'Standards-based cylinder (stainless)', category: 'pneumatic-cylinders', synonyms: ['ISO 15552', 'Edelstahl', 'stainless steel', 'clean design', 'hygienisch'] },
  { type: 'DNC', name_de: 'Normzylinder (Vorgänger)', name_en: 'Standards-based cylinder (legacy)', category: 'pneumatic-cylinders', synonyms: ['ISO 15552'] },
  { type: 'DNCB', name_de: 'Normzylinder (Vorgänger)', name_en: 'Standards-based cylinder (legacy)', category: 'pneumatic-cylinders', synonyms: ['ISO 15552'] },
  { type: 'CRDNG', name_de: 'Normzylinder mit Dreh- und Feststelleinheit', name_en: 'Standards-based cylinder with locking unit', category: 'pneumatic-cylinders', synonyms: ['Feststelleinheit', 'locking', 'Dreheinheit'] },

  // ── Pneumatic Cylinders: Round (ISO 6432) ──
  { type: 'DSNU', name_de: 'Rundzylinder', name_en: 'Round cylinder', category: 'pneumatic-cylinders', synonyms: ['ISO 6432', 'Rundzylinder', 'round body'] },
  { type: 'DSNU-S', name_de: 'Rundzylinder (kompakt)', name_en: 'Round cylinder (compact)', category: 'pneumatic-cylinders', synonyms: ['ISO 6432', 'kompakt', 'compact round'] },
  { type: 'CRDSNU', name_de: 'Rundzylinder mit Dreh- und Feststelleinheit', name_en: 'Round cylinder with locking unit', category: 'pneumatic-cylinders', synonyms: ['Feststelleinheit', 'locking'] },
  { type: 'DSN', name_de: 'Rundzylinder (Vorgänger)', name_en: 'Round cylinder (legacy)', category: 'pneumatic-cylinders', synonyms: ['ISO 6432'] },
  { type: 'ESNU', name_de: 'Rundzylinder (Edelstahl)', name_en: 'Round cylinder (stainless)', category: 'pneumatic-cylinders', synonyms: ['ISO 6432', 'Edelstahl', 'stainless'] },

  // ── Pneumatic Cylinders: Compact ──
  { type: 'ADN', name_de: 'Kompaktzylinder', name_en: 'Compact cylinder', category: 'pneumatic-cylinders', synonyms: ['ISO 21287', 'kompakt', 'compact', 'flach', 'short stroke'] },
  { type: 'ADNG', name_de: 'Kompaktzylinder (große Kolbenstange)', name_en: 'Compact cylinder (large rod)', category: 'pneumatic-cylinders', synonyms: ['ISO 21287', 'kompakt'] },
  { type: 'ADN-S', name_de: 'Kompaktzylinder (kompakte Bauform)', name_en: 'Compact cylinder (compact design)', category: 'pneumatic-cylinders', synonyms: ['ISO 21287', 'kompakt'] },
  { type: 'AEN', name_de: 'Kompaktzylinder (Edelstahl)', name_en: 'Compact cylinder (stainless)', category: 'pneumatic-cylinders', synonyms: ['ISO 21287', 'Edelstahl', 'stainless'] },
  { type: 'ADVU', name_de: 'Kompaktzylinder (Vorgänger)', name_en: 'Compact cylinder (legacy)', category: 'pneumatic-cylinders', synonyms: ['kompakt'] },
  { type: 'ADVUL', name_de: 'Kompaktzylinder (verdrehgesichert)', name_en: 'Compact cylinder (non-rotating)', category: 'pneumatic-cylinders', synonyms: ['verdrehgesichert', 'non-rotating'] },
  { type: 'AEVC', name_de: 'Kurzhubzylinder', name_en: 'Short-stroke cylinder', category: 'pneumatic-cylinders', synonyms: ['Kurzhub', 'short stroke'] },
  { type: 'ADVC', name_de: 'Kurzhubzylinder', name_en: 'Short-stroke cylinder', category: 'pneumatic-cylinders', synonyms: ['Kurzhub', 'short stroke'] },

  // ── Pneumatic Cylinders: Guided ──
  { type: 'DFM', name_de: 'Führungszylinder', name_en: 'Guided cylinder', category: 'pneumatic-cylinders', synonyms: ['Führung', 'guided', 'Doppelkolben', 'twin piston', 'verdrehsicher'] },
  { type: 'DGST', name_de: 'Minischlitten', name_en: 'Mini slide', category: 'pneumatic-cylinders', synonyms: ['Schlitten', 'slide', 'Linearführung', 'linear guide'] },
  { type: 'DGSL', name_de: 'Minischlitten', name_en: 'Mini slide', category: 'pneumatic-cylinders', synonyms: ['Schlitten', 'slide', 'Linearführung'] },
  { type: 'DGC', name_de: 'Linearantrieb', name_en: 'Linear actuator', category: 'pneumatic-cylinders', synonyms: ['kolbenstangenlos', 'rodless', 'Linearantrieb'] },
  { type: 'DGPI', name_de: 'Linearantrieb (Kolbenstangenlos)', name_en: 'Linear actuator (rodless)', category: 'pneumatic-cylinders', synonyms: ['kolbenstangenlos', 'rodless'] },

  // ── Pneumatic Cylinders: Flat / Special ──
  { type: 'DZF', name_de: 'Flachzylinder', name_en: 'Flat cylinder', category: 'pneumatic-cylinders', synonyms: ['flach', 'flat', 'niedrig', 'low profile'] },
  { type: 'DZH', name_de: 'Flachzylinder', name_en: 'Flat cylinder', category: 'pneumatic-cylinders', synonyms: ['flach', 'flat'] },
  { type: 'EZH', name_de: 'Flachzylinder (Edelstahl)', name_en: 'Flat cylinder (stainless)', category: 'pneumatic-cylinders', synonyms: ['flach', 'Edelstahl', 'stainless'] },
  { type: 'DPDM', name_de: 'Druckbegrenzer', name_en: 'Pressure booster', category: 'pneumatic-cylinders', synonyms: ['Druckverstärker', 'pressure booster', 'Tandem'] },

  // ── Pneumatic Cylinders: Clamping / Stopper ──
  { type: 'DFSP', name_de: 'Stopperzylinder', name_en: 'Stopper cylinder', category: 'pneumatic-cylinders', synonyms: ['Stopper', 'stopper', 'Dämpfer', 'Förderband', 'conveyor'] },
  { type: 'DFLC', name_de: 'Spannzylinder', name_en: 'Clamping cylinder', category: 'pneumatic-cylinders', synonyms: ['Spannen', 'clamping', 'Klemmen'] },
  { type: 'DFLG', name_de: 'Spannzylinder', name_en: 'Clamping cylinder', category: 'pneumatic-cylinders', synonyms: ['Spannen', 'clamping'] },
  { type: 'CLR', name_de: 'Hebelspanner', name_en: 'Lever clamp', category: 'pneumatic-cylinders', synonyms: ['Hebelspanner', 'toggle clamp', 'Spannvorrichtung'] },

  // ── Pneumatic Cylinders: Bellows / Membrane ──
  { type: 'EB', name_de: 'Balgzylinder', name_en: 'Bellows cylinder', category: 'pneumatic-cylinders', synonyms: ['Balg', 'bellows'] },

  // ── Rotary / Swivel Actuators ──
  { type: 'DRQD', name_de: 'Schwenkantrieb', name_en: 'Rotary actuator', category: 'rotary-actuators', synonyms: ['Schwenk', 'rotary', 'quarter turn', 'Vierteldrehung'] },
  { type: 'DRRD', name_de: 'Schwenkantrieb (Zahnstange)', name_en: 'Rotary actuator (rack & pinion)', category: 'rotary-actuators', synonyms: ['Zahnstange', 'rack and pinion'] },
  { type: 'DSR', name_de: 'Schwenkantrieb', name_en: 'Semi-rotary drive', category: 'rotary-actuators', synonyms: ['Schwenk', 'semi-rotary', 'Flügelzelle', 'vane'] },
  { type: 'DSM', name_de: 'Schwenkantrieb (Flügelzelle)', name_en: 'Semi-rotary drive (vane)', category: 'rotary-actuators', synonyms: ['Flügelzelle', 'vane'] },
  { type: 'DRVS', name_de: 'Schwenkantrieb (Edelstahl)', name_en: 'Semi-rotary drive (stainless)', category: 'rotary-actuators', synonyms: ['Edelstahl', 'stainless', 'Schwenk'] },
  { type: 'ERMO', name_de: 'Elektrischer Drehantrieb', name_en: 'Electric rotary actuator', category: 'rotary-actuators', synonyms: ['elektrisch', 'electric', 'Drehantrieb'] },
  { type: 'ERMB', name_de: 'Elektrisches Drehmodul', name_en: 'Electric rotary module', category: 'rotary-actuators', synonyms: ['Drehmodul', 'rotary module'] },
  { type: 'EHMB', name_de: 'Elektrisches Dreh-/Hubmodul', name_en: 'Electric rotary/lifting module', category: 'rotary-actuators', synonyms: ['Dreh-Hub', 'rotary lifting'] },

  // ── Electric Actuators: Cylinders ──
  { type: 'EPCO', name_de: 'Elektrozylinder', name_en: 'Electric cylinder', category: 'electric-actuators', synonyms: ['Elektrozylinder', 'electric cylinder', 'Spindel', 'spindle'] },
  { type: 'EPCS', name_de: 'Elektrozylindereinheit', name_en: 'Electric cylinder unit', category: 'electric-actuators', synonyms: ['Elektrozylinder', 'Kugelgewindetrieb', 'ball screw'] },
  { type: 'ESBF', name_de: 'Elektrozylinder (Spindelantrieb)', name_en: 'Electric cylinder (spindle)', category: 'electric-actuators', synonyms: ['Spindel', 'spindle', 'Elektrozylinder'] },
  { type: 'ESBH', name_de: 'Elektrozylinder (Hochlast)', name_en: 'Electric cylinder (heavy-duty)', category: 'electric-actuators', synonyms: ['Hochlast', 'heavy duty'] },

  // ── Electric Actuators: Axes ──
  { type: 'EGC', name_de: 'Spindelachse / Zahnriemenachse', name_en: 'Spindle axis / toothed belt axis', category: 'electric-actuators', synonyms: ['Achse', 'axis', 'Spindel', 'Zahnriemen', 'toothed belt'] },
  { type: 'EGC-BS', name_de: 'Spindelachse', name_en: 'Ball screw axis', category: 'electric-actuators', synonyms: ['Kugelgewindespindel', 'ball screw axis'] },
  { type: 'EGC-TB', name_de: 'Zahnriemenachse', name_en: 'Toothed belt axis', category: 'electric-actuators', synonyms: ['Zahnriemen', 'toothed belt'] },
  { type: 'EGC-HD', name_de: 'Achse (Heavy Duty)', name_en: 'Axis (heavy duty)', category: 'electric-actuators', synonyms: ['Hochlast', 'heavy duty'] },
  { type: 'EGSC', name_de: 'Elektrischer Minischlitten', name_en: 'Electric mini slide', category: 'electric-actuators', synonyms: ['Minischlitten', 'mini slide', 'elektrisch'] },
  { type: 'EGSK', name_de: 'Elektrischer Schlitten', name_en: 'Electric slide', category: 'electric-actuators', synonyms: ['Schlitten', 'slide'] },
  { type: 'ELGA', name_de: 'Zahnriemenachse', name_en: 'Toothed belt axis', category: 'electric-actuators', synonyms: ['Zahnriemen', 'toothed belt', 'Achse', 'axis'] },
  { type: 'ELGA-TB', name_de: 'Zahnriemenachse', name_en: 'Toothed belt axis', category: 'electric-actuators', synonyms: ['Zahnriemen', 'toothed belt'] },
  { type: 'ELGR', name_de: 'Zahnriemenachse (Präzision)', name_en: 'Toothed belt axis (precision)', category: 'electric-actuators', synonyms: ['Präzision', 'precision', 'Zahnriemen'] },
  { type: 'ELGC', name_de: 'Elektrische Achse (kompakt)', name_en: 'Electric axis (compact)', category: 'electric-actuators', synonyms: ['kompakt', 'compact', 'Achse'] },
  { type: 'ELFC', name_de: 'Elektrischer Zylinder', name_en: 'Electric cylinder', category: 'electric-actuators', synonyms: ['Elektrozylinder', 'electric cylinder'] },
  { type: 'DGEA', name_de: 'Elektrische Linearführung', name_en: 'Electric linear guide', category: 'electric-actuators', synonyms: ['Linearführung', 'linear guide'] },

  // ── Motors and Servo Drives ──
  { type: 'CMMT-AS', name_de: 'Servoantriebsregler', name_en: 'Servo drive controller', category: 'motors-drives', synonyms: ['Servoantrieb', 'servo drive', 'Antriebsregler', 'drive controller', 'Achsregler', 'axis controller'] },
  { type: 'CMMT-ST', name_de: 'Servoantriebsregler (Niederspannung)', name_en: 'Servo drive controller (low voltage)', category: 'motors-drives', synonyms: ['Niederspannung', 'low voltage', '24V', '48V', 'Servoantrieb'] },
  { type: 'CMMT-MP', name_de: 'Servoantriebsregler (Multi-Protocol)', name_en: 'Servo drive (multi-protocol)', category: 'motors-drives', synonyms: ['Multi-Protocol', 'multi protocol', 'Mehrachse'] },
  { type: 'CMMP-AS', name_de: 'Motorcontroller (Vorgänger)', name_en: 'Motor controller (legacy)', category: 'motors-drives', synonyms: ['Motorcontroller'] },
  { type: 'EMMT-AS', name_de: 'Servomotor', name_en: 'Servo motor', category: 'motors-drives', synonyms: ['Servomotor', 'servo motor', 'Motor'] },
  { type: 'EMMT', name_de: 'Servomotor', name_en: 'Servo motor', category: 'motors-drives', synonyms: ['Servomotor', 'servo motor'] },
  { type: 'EMME-AS', name_de: 'Servomotor (kompakt)', name_en: 'Servo motor (compact)', category: 'motors-drives', synonyms: ['kompakt', 'compact', 'Servomotor'] },
  { type: 'EMMS-AS', name_de: 'Schrittmotor', name_en: 'Stepper motor', category: 'motors-drives', synonyms: ['Schrittmotor', 'stepper motor', 'Schrittantrieb'] },
  { type: 'EMMS-ST', name_de: 'Schrittmotor', name_en: 'Stepper motor', category: 'motors-drives', synonyms: ['Schrittmotor', 'stepper'] },
  { type: 'EMCA', name_de: 'Integrierter Antrieb', name_en: 'Integrated drive', category: 'motors-drives', synonyms: ['integriert', 'integrated', 'Motor mit Regler'] },

  // ── Grippers ──
  { type: 'DHPS', name_de: 'Pneumatischer Parallelgreifer', name_en: 'Pneumatic parallel gripper', category: 'grippers', synonyms: ['Parallelgreifer', 'parallel gripper', 'pneumatisch'] },
  { type: 'DHRS', name_de: 'Pneumatischer Radialgreifer', name_en: 'Pneumatic radial gripper', category: 'grippers', synonyms: ['Radialgreifer', 'radial gripper'] },
  { type: 'DHWS', name_de: 'Pneumatischer Winkelgreifer', name_en: 'Pneumatic angular gripper', category: 'grippers', synonyms: ['Winkelgreifer', 'angular gripper'] },
  { type: 'EHPS', name_de: 'Elektrischer Parallelgreifer', name_en: 'Electric parallel gripper', category: 'grippers', synonyms: ['elektrisch', 'electric', 'Parallelgreifer'] },
  { type: 'HGPL', name_de: 'Parallelgreifer (Langhub)', name_en: 'Parallel gripper (long stroke)', category: 'grippers', synonyms: ['Langhub', 'long stroke', 'Parallelgreifer'] },
  { type: 'HGPT', name_de: 'Parallelgreifer (Dreifingergreifer)', name_en: 'Three-finger gripper', category: 'grippers', synonyms: ['Dreifinger', 'three finger', 'Zentriergreifer', 'centering'] },
  { type: 'HGPP', name_de: 'Parallelgreifer (Präzision)', name_en: 'Parallel gripper (precision)', category: 'grippers', synonyms: ['Präzision', 'precision', 'Parallelgreifer'] },
  { type: 'HGPC', name_de: 'Parallelgreifer (Reinraum)', name_en: 'Parallel gripper (cleanroom)', category: 'grippers', synonyms: ['Reinraum', 'cleanroom', 'ISO Klasse'] },
  { type: 'HGPM', name_de: 'Parallelgreifer (Mikro)', name_en: 'Parallel gripper (micro)', category: 'grippers', synonyms: ['Mikro', 'micro', 'klein', 'small'] },
  { type: 'HGRC', name_de: 'Radialgreifer', name_en: 'Radial gripper', category: 'grippers', synonyms: ['Radialgreifer', 'radial gripper'] },
  { type: 'DHEB', name_de: 'Elektrischer Balkengreifer', name_en: 'Electric T-slot gripper', category: 'grippers', synonyms: ['Balkengreifer', 'T-slot', 'elektrisch'] },
  { type: 'HGDS', name_de: 'Greifer (Direktmontage)', name_en: 'Gripper (direct mount)', category: 'grippers', synonyms: ['Direktmontage', 'direct mount'] },

  // ── Vacuum Technology ──
  { type: 'OVEM', name_de: 'Vakuumerzeuger (kompakt)', name_en: 'Compact vacuum generator', category: 'vacuum', synonyms: ['Vakuumerzeuger', 'vacuum generator', 'Ejektor', 'ejector', 'kompakt'] },
  { type: 'OVEL', name_de: 'Vakuumerzeuger (leicht)', name_en: 'Lightweight vacuum generator', category: 'vacuum', synonyms: ['Vakuumerzeuger', 'leicht', 'lightweight'] },
  { type: 'VADM', name_de: 'Vakuumerzeuger', name_en: 'Vacuum generator', category: 'vacuum', synonyms: ['Vakuumerzeuger', 'vacuum generator'] },
  { type: 'VADMI', name_de: 'Vakuumerzeuger (integriert)', name_en: 'Vacuum generator (integrated)', category: 'vacuum', synonyms: ['Vakuumerzeuger', 'integriert', 'integrated'] },
  { type: 'VN', name_de: 'Vakuumsaugdüse', name_en: 'Vacuum generator (inline)', category: 'vacuum', synonyms: ['Saugdüse', 'inline', 'T-Form'] },
  { type: 'ESG', name_de: 'Sauggreifer (modular)', name_en: 'Suction cup (modular)', category: 'vacuum', synonyms: ['Sauggreifer', 'suction cup', 'Saugnapf', 'modular'] },
  { type: 'ESS', name_de: 'Saugnapf', name_en: 'Vacuum suction cup', category: 'vacuum', synonyms: ['Saugnapf', 'suction cup', 'Vakuumsauger'] },
  { type: 'VASB', name_de: 'Vakuumsauger (Spezial)', name_en: 'Vacuum suction cup (special)', category: 'vacuum', synonyms: ['Spezial', 'special', 'Vakuumsauger'] },

  // ── Valves: Individual ──
  { type: 'VUVG', name_de: 'Magnetventil (kompakt)', name_en: 'Solenoid valve (compact)', category: 'valves', synonyms: ['Magnetventil', 'solenoid valve', 'kompakt', 'compact'] },
  { type: 'VUVS', name_de: 'Magnetventil (robust)', name_en: 'Solenoid valve (robust)', category: 'valves', synonyms: ['Magnetventil', 'solenoid valve', 'robust'] },
  { type: 'VSVA', name_de: 'Magnetventil', name_en: 'Solenoid valve', category: 'valves', synonyms: ['Magnetventil', 'solenoid valve'] },
  { type: 'VZWD', name_de: 'Proportional-Druckregelventil', name_en: 'Proportional pressure regulating valve', category: 'valves', synonyms: ['Proportional', 'proportional', 'Druckregelung', 'pressure regulation'] },
  { type: 'VPPM', name_de: 'Proportional-Druckregelventil', name_en: 'Proportional pressure regulating valve', category: 'valves', synonyms: ['Proportional', 'Druckregelung'] },
  { type: 'MPYE', name_de: 'Proportional-Wegeventil', name_en: 'Proportional directional control valve', category: 'valves', synonyms: ['Proportional', 'Wegeventil', 'directional'] },
  { type: 'VPCF', name_de: 'Proportional-Durchflussventil', name_en: 'Proportional flow control valve', category: 'valves', synonyms: ['Proportional', 'Durchfluss', 'flow control'] },
  { type: 'GRLA', name_de: 'Drosselrückschlagventil', name_en: 'One-way flow control valve', category: 'valves', synonyms: ['Drossel', 'Rückschlag', 'Drosselventil', 'flow control', 'throttle'] },
  { type: 'GR', name_de: 'Drossel', name_en: 'Throttle valve', category: 'valves', synonyms: ['Drossel', 'throttle'] },
  { type: 'HGL', name_de: 'Rückschlagventil', name_en: 'Non-return valve', category: 'valves', synonyms: ['Rückschlagventil', 'non-return', 'check valve'] },
  { type: 'HE', name_de: 'Einschaltventil', name_en: 'On/off valve', category: 'valves', synonyms: ['Einschaltventil', 'on off', 'Absperrventil', 'shut-off'] },
  { type: 'HEE', name_de: 'Einschaltventil (Soft-Start)', name_en: 'Soft-start valve', category: 'valves', synonyms: ['Soft-Start', 'soft start', 'Langsamstart'] },
  { type: 'HEL', name_de: 'Einschaltventil (Druckentlastung)', name_en: 'Pressure relief valve', category: 'valves', synonyms: ['Druckentlastung', 'pressure relief', 'Entlüftung', 'exhaust'] },
  { type: 'VABF', name_de: 'Reglerplatte', name_en: 'Regulator plate', category: 'valves', synonyms: ['Reglerplatte', 'regulator plate'] },
  { type: 'MFH', name_de: 'Magnetventil (Vorgänger)', name_en: 'Solenoid valve (legacy)', category: 'valves', synonyms: ['Tiger', 'Magnetventil'] },
  { type: 'MEBH', name_de: 'Magnetventil (Vorgänger)', name_en: 'Solenoid valve (legacy)', category: 'valves', synonyms: ['Magnetventil'] },

  // ── Valve Terminals / Islands ──
  { type: 'VTUG', name_de: 'Ventilinsel', name_en: 'Valve terminal', category: 'valve-terminals', synonyms: ['Ventilinsel', 'valve terminal', 'kompakt'] },
  { type: 'VTSA', name_de: 'Ventilinsel', name_en: 'Valve terminal', category: 'valve-terminals', synonyms: ['Ventilinsel', 'valve terminal'] },
  { type: 'VTOC', name_de: 'Ventilinsel', name_en: 'Valve terminal', category: 'valve-terminals', synonyms: ['Ventilinsel', 'valve terminal'] },
  { type: 'MPA-S', name_de: 'Ventilinsel (schlank)', name_en: 'Valve terminal (slim)', category: 'valve-terminals', synonyms: ['Ventilinsel', 'slim', 'schlank'] },
  { type: 'MPA-L', name_de: 'Ventilinsel (Leistung)', name_en: 'Valve terminal (performance)', category: 'valve-terminals', synonyms: ['Ventilinsel', 'performance', 'Leistung'] },
  { type: 'CPX-GE', name_de: 'Ventilinsel (CPX)', name_en: 'CPX valve terminal', category: 'valve-terminals', synonyms: ['CPX', 'Ventilinsel'] },

  // ── Motion Terminal ──
  { type: 'VTEM', name_de: 'Motion Terminal', name_en: 'Motion Terminal', category: 'motion-terminal', synonyms: ['Motion Terminal', 'Motion App', 'digitalisiert', 'digitized', 'programmierbar', 'programmable', 'Piezoventil', 'piezo valve'] },
  { type: 'VAEM', name_de: 'Motion Terminal Modul', name_en: 'Motion Terminal module', category: 'motion-terminal', synonyms: ['Motion Terminal', 'Modul', 'Erweiterung'] },

  // ── Sensors: Proximity ──
  { type: 'SIEN', name_de: 'Näherungssensor (induktiv, rund)', name_en: 'Proximity sensor (inductive, round)', category: 'sensors', synonyms: ['Näherungssensor', 'proximity sensor', 'induktiv', 'inductive', 'rund'] },
  { type: 'SIED', name_de: 'Näherungssensor (induktiv, rund)', name_en: 'Proximity sensor (inductive, round)', category: 'sensors', synonyms: ['Näherungssensor', 'induktiv', 'inductive'] },
  { type: 'SIES', name_de: 'Näherungssensor (induktiv, Block)', name_en: 'Proximity sensor (inductive, block)', category: 'sensors', synonyms: ['Näherungssensor', 'induktiv', 'Block', 'block shape'] },
  { type: 'SIEF', name_de: 'Näherungssensor (induktiv, flach)', name_en: 'Proximity sensor (inductive, flat)', category: 'sensors', synonyms: ['Näherungssensor', 'induktiv', 'flach', 'flat'] },
  { type: 'SIEH', name_de: 'Näherungssensor (induktiv, Hochdruck)', name_en: 'Proximity sensor (inductive, high pressure)', category: 'sensors', synonyms: ['Hochdruck', 'high pressure', 'induktiv'] },

  // ── Sensors: Pressure ──
  { type: 'SPAU', name_de: 'Drucksensor', name_en: 'Pressure sensor', category: 'sensors', synonyms: ['Drucksensor', 'pressure sensor', 'Druckschalter', 'pressure switch'] },
  { type: 'SPAN', name_de: 'Drucksensor (kompakt)', name_en: 'Pressure sensor (compact)', category: 'sensors', synonyms: ['Drucksensor', 'pressure sensor', 'kompakt'] },
  { type: 'SPAB', name_de: 'Drucksensor (Basic)', name_en: 'Pressure sensor (basic)', category: 'sensors', synonyms: ['Drucksensor', 'basic'] },
  { type: 'SPAW', name_de: 'Drucksensor', name_en: 'Pressure sensor', category: 'sensors', synonyms: ['Drucksensor', 'pressure sensor'] },
  { type: 'SDE5', name_de: 'Drucksensor (Vorgänger)', name_en: 'Pressure sensor (legacy)', category: 'sensors', synonyms: ['Drucksensor'] },

  // ── Sensors: Position / Cylinder Switches ──
  { type: 'SME', name_de: 'Zylinderschalter (Näherung)', name_en: 'Proximity sensor (for cylinders)', category: 'sensors', synonyms: ['Zylinderschalter', 'cylinder switch', 'Endlage', 'end position', 'Reed'] },
  { type: 'SMT', name_de: 'Zylinderschalter (T-Nut)', name_en: 'Proximity sensor (T-slot)', category: 'sensors', synonyms: ['Zylinderschalter', 'T-Nut', 'T-slot'] },
  { type: 'SRBS', name_de: 'Drehwinkelsensor', name_en: 'Rotary position sensor', category: 'sensors', synonyms: ['Drehwinkel', 'rotary position', 'Schwenkantrieb'] },
  { type: 'SDAT', name_de: 'Positionssensor (Wegaufnehmer)', name_en: 'Position transmitter', category: 'sensors', synonyms: ['Positionssensor', 'position transmitter', 'Wegaufnehmer', 'displacement'] },
  { type: 'SDAP', name_de: 'Positionssensor', name_en: 'Position sensor', category: 'sensors', synonyms: ['Positionssensor', 'position sensor'] },

  // ── Sensors: Optical ──
  { type: 'SOEG', name_de: 'Optischer Sensor', name_en: 'Optical sensor', category: 'sensors', synonyms: ['optisch', 'optical', 'Lichtschranke', 'photo sensor', 'Einweglichtschranke', 'through beam', 'Reflexlichtschranke', 'retro-reflective', 'Lichttaster', 'diffuse'] },
  { type: 'SOOE', name_de: 'Faseroptischer Sensor', name_en: 'Fibre-optic sensor', category: 'sensors', synonyms: ['Faser', 'fibre', 'Glasfaser', 'Lichtleiter'] },

  // ── Sensors: Flow ──
  { type: 'SFAM', name_de: 'Durchflusssensor', name_en: 'Flow sensor', category: 'sensors', synonyms: ['Durchfluss', 'flow', 'Volumenstrom', 'volume flow'] },
  { type: 'SFAB', name_de: 'Durchflusssensor (Basic)', name_en: 'Flow sensor (basic)', category: 'sensors', synonyms: ['Durchfluss', 'flow'] },
  { type: 'SFAW', name_de: 'Durchflusssensor', name_en: 'Flow sensor', category: 'sensors', synonyms: ['Durchfluss', 'flow sensor'] },

  // ── Air Preparation ──
  { type: 'MS4', name_de: 'Wartungseinheit (Baugröße 4)', name_en: 'Service unit (size 4)', category: 'air-preparation', synonyms: ['Wartungseinheit', 'service unit', 'FRL', 'Filterregler'] },
  { type: 'MS6', name_de: 'Wartungseinheit (Baugröße 6)', name_en: 'Service unit (size 6)', category: 'air-preparation', synonyms: ['Wartungseinheit', 'service unit', 'FRL'] },
  { type: 'MS9', name_de: 'Wartungseinheit (Baugröße 9)', name_en: 'Service unit (size 9)', category: 'air-preparation', synonyms: ['Wartungseinheit', 'service unit', 'FRL'] },
  { type: 'MS12', name_de: 'Wartungseinheit (Baugröße 12)', name_en: 'Service unit (size 12)', category: 'air-preparation', synonyms: ['Wartungseinheit', 'service unit', 'FRL'] },
  { type: 'MSB4', name_de: 'Kombinierte Wartungseinheit (Baugröße 4)', name_en: 'Combined service unit (size 4)', category: 'air-preparation', synonyms: ['Wartungseinheit', 'kombiniert', 'combined'] },
  { type: 'MSB6', name_de: 'Kombinierte Wartungseinheit (Baugröße 6)', name_en: 'Combined service unit (size 6)', category: 'air-preparation', synonyms: ['Wartungseinheit', 'kombiniert', 'combined'] },
  { type: 'LFR', name_de: 'Filterregler', name_en: 'Filter regulator', category: 'air-preparation', synonyms: ['Filterregler', 'filter regulator', 'Druckregler'] },
  { type: 'LFMA', name_de: 'Feinfilter', name_en: 'Micro filter', category: 'air-preparation', synonyms: ['Feinfilter', 'micro filter', 'Feinstfilter'] },
  { type: 'LFMB', name_de: 'Aktivkohlefilter', name_en: 'Activated carbon filter', category: 'air-preparation', synonyms: ['Aktivkohle', 'activated carbon', 'Adsorptionsfilter'] },
  { type: 'LF', name_de: 'Filter', name_en: 'Filter', category: 'air-preparation', synonyms: ['Filter', 'filter', 'Druckluftfilter'] },
  { type: 'LFP', name_de: 'Feinfilterpatrone', name_en: 'Fine filter element', category: 'air-preparation', synonyms: ['Feinfilter', 'fine filter'] },
  { type: 'LOE', name_de: 'Öler', name_en: 'Lubricator', category: 'air-preparation', synonyms: ['Öler', 'lubricator', 'Schmierung', 'lubrication'] },
  { type: 'LR', name_de: 'Druckregler', name_en: 'Pressure regulator', category: 'air-preparation', synonyms: ['Druckregler', 'pressure regulator', 'Regler', 'regulator'] },
  { type: 'LRP', name_de: 'Präzisions-Druckregler', name_en: 'Precision pressure regulator', category: 'air-preparation', synonyms: ['Präzision', 'precision', 'Druckregler'] },
  { type: 'LWS', name_de: 'Wasserabscheider', name_en: 'Water separator', category: 'air-preparation', synonyms: ['Wasserabscheider', 'water separator', 'Kondensat', 'condensate'] },
  { type: 'LDM1', name_de: 'Membrantrockner', name_en: 'Membrane air dryer', category: 'air-preparation', synonyms: ['Trockner', 'dryer', 'Membrantrockner', 'membrane'] },
  { type: 'FRC', name_de: 'D-Serie Wartungseinheit', name_en: 'D-series service unit', category: 'air-preparation', synonyms: ['D-Serie', 'D-series', 'Wartungseinheit', 'service unit'] },

  // ── Connection Technology: Fittings ──
  { type: 'QS', name_de: 'Steckverbindung (Standard)', name_en: 'Push-in fitting (standard)', category: 'connection-technology', synonyms: ['Steckverbindung', 'push-in', 'fitting', 'Quick Star'] },
  { type: 'QSM', name_de: 'Steckverbindung (Mini)', name_en: 'Push-in fitting (mini)', category: 'connection-technology', synonyms: ['Mini', 'mini fitting', 'Steckverbindung'] },
  { type: 'QSL', name_de: 'L-Steckverbindung', name_en: 'Push-in L-fitting', category: 'connection-technology', synonyms: ['L-Stück', 'L-fitting', 'Winkel', 'elbow'] },
  { type: 'QST', name_de: 'T-Steckverbindung', name_en: 'Push-in T-fitting', category: 'connection-technology', synonyms: ['T-Stück', 'T-fitting', 'Abzweig', 'tee'] },
  { type: 'QSY', name_de: 'Y-Steckverbindung', name_en: 'Push-in Y-fitting', category: 'connection-technology', synonyms: ['Y-Stück', 'Y-fitting'] },
  { type: 'NPQM', name_de: 'Steckverbindung (Metall)', name_en: 'Push-in fitting (metal)', category: 'connection-technology', synonyms: ['Metall', 'metal', 'Steckverbindung', 'Messing', 'brass'] },
  { type: 'NPQP', name_de: 'Steckverbindung (medienbeständig)', name_en: 'Push-in fitting (media-resistant)', category: 'connection-technology', synonyms: ['medienbeständig', 'media-resistant', 'chemisch', 'chemical'] },
  { type: 'NPQH', name_de: 'Steckverbindung (Standard)', name_en: 'Push-in fitting (standard)', category: 'connection-technology', synonyms: ['Steckverbindung', 'push-in'] },
  { type: 'CRQS', name_de: 'Steckverbindung (Edelstahl)', name_en: 'Push-in fitting (stainless)', category: 'connection-technology', synonyms: ['Edelstahl', 'stainless', 'Steckverbindung'] },

  // ── Connection Technology: Tubing ──
  { type: 'PUN', name_de: 'Kunststoffschlauch (Polyurethan)', name_en: 'Plastic tubing (polyurethane)', category: 'connection-technology', synonyms: ['Schlauch', 'tubing', 'Polyurethan', 'polyurethane', 'PU'] },
  { type: 'PUN-H', name_de: 'Kunststoffschlauch (Standard)', name_en: 'Plastic tubing (standard)', category: 'connection-technology', synonyms: ['Schlauch', 'tubing', 'Standard'] },
  { type: 'PAN', name_de: 'Kunststoffschlauch (Polyamid)', name_en: 'Plastic tubing (polyamide)', category: 'connection-technology', synonyms: ['Schlauch', 'tubing', 'Polyamid', 'polyamide', 'PA'] },
  { type: 'PLN', name_de: 'Kunststoffschlauch (lebensmittelecht)', name_en: 'Plastic tubing (FDA)', category: 'connection-technology', synonyms: ['Schlauch', 'lebensmittelecht', 'FDA', 'food safe'] },
  { type: 'PFAN', name_de: 'Kunststoffschlauch (Hochleistung)', name_en: 'Plastic tubing (high performance)', category: 'connection-technology', synonyms: ['Schlauch', 'Hochleistung'] },

  // ── Connection Technology: Cables ──
  { type: 'NEBU', name_de: 'Verbindungskabel', name_en: 'Connecting cable', category: 'connection-technology', synonyms: ['Kabel', 'cable', 'Verbindungsleitung'] },
  { type: 'NEBV', name_de: 'Verbindungskabel (vorkonfektioniert)', name_en: 'Pre-assembled cable', category: 'connection-technology', synonyms: ['Kabel', 'cable', 'vorkonfektioniert', 'pre-assembled'] },
  { type: 'NEBS', name_de: 'Verbindungskabel (Signalleitung)', name_en: 'Signal cable', category: 'connection-technology', synonyms: ['Signalkabel', 'signal cable'] },
  { type: 'KD', name_de: 'Kabelkanal', name_en: 'Cable duct', category: 'connection-technology', synonyms: ['Kabelkanal', 'cable duct'] },

  // ── Controls and Remote I/O ──
  { type: 'CPX', name_de: 'Automatisierungsplattform', name_en: 'Automation platform', category: 'controls-io', synonyms: ['Automatisierung', 'automation', 'Plattform', 'platform'] },
  { type: 'CPX-AP', name_de: 'Automatisierungsplattform (dezentral)', name_en: 'Automation platform (decentralized)', category: 'controls-io', synonyms: ['dezentral', 'decentralized', 'Remote I/O', 'AP'] },
  { type: 'CPX-AP-A', name_de: 'Remote I/O System (zentral)', name_en: 'Remote I/O system (central)', category: 'controls-io', synonyms: ['Remote I/O', 'zentral', 'terminal'] },
  { type: 'CPX-AP-I', name_de: 'Remote I/O System (dezentral)', name_en: 'Remote I/O system (decentralized)', category: 'controls-io', synonyms: ['Remote I/O', 'dezentral', 'IP65', 'IP67'] },
  { type: 'CPX-E', name_de: 'Automatisierungssystem', name_en: 'Automation system', category: 'controls-io', synonyms: ['Automatisierung', 'automation', 'CODESYS', 'Motion Control'] },
  { type: 'CECC', name_de: 'Steuerung (kompakt)', name_en: 'Compact controller', category: 'controls-io', synonyms: ['Steuerung', 'controller', 'kompakt', 'CODESYS', 'IEC 61131'] },
  { type: 'CECC-X', name_de: 'Steuerung (Embedded)', name_en: 'Embedded controller', category: 'controls-io', synonyms: ['Steuerung', 'embedded', 'Linux'] },
  { type: 'CECX', name_de: 'Steuerung (Industrie-PC)', name_en: 'Industrial PC controller', category: 'controls-io', synonyms: ['Industrie-PC', 'industrial PC', 'IPC'] },
  { type: 'CDPX', name_de: 'Operator-Unit / HMI', name_en: 'Operator unit / HMI', category: 'controls-io', synonyms: ['HMI', 'Display', 'Bediengerät', 'operator unit', 'Touchscreen'] },
  { type: 'CTEU', name_de: 'Feldbusknoten', name_en: 'Fieldbus node', category: 'controls-io', synonyms: ['Feldbusknoten', 'fieldbus node', 'Feldbusmodul', 'bus module'] },
  { type: 'CACN', name_de: 'Netzgerät', name_en: 'Power supply unit', category: 'controls-io', synonyms: ['Netzgerät', 'Netzteil', 'power supply', 'Stromversorgung'] },

  // ── Software ──
  { type: 'Festo Automation Suite', name_de: 'Festo Automation Suite', name_en: 'Festo Automation Suite', category: 'software', synonyms: ['FAS', 'Inbetriebnahme', 'commissioning', 'Parametrierung', 'parameterization', 'Software'] },
  { type: 'FCT', name_de: 'Festo Configuration Tool', name_en: 'Festo Configuration Tool', category: 'software', synonyms: ['Configuration Tool', 'Konfiguration', 'Positionierung', 'positioning'] },
  { type: 'FluidDraw', name_de: 'FluidDraw (Schaltplaneditor)', name_en: 'FluidDraw (circuit diagram editor)', category: 'software', synonyms: ['Schaltplan', 'circuit diagram', 'Pneumatikplan', 'pneumatic diagram'] },
  { type: 'CPX-FMT', name_de: 'CPX Feldbustool', name_en: 'CPX Fieldbus Tool', category: 'software', synonyms: ['Feldbustool', 'fieldbus tool', 'Diagnose', 'diagnostics', 'CPX'] },
  { type: 'Handling Guide Online', name_de: 'Handling Guide Online', name_en: 'Handling Guide Online', category: 'software', synonyms: ['HGO', 'Handhabungssystem', 'handling system', 'Auslegung', 'sizing', 'Konfigurator', 'configurator'] },
  { type: 'Electric Motion Sizing', name_de: 'Electric Motion Sizing', name_en: 'Electric Motion Sizing', category: 'software', synonyms: ['EMS', 'Auslegung', 'sizing', 'Dimensionierung', 'dimensioning', 'elektrisch'] },
  { type: 'PositioningDrives', name_de: 'PositioningDrives', name_en: 'PositioningDrives', category: 'software', synonyms: ['Positionierung', 'positioning', 'Antrieb', 'drive'] },
  { type: 'Schematic Solution', name_de: 'Schematic Solution', name_en: 'Schematic Solution', category: 'software', synonyms: ['Schaltplan', 'schematic', 'Ventilschaltung'] },

  // ── Handling Systems ──
  { type: 'EXCM', name_de: 'Handhabungssystem (kartesisch)', name_en: 'Handling system (cartesian)', category: 'handling-systems', synonyms: ['Handhabung', 'handling', 'kartesisch', 'cartesian', 'Portalsystem', 'gantry', 'Mehrachssystem'] },
  { type: 'EXCT', name_de: 'Handhabungssystem (Tripod)', name_en: 'Handling system (tripod)', category: 'handling-systems', synonyms: ['Tripod', 'Deltakinematik', 'delta'] },
  { type: 'YXCR', name_de: 'Handhabungssystem (SCARA)', name_en: 'Handling system (SCARA)', category: 'handling-systems', synonyms: ['SCARA', 'Roboter', 'robot'] },

  // ── Process Automation ──
  { type: 'VZBA', name_de: 'Kugelhahn', name_en: 'Ball valve', category: 'process-automation', synonyms: ['Kugelhahn', 'ball valve', 'Prozess', 'process'] },
  { type: 'VZBC', name_de: 'Kugelhahn (Edelstahl)', name_en: 'Ball valve (stainless)', category: 'process-automation', synonyms: ['Kugelhahn', 'Edelstahl', 'stainless'] },
  { type: 'KVZA', name_de: 'Schrägsitzventil', name_en: 'Angle seat valve', category: 'process-automation', synonyms: ['Schrägsitzventil', 'angle seat valve'] },
  { type: 'VZWF', name_de: 'Prozessventil', name_en: 'Process valve', category: 'process-automation', synonyms: ['Prozessventil', 'process valve'] },
  { type: 'DAPS', name_de: 'Schwenkantrieb (Prozess)', name_en: 'Quarter-turn actuator', category: 'process-automation', synonyms: ['Schwenkantrieb', 'quarter turn', 'Klappe', 'butterfly'] },
  { type: 'CMSX', name_de: 'Stellungsregler', name_en: 'Positioner', category: 'process-automation', synonyms: ['Stellungsregler', 'positioner', 'Regelventil', 'control valve'] },

  // ── Accessories ──
  { type: 'EAMM', name_de: 'Achsanbausatz', name_en: 'Axial kit', category: 'accessories', synonyms: ['Achsanbausatz', 'axial kit', 'Kopplung', 'coupling'] },
  { type: 'EADB', name_de: 'Endlagendämpfer', name_en: 'Shock absorber', category: 'accessories', synonyms: ['Endlagendämpfer', 'shock absorber', 'Dämpfer', 'damper'] },
  { type: 'YSR', name_de: 'Stoßdämpfer', name_en: 'Shock absorber', category: 'accessories', synonyms: ['Stoßdämpfer', 'shock absorber'] },
  { type: 'SMBR', name_de: 'Sensorhalter', name_en: 'Sensor bracket', category: 'accessories', synonyms: ['Sensorhalter', 'sensor bracket', 'Halterung'] },
  { type: 'CRSM', name_de: 'Drehverteiler', name_en: 'Rotary distributor', category: 'accessories', synonyms: ['Drehverteiler', 'rotary distributor'] },

  // ── Silencers / Pneumatic Accessories ──
  { type: 'UC', name_de: 'Schalldämpfer', name_en: 'Silencer', category: 'accessories', synonyms: ['Schalldämpfer', 'silencer', 'Geräuschdämpfer', 'noise reduction'] },
  { type: 'AMTE', name_de: 'Schalldämpfer (Abluft)', name_en: 'Exhaust air silencer', category: 'accessories', synonyms: ['Schalldämpfer', 'silencer', 'Abluft', 'exhaust'] },

  // ── Didactic / Training ──
  { type: 'MPS', name_de: 'Modulares Produktionssystem', name_en: 'Modular Production System', category: 'didactic', synonyms: ['Lernsystem', 'learning system', 'Ausbildung', 'training', 'Didactic', 'modular'] },
  { type: 'CP Factory', name_de: 'CP Factory (Lernfabrik)', name_en: 'CP Factory (learning factory)', category: 'didactic', synonyms: ['Lernfabrik', 'learning factory', 'Industrie 4.0', 'Industry 4.0'] },
  { type: 'CP Lab', name_de: 'CP Lab (kompakte Lernfabrik)', name_en: 'CP Lab (compact learning factory)', category: 'didactic', synonyms: ['Lernfabrik', 'learning factory', 'Labor', 'lab'] },
  { type: 'EduTrainer', name_de: 'EduTrainer (Trainingsgerät)', name_en: 'EduTrainer (training device)', category: 'didactic', synonyms: ['Trainingsgerät', 'training device', 'Schulung'] },
  { type: 'Robotino', name_de: 'Robotino (mobiler Lernroboter)', name_en: 'Robotino (mobile learning robot)', category: 'didactic', synonyms: ['Lernroboter', 'learning robot', 'mobil', 'mobile', 'Robotik'] },
  { type: 'BionicCobot', name_de: 'BionicCobot', name_en: 'BionicCobot', category: 'didactic', synonyms: ['Cobot', 'kollaborativ', 'collaborative', 'Bionik', 'bionics'] },
];

// ─── Browse Filter Categories ────────────────────────────────────────

export interface ProductCategory {
  id: string;
  label: string;
  keywords: string[];
}

/**
 * Category list for the home page browse/filter UI, derived from
 * FESTO_CATEGORIES. Each category exposes its general keywords plus the
 * product type designations (and uppercase synonyms) that belong to it.
 */
export const PRODUCT_CATEGORIES: ProductCategory[] = FESTO_CATEGORIES.map((cat) => ({
  id: cat.id,
  label: cat.label_de,
  keywords: [
    ...cat.keywords,
    // Include all product type designations in this category
    ...FESTO_PRODUCTS.filter((p) => p.category === cat.id).flatMap((p) => [
      p.type,
      ...p.synonyms.filter((s) => s.length >= 3 && /^[A-Z]/.test(s)),
    ]),
  ],
}));

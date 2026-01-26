import type { SearchResultSegment } from '@/types/search';

/**
 * Mock search results for UI development
 * These simulate what the real search API will return later
 *
 * Mix of:
 * - Official Festo channels (official status)
 * - Community/third-party channels (community status)
 * - Various product families (CPX, CMMT-AS, VTUG)
 * - Error code scenarios
 * - How-to/commissioning content
 */
export const mockSegments: SearchResultSegment[] = [
  {
    id: '1',
    text: 'Bei Fehlercode E-7342 prüfen Sie zuerst die Luftzufuhr und stellen Sie sicher, dass der Eingangsdruck zwischen 4-6 bar liegt. Häufig liegt das Problem an einer verstopften Filterpatrone.',
    start_time: 145,
    end_time: 210,
    similarity: 0.92,
    video_id: '101',
    video_youtube_id: 'abc123def45',
    video_title: 'CPX-E Fehlerdiagnose: Druckprobleme und Fehlercodes',
    video_description: 'In diesem Video zeigen wir die häufigsten Fehlerursachen bei CPX-E Ventilinseln und wie Sie diese systematisch beheben.',
    video_thumbnail_url: 'https://i.ytimg.com/vi/abc123def45/mqdefault.jpg',
    video_duration_seconds: 847,
    video_has_transcript: true,
    channel_name: 'Festo Didactic',
    channel_official_status: 'official',
  },
  {
    id: '2',
    text: 'Die Inbetriebnahme des CMMT-AS erfolgt in drei Schritten: Zuerst die Ethernet-Verbindung herstellen, dann die Festo Automation Suite öffnen und schließlich den Motor konfigurieren.',
    start_time: 32,
    end_time: 98,
    similarity: 0.89,
    video_id: '102',
    video_youtube_id: 'xyz789abc12',
    video_title: 'CMMT-AS Servo-Controller: Schnelle Inbetriebnahme',
    video_description: 'Schritt-für-Schritt Anleitung zur Erstinbetriebnahme des CMMT-AS mit der Festo Automation Suite.',
    video_thumbnail_url: 'https://i.ytimg.com/vi/xyz789abc12/mqdefault.jpg',
    video_duration_seconds: 623,
    video_has_transcript: true,
    channel_name: 'Festo Technik',
    channel_official_status: 'official',
  },
  {
    id: '3',
    text: 'For connecting the CPX-AP to Ethernet/IP, you need to set the correct IP address first. Go to the web interface and configure the network settings under Communication.',
    start_time: 256,
    end_time: 312,
    similarity: 0.87,
    video_id: '103',
    video_youtube_id: 'eng456vid78',
    video_title: 'CPX-AP-I: Ethernet/IP Configuration Guide',
    video_description: 'How to configure the CPX-AP-I for Ethernet/IP communication with Allen-Bradley PLCs.',
    video_thumbnail_url: 'https://i.ytimg.com/vi/eng456vid78/mqdefault.jpg',
    video_duration_seconds: 512,
    video_has_transcript: true,
    channel_name: 'Festo USA',
    channel_official_status: 'official',
  },
  {
    id: '4',
    text: 'Wenn der CMMT-AS nicht startet, überprüfen Sie zuerst die 24V Versorgung. Der häufigste Fehler ist eine falsche Verdrahtung am X1 Stecker. Die Pinbelegung finden Sie im Handbuch Seite 47.',
    start_time: 189,
    end_time: 245,
    similarity: 0.85,
    video_id: '104',
    video_youtube_id: 'comm123xyz9',
    video_title: 'CMMT-AS Troubleshooting - Die häufigsten Fehler',
    video_description: 'Community-Video mit praktischen Tipps zur Fehlersuche beim CMMT-AS Servo-Controller.',
    video_thumbnail_url: 'https://i.ytimg.com/vi/comm123xyz9/mqdefault.jpg',
    video_duration_seconds: 934,
    video_has_transcript: true,
    channel_name: 'AutomatisierungsWissen',
    channel_official_status: 'community',
  },
  {
    id: '5',
    text: 'Die VTUG Ventilinsel mit IO-Link verbinden: Schließen Sie das IO-Link Kabel am Port A an und stellen Sie sicher, dass der IO-Link Master auf COM3 Modus eingestellt ist.',
    start_time: 78,
    end_time: 134,
    similarity: 0.84,
    video_id: '105',
    video_youtube_id: 'vtug456io12',
    video_title: 'VTUG mit IO-Link: Schnelle Integration',
    video_description: 'Anleitung zur IO-Link Anbindung der VTUG Ventilinsel an verschiedene IO-Link Master.',
    video_thumbnail_url: 'https://i.ytimg.com/vi/vtug456io12/mqdefault.jpg',
    video_duration_seconds: 445,
    video_has_transcript: true,
    channel_name: 'Festo Didactic',
    channel_official_status: 'official',
  },
  {
    id: '6',
    text: 'Das CPX-AP-A System ermöglicht die dezentrale Automatisierung. Hier zeige ich wie man mehrere Remote-IO Module über PROFINET verbindet und konfiguriert.',
    start_time: 412,
    end_time: 478,
    similarity: 0.82,
    video_id: '106',
    video_youtube_id: 'profinet789a',
    video_title: 'CPX-AP-A: PROFINET Integration Praxisguide',
    video_description: 'Detaillierte Anleitung zur PROFINET-Konfiguration des CPX-AP-A Systems mit TIA Portal.',
    video_thumbnail_url: 'https://i.ytimg.com/vi/profinet789a/mqdefault.jpg',
    video_duration_seconds: 1256,
    video_has_transcript: true,
    channel_name: 'Festo Global',
    channel_official_status: 'official',
  },
  {
    id: '7',
    text: 'Error code E-123 on CPX means communication timeout. First check your PROFINET cable, then verify the IP settings in the PLC project match the physical device.',
    start_time: 567,
    end_time: 623,
    similarity: 0.81,
    video_id: '107',
    video_youtube_id: 'error123fix6',
    video_title: 'Fixing CPX Communication Errors - Complete Guide',
    video_description: 'Troubleshooting communication issues between CPX valve terminals and various PLCs.',
    video_thumbnail_url: 'https://i.ytimg.com/vi/error123fix6/mqdefault.jpg',
    video_duration_seconds: 789,
    video_has_transcript: true,
    channel_name: 'Industrial Automation Tips',
    channel_official_status: 'community',
  },
  {
    id: '8',
    text: 'Bei der Fehlersuche am MPA-S hilft oft ein Reset. Drücken Sie den Taster an der Ventilinsel für 5 Sekunden. Danach startet das System neu und zeigt den aktuellen Status an.',
    start_time: 234,
    end_time: 289,
    similarity: 0.79,
    video_id: '108',
    video_youtube_id: 'mpas789reset',
    video_title: 'MPA-S Ventilinsel: Reset und Diagnose',
    video_description: 'Wie Sie die MPA-S Ventilinsel zurücksetzen und Diagnoseinformationen auslesen.',
    video_thumbnail_url: 'https://i.ytimg.com/vi/mpas789reset/mqdefault.jpg',
    video_duration_seconds: 534,
    video_has_transcript: true,
    channel_name: 'Festo Service',
    channel_official_status: 'official',
  },
  {
    id: '9',
    text: 'Modbus TCP setup for CECC controllers: Configure the IP address via the web interface, then set the Modbus TCP port to 502. The register mapping starts at address 40001.',
    start_time: 145,
    end_time: 201,
    similarity: 0.77,
    video_id: '109',
    video_youtube_id: 'modbus456tcp',
    video_title: 'CECC Modbus TCP Integration',
    video_description: 'Setting up Modbus TCP communication between CECC controllers and SCADA systems.',
    video_thumbnail_url: 'https://i.ytimg.com/vi/modbus456tcp/mqdefault.jpg',
    video_duration_seconds: 678,
    video_has_transcript: false,
    channel_name: 'Festo Technik',
    channel_official_status: 'official',
  },
  {
    id: '10',
    text: 'In diesem Tutorial zeige ich die komplette Parameterierung des CMMT-ST über die FCT Software. Wichtig: Laden Sie zuerst die aktuelle Firmware von der Festo Website herunter.',
    start_time: 0,
    end_time: 56,
    similarity: 0.75,
    video_id: '110',
    video_youtube_id: 'tutorial789x',
    video_title: 'CMMT-ST Parameterierung mit FCT',
    video_description: 'Vollständige Anleitung zur Konfiguration des CMMT-ST Servo-Controllers.',
    video_thumbnail_url: 'https://i.ytimg.com/vi/tutorial789x/mqdefault.jpg',
    video_duration_seconds: 1123,
    video_has_transcript: true,
    channel_name: 'Automation Academy DE',
    channel_official_status: 'community',
  },
];

// Helper function to filter by source
export function filterBySource(
  segments: SearchResultSegment[],
  source: 'all' | 'official' | 'community'
): SearchResultSegment[] {
  if (source === 'all') return segments;
  return segments.filter(
    (s) => s.channel_official_status === source
  );
}

// Helper function to simulate search (filters by query presence in text)
export function searchMockSegments(
  query: string,
  source: 'all' | 'official' | 'community' = 'all'
): SearchResultSegment[] {
  const normalizedQuery = query.toLowerCase();
  let results = mockSegments.filter(
    (s) =>
      s.text.toLowerCase().includes(normalizedQuery) ||
      s.video_title.toLowerCase().includes(normalizedQuery)
  );

  // If no text match, return all (simulating semantic search)
  if (results.length === 0) {
    results = mockSegments;
  }

  return filterBySource(results, source);
}

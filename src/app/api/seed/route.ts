// Direct seed endpoint - populates database with real video metadata + synthetic transcripts
// Generates real OpenAI embeddings for search testing
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { generateEmbeddings, validateEmbedding } from '@/lib/openai/embeddings';

// Realistic Festo-related transcript segments (German + English)
// These simulate real problems technicians search for
const SYNTHETIC_SEGMENTS: {
  videoIndex: number;
  language: string;
  segments: { text: string; startTime: number; endTime: number }[];
}[] = [
  {
    videoIndex: 0,
    language: 'de',
    segments: [
      {
        text: 'Willkommen zum CPX-E Tutorial. In diesem Video zeigen wir Ihnen die Inbetriebnahme des CPX-E Systems. Zunächst müssen Sie die Spannungsversorgung anschließen. Verwenden Sie ein 24V DC Netzteil.',
        startTime: 0,
        endTime: 35,
      },
      {
        text: 'Verbinden Sie das CPX-E Modul über PROFINET mit Ihrer SPS. Stellen Sie sicher, dass die IP-Adresse korrekt konfiguriert ist. Die Standard-IP-Adresse finden Sie auf dem Typenschild.',
        startTime: 35,
        endTime: 70,
      },
      {
        text: 'Wenn der Fehlercode E123 erscheint, prüfen Sie die Verdrahtung der Versorgungsspannung. Dieser Fehler deutet auf eine Unterspannung hin. Die Mindestspannung beträgt 21,6 Volt.',
        startTime: 70,
        endTime: 105,
      },
      {
        text: 'Für die PROFINET Konfiguration öffnen Sie den Festo Automation Suite. Gehen Sie auf Geräte scannen und wählen Sie das CPX-E Modul aus. Hier können Sie die IP-Adresse und den Gerätenamen zuweisen.',
        startTime: 105,
        endTime: 145,
      },
      {
        text: 'Nach erfolgreicher Konfiguration sollte die grüne LED am CPX-E Modul dauerhaft leuchten. Eine blinkende rote LED deutet auf einen Kommunikationsfehler hin. Überprüfen Sie in diesem Fall das Netzwerkkabel.',
        startTime: 145,
        endTime: 180,
      },
    ],
  },
  {
    videoIndex: 1,
    language: 'de',
    segments: [
      {
        text: 'Der CMMT-AS Servoregler von Festo ermöglicht präzise Positionierung. Dieses Video erklärt die häufigsten Fehlercodes und deren Behebung. Beginnen wir mit dem Fehlercode F2 Überstrom.',
        startTime: 0,
        endTime: 30,
      },
      {
        text: 'Bei Fehlercode F2 Überstrom müssen Sie zunächst den Motor abklemmen und den Widerstand der Motorwicklungen messen. Ein Kurzschluss in der Wicklung verursacht diesen Fehler häufig.',
        startTime: 30,
        endTime: 60,
      },
      {
        text: 'Fehlercode F7 bedeutet Übertemperatur. Prüfen Sie ob die Kühlrippen des CMMT-AS frei sind und die Umgebungstemperatur unter 45 Grad Celsius liegt. Reduzieren Sie gegebenenfalls die Last.',
        startTime: 60,
        endTime: 95,
      },
      {
        text: 'Das Homing oder die Referenzfahrt des CMMT-AS konfigurieren Sie über die Festo Automation Suite. Wählen Sie die Homing-Methode und setzen Sie die Geschwindigkeit und Beschleunigung.',
        startTime: 95,
        endTime: 130,
      },
      {
        text: 'Für die Inbetriebnahme des CMMT-AS verbinden Sie den Regler über USB oder Ethernet mit Ihrem PC. Starten Sie die Festo Automation Suite und folgen Sie dem Inbetriebnahme-Assistenten Schritt für Schritt.',
        startTime: 130,
        endTime: 165,
      },
    ],
  },
  {
    videoIndex: 2,
    language: 'de',
    segments: [
      {
        text: 'VTUG Ventilinsel Montage und Konfiguration. Die VTUG ist eine kompakte Ventilinsel für dezentrale Automatisierung. In diesem Video zeigen wir die korrekte Montage und elektrische Verdrahtung.',
        startTime: 0,
        endTime: 30,
      },
      {
        text: 'Montieren Sie die VTUG auf einer ebenen Fläche. Die Druckluftversorgung wird an den Eingangsanschluss P angeschlossen. Der maximale Betriebsdruck beträgt 8 bar.',
        startTime: 30,
        endTime: 60,
      },
      {
        text: 'Die elektrische Verdrahtung erfolgt über den 25-poligen Sub-D Stecker. Pin 1 ist die Versorgungsspannung 24V DC, Pin 2 ist Masse. Die Ventilausgänge belegen die Pins 3 bis 24.',
        startTime: 60,
        endTime: 95,
      },
      {
        text: 'Wenn kein Druck aufgebaut wird, prüfen Sie zunächst den Druckluftanschluss. Stellen Sie sicher, dass der Absperrhahn geöffnet ist und der Mindestdruck von 2 bar anliegt.',
        startTime: 95,
        endTime: 125,
      },
    ],
  },
  {
    videoIndex: 3,
    language: 'en',
    segments: [
      {
        text: 'Welcome to the Festo PROFINET configuration guide. This tutorial covers setting up PROFINET communication between a Siemens S7-1500 PLC and Festo CPX-AP-I modules.',
        startTime: 0,
        endTime: 30,
      },
      {
        text: 'First download the GSDML file from the Festo support portal. Import it into your TIA Portal project. Then add the CPX-AP-I device to your PROFINET network configuration.',
        startTime: 30,
        endTime: 60,
      },
      {
        text: 'Assign a device name to the CPX-AP-I using the Festo Automation Suite or the Siemens PRONETA tool. The device name must match the name configured in TIA Portal.',
        startTime: 60,
        endTime: 90,
      },
      {
        text: 'If communication fails with error code 8100, check the network topology. Ensure the CPX-AP-I and PLC are on the same subnet. Also verify the device name assignment.',
        startTime: 90,
        endTime: 125,
      },
      {
        text: 'For IO-Link integration with PROFINET, use the CPX-AP-I-4IOL module. Each IO-Link port can connect a sensor or actuator. Configure the IODD files in TIA Portal for each connected device.',
        startTime: 125,
        endTime: 160,
      },
    ],
  },
  {
    videoIndex: 4,
    language: 'de',
    segments: [
      {
        text: 'Festo MPA Ventilinsel Fehlerdiagnose. Die MPA Ventilinsel ist eine modulare Plattform für pneumatische Anwendungen. Dieses Video hilft bei der Fehlersuche und Diagnose.',
        startTime: 0,
        endTime: 30,
      },
      {
        text: 'Wenn ein einzelnes Ventil nicht schaltet, prüfen Sie zunächst die LED-Anzeige. Leuchtet die LED, liegt das Problem an der Pneumatik. Leuchtet sie nicht, ist die elektrische Ansteuerung gestört.',
        startTime: 30,
        endTime: 65,
      },
      {
        text: 'Bei undichten Ventilen tauschen Sie die Dichtungen aus. Verwenden Sie nur Original-Festo Ersatzteile. Die Dichtungskits finden Sie im Festo Online-Shop unter der jeweiligen Ventiltyp-Nummer.',
        startTime: 65,
        endTime: 100,
      },
      {
        text: 'Der Fehlercode E45 an der MPA deutet auf einen internen Kurzschluss hin. Trennen Sie alle Ventilspulen und messen Sie den Widerstand. Ein gesundes Ventil hat zwischen 20 und 80 Ohm.',
        startTime: 100,
        endTime: 135,
      },
    ],
  },
  {
    videoIndex: 5,
    language: 'en',
    segments: [
      {
        text: 'Festo Didactic learning systems overview. Festo Didactic provides hands-on training platforms for industrial automation, pneumatics, hydraulics, and Industry 4.0 concepts.',
        startTime: 0,
        endTime: 28,
      },
      {
        text: 'The MPS system or Modular Production System is used in vocational training worldwide. It simulates real production processes including sorting, assembly, and quality control stations.',
        startTime: 28,
        endTime: 58,
      },
      {
        text: 'For EtherNet/IP connectivity with Festo components, configure the IP address using the Festo web interface. Access the interface by entering the module IP address in your browser.',
        startTime: 58,
        endTime: 90,
      },
    ],
  },
  {
    videoIndex: 6,
    language: 'de',
    segments: [
      {
        text: 'Pneumatische Grundlagen mit Festo Komponenten. In diesem Video erklären wir die Funktionsweise von Zylindern, Ventilen und Druckluftaufbereitung. Ideal für Auszubildende und Einsteiger.',
        startTime: 0,
        endTime: 30,
      },
      {
        text: 'Ein doppeltwirkender Zylinder wie der DSBC von Festo wird in beide Richtungen mit Druckluft angesteuert. Das 5/2-Wegeventil steuert die Bewegungsrichtung des Kolbens.',
        startTime: 30,
        endTime: 60,
      },
      {
        text: 'Die Druckluftaufbereitung besteht aus Filter, Regler und Öler, auch FRL-Einheit genannt. Festo bietet die MS-Serie als kompakte Wartungseinheit an. Der Arbeitsdruck sollte zwischen 4 und 6 bar liegen.',
        startTime: 60,
        endTime: 95,
      },
      {
        text: 'Wenn der Zylinder nicht ausfährt, prüfen Sie den Druck am Manometer. Kein Druck deutet auf ein geschlossenes Ventil oder eine leere Druckluftleitung hin. Prüfen Sie auch die Drosselrückschlagventile.',
        startTime: 95,
        endTime: 130,
      },
    ],
  },
  {
    videoIndex: 7,
    language: 'de',
    segments: [
      {
        text: 'IO-Link Konfiguration mit Festo CECC Controller. Der CECC ist ein kompakter SPS-Controller mit integrierten IO-Link Master Ports. Dieses Video zeigt die Konfiguration Schritt für Schritt.',
        startTime: 0,
        endTime: 30,
      },
      {
        text: 'Verbinden Sie den IO-Link Sensor mit dem CECC Port. Die automatische Erkennung startet sofort. Im Festo Automation Suite sehen Sie den erkannten Sensor und seine Parameter.',
        startTime: 30,
        endTime: 60,
      },
      {
        text: 'Modbus TCP Kommunikation mit dem CECC konfigurieren Sie über Register 40001 bis 40100. Die Holding Register enthalten die Prozessdaten der IO-Link Geräte.',
        startTime: 60,
        endTime: 90,
      },
    ],
  },
];

export async function GET(request: NextRequest) {
  const isDev = process.env.NODE_ENV === 'development';
  const authHeader = request.headers.get('authorization');
  const hasValidSecret =
    process.env.INGESTION_SECRET &&
    authHeader === `Bearer ${process.env.INGESTION_SECRET}`;

  if (!isDev && !hasValidSecret) {
    return NextResponse.json(
      { error: 'Only available in development or with INGESTION_SECRET' },
      { status: 403 }
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'Missing OPENAI_API_KEY' },
      { status: 500 }
    );
  }

  const supabase = getSupabaseAdmin();

  // Step 1: Get existing videos from DB (from YouTube search)
  const { data: rawVideos, error: videosErr } = await supabase
    .from('videos')
    .select('id, youtube_id, title, channel_id')
    .order('id', { ascending: true })
    .limit(10);

  const videos = rawVideos as { id: number; youtube_id: string; title: string; channel_id: number }[] | null;

  if (videosErr || !videos || videos.length === 0) {
    return NextResponse.json({
      error: 'No videos in database. Run YouTube search seed first.',
      dbError: videosErr?.message,
    });
  }

  console.log(`[seed] Found ${videos.length} videos in DB`);

  const results = [];
  let totalSegments = 0;

  for (const synth of SYNTHETIC_SEGMENTS) {
    if (synth.videoIndex >= videos.length) continue;

    const video = videos[synth.videoIndex];
    console.log(
      `[seed] Processing video ${video.id} (${video.youtube_id}) with ${synth.segments.length} segments...`
    );

    try {
      // Check if segments already exist for this video
      const { data: existing } = await supabase
        .from('segments')
        .select('id')
        .eq('video_id', video.id)
        .limit(1);

      if (existing && existing.length > 0) {
        console.log(`[seed] Video ${video.id} already has segments, skipping`);
        results.push({
          videoId: video.youtube_id,
          status: 'skipped',
          reason: 'already_has_segments',
        });
        continue;
      }

      // Insert transcript
      const fullText = synth.segments.map((s) => s.text).join(' ');
      const { data: rawTranscript, error: transcriptErr } = await supabase
        .from('transcripts')
        // @ts-expect-error - Supabase types not fully inferring through getSupabaseAdmin()
        .insert({
          video_id: video.id,
          full_text: fullText,
          language: synth.language,
          source_type: 'auto',
        })
        .select('id')
        .single();

      const transcript = rawTranscript as { id: number } | null;

      if (transcriptErr || !transcript) {
        throw new Error(
          `Failed to insert transcript: ${transcriptErr?.message}`
        );
      }

      // Update video has_transcript flag
      await supabase
        .from('videos')
        // @ts-expect-error - Supabase types not fully inferring through getSupabaseAdmin()
        .update({ has_transcript: true })
        .eq('id', video.id);

      // Generate embeddings for all segments
      const texts = synth.segments.map((s) => s.text);
      console.log(
        `[seed] Generating embeddings for ${texts.length} segments...`
      );
      const embeddings = await generateEmbeddings(texts);

      // Validate embeddings
      for (const emb of embeddings) {
        if (!validateEmbedding(emb)) {
          throw new Error(
            `Embedding dimension mismatch: got ${emb.length}`
          );
        }
      }

      // Insert segments with embeddings
      const segmentRecords = synth.segments.map((seg, idx) => ({
        video_id: video.id,
        transcript_id: transcript.id,
        text: seg.text,
        start_time: seg.startTime,
        end_time: seg.endTime,
        embedding: embeddings[idx],
      }));

      const { error: segErr } = await supabase
        .from('segments')
        // @ts-expect-error - Supabase types not fully inferring through getSupabaseAdmin()
        .insert(segmentRecords);

      if (segErr) throw new Error(`Failed to insert segments: ${segErr.message}`);

      totalSegments += synth.segments.length;
      results.push({
        videoId: video.youtube_id,
        videoDbId: video.id,
        status: 'success',
        segments: synth.segments.length,
        language: synth.language,
      });

      console.log(
        `[seed] OK: Video ${video.id} - ${synth.segments.length} segments stored`
      );
    } catch (err) {
      console.error(`[seed] FAIL: Video ${video.id}:`, err);
      results.push({
        videoId: video.youtube_id,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    success: true,
    summary: {
      videosProcessed: results.length,
      segmentsCreated: totalSegments,
      successful: results.filter((r) => r.status === 'success').length,
      skipped: results.filter((r) => r.status === 'skipped').length,
      errors: results.filter((r) => r.status === 'error').length,
    },
    results,
  });
}

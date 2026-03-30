/**
 * Curate demo segments for video 1976 (CMMT-AS Erstinbetriebnahme).
 * Replaces auto-generated segments with manually corrected, topic-aligned segments.
 * Usage: npx tsx --env-file=.env.local scripts/curate-demo-segments.ts
 */
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_SECRET!;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const VIDEO_DB_ID = 1976;

const SUMMARY_SYSTEM_PROMPT =
  'Du fasst Transkript-Abschnitte in maximal 10 Wörtern auf Deutsch zusammen. Beschreibe WAS erklärt oder besprochen wird. Antworte IMMER auf Deutsch, auch wenn der Text auf Englisch ist. Antworte nur mit der Zusammenfassung, ohne Anführungszeichen.';

interface CuratedSegment {
  text: string;
  startTime: number;
  endTime: number;
}

const CURATED_SEGMENTS: CuratedSegment[] = [
  // 0:00 - 0:08 Intro + 0:08 - 0:21 Plugins überprüfen
  {
    startTime: 0,
    endTime: 21,
    text: `Willkommen bei Festo. In diesem Video wird die erste Inbetriebnahme eines Servoantriebsreglers CMMT-AS mit der Festo Automation Suite gezeigt. Um Geräte in der Festo Automation Suite zu konfigurieren, müssen geeignete Plugins installiert sein. Als Erstes sollte man im Backstage unter "Repositories" und "Plugins" nachsehen, ob das CMMT-AS Plugin installiert ist.`,
  },
  // 0:21 - 0:40 Gerät im Repository suchen + Erstinbetriebnahme-Assistent starten
  {
    startTime: 21,
    endTime: 40,
    text: `In der Festo Automation Suite navigiert man im Geräte-Repository zu "EtherCAT Slave", dann zu "Festo Elektrische Antriebe" und wählt den gewünschten CMMT-AS Antrieb aus. Ein Doppelklick auf das Gerät öffnet den Topologie-Editor. Dort befinden sich zwei Schaltflächen: eine für den Erstinbetriebnahme-Assistenten und eine für die manuelle Konfiguration. Der Erstinbetriebnahme-Assistent wird gestartet.`,
  },
  // 0:40 - 1:03 Motor, Achse und Anbausatz auswählen
  {
    startTime: 40,
    endTime: 63,
    text: `Im ersten Schritt des Erstinbetriebnahme-Assistenten muss die Antriebskonfiguration des CMMT-AS erstellt werden. Motor, Achse und Anbausatz müssen ausgewählt werden, gegebenenfalls auch das Getriebe. Die Komponenten können über ihre Teilenummer oder ihren Namen gesucht werden. Mechanisch passende Anbausätze sind mit einem Häkchen-Symbol gekennzeichnet.`,
  },
  // 1:03 - 1:18 Installierte Komponenten auswählen
  {
    startTime: 63,
    endTime: 78,
    text: `Bei der Antriebskonfiguration des CMMT-AS werden die installierten Komponenten ausgewählt. Man sieht, welche Anbausätze zum gewählten Motor und zur gewählten Achse passen. Die passenden Kombinationen werden durch ein Häkchen-Symbol gekennzeichnet, sodass nur kompatible Komponenten zusammen konfiguriert werden.`,
  },
  // 1:18 - 1:33 Allgemeine Geräteeinstellungen
  {
    startTime: 78,
    endTime: 93,
    text: `Im nächsten Schritt werden allgemeine Geräteeinstellungen des CMMT-AS abgefragt. Hier wird festgelegt, ob der Antrieb über EtherCAT und Feldbus eingeschaltet werden soll oder nur über den Feldbus. Außerdem kann die Versorgungsspannung angepasst werden, falls diese nicht 230 Volt beträgt.`,
  },
  // 1:33 - 1:55 Anwendungsdaten
  {
    startTime: 93,
    endTime: 115,
    text: `In den Anwendungsdaten des CMMT-AS kann die zu bewegende Masse eingegeben und die Anbauposition des Motors gewählt werden. Dazu klickt man auf die gewünschte Anbauposition, und in der Grafik wird angezeigt, wie das Koordinatensystem ausgerichtet sein wird. Um die Richtung umzudrehen, klickt man auf den Pfeil oder das Kontrollkästchen.`,
  },
  // 1:55 - 2:08 Hardware-Endschalter + Referenzfahrtmethode
  {
    startTime: 115,
    endTime: 128,
    text: `Bei der Konfiguration des CMMT-AS werden die Hardware-Endschalter ausgewählt, zum Beispiel Öffner als Endschalter. Außerdem wird festgelegt, ob ein Referenzschalter vorhanden ist. Anschließend stellt man die gewünschte Referenzfahrt-Methode ein, die bestimmt, wie der Antrieb seine Nullposition findet.`,
  },
  // 2:08 - 2:40 Software-Endlagen konfigurieren
  {
    startTime: 128,
    endTime: 160,
    text: `Auf der nächsten Seite des CMMT-AS Erstinbetriebnahme-Assistenten können die Software-Endlagen konfiguriert werden. Die Grafik ist interaktiv: Wenn man den Homingpunkt zum Beispiel um 50 mm verschiebt, sieht man, dass zusammen mit dem Achsen-Nullpunkt auch die Software-Endlagen verschoben werden, da diese sich auf den Homingpunkt beziehen. Die Werte können auch durch Verschieben der Symbole in der Grafik eingestellt werden. Der Pfeil zeigt dabei an, auf welche Position sich der jeweilige Wert bezieht. Falls eine Warnung angezeigt wird, dass die Spanne zwischen der negativen und der positiven Software-Endlage unplausibel ist, kann man mit der Maus über das Warnsymbol fahren. Es öffnet sich ein Popup mit den empfohlenen Grenzwerten. Durch Klick auf das empfohlene Maximum wird der Wert übernommen und die Warnung verschwindet.`,
  },
  // 2:40 - 3:00 Assistent beenden + Korrekturwerte übernehmen
  {
    startTime: 160,
    endTime: 180,
    text: `Nun kann der Erstinbetriebnahme-Assistent des CMMT-AS abgeschlossen werden. Im Hintergrund werden die Reglerparameter automatisch berechnet, unter Berücksichtigung der konfigurierten Komponenten und der bewegten Masse. Die Empfehlung ist, danach die Parameterkorrektur-Seite zu öffnen und dort alle empfohlenen Korrekturwerte zu übernehmen, um eine optimale Regelung zu erreichen.`,
  },
  // 3:00 - 3:30 Verbinden mit Antrieb + Parameter schreiben
  {
    startTime: 180,
    endTime: 210,
    text: `Im nächsten Schritt wird die Verbindung zum CMMT-AS Antrieb hergestellt und die Parameter übertragen. Dazu klickt man auf die IP-Adresse, woraufhin das gesamte Netzwerk nach kompatiblen Geräten durchsucht wird. Die gefundenen Geräte werden aufgelistet. Man wählt das gewünschte Gerät aus, verbindet sich damit und schreibt die Parameter ins Gerät.`,
  },
  // 3:30 - 3:50 Fehlermeldung + Steuerhoheit + Reglerfreigabe
  {
    startTime: 210,
    endTime: 230,
    text: `Nach dem Parametertransfer meldet der CMMT-AS möglicherweise einen Fehler, dass der Parametersatz nicht gefunden wurde. Das ist normal, da das Gerät vor dem Laden noch Werkseinstellungen hatte und somit keinen Parametersatz kannte. Man quittiert die Fehlermeldung, übernimmt die Steuerhoheit über den Antrieb und aktiviert die Reglerfreigabe.`,
  },
  // 3:50 - 4:21 Referenzfahrt + Tippbetrieb + Positionieraufträge
  {
    startTime: 230,
    endTime: 261,
    text: `Nach der Reglerfreigabe wird beim CMMT-AS die Referenzfahrt gestartet, damit der Antrieb seine Nullposition kennt. Anschließend kann der Antrieb im Tippbetrieb angesteuert werden, um die Bewegung manuell zu testen. Außerdem können Positionieraufträge gestartet werden, zum Beispiel zehn Millimeter vorwärts, rückwärts oder auf eine bestimmte Zielposition.`,
  },
  // 4:21 - Ende: Manueller Steuermodus + Abschluss
  {
    startTime: 261,
    endTime: 306,
    text: `Der CMMT-AS kann auch im manuellen Steuermodus betrieben werden, um den Antrieb direkt anzusteuern. Das war die erste Inbetriebnahme eines Servoantriebsreglers CMMT-AS mit der Festo Automation Suite und dem CMMT-AS Plugin. Wenn Ihnen die Videos gefallen, abonnieren Sie den Festo Kanal und bleiben Sie auf dem Laufenden.`,
  },
];

async function main() {
  console.log(`Curating demo segments for video ${VIDEO_DB_ID}...\n`);

  // 1. Verify video exists
  const { data: video, error: vErr } = await supabase
    .from('videos')
    .select('id, youtube_id, title')
    .eq('id', VIDEO_DB_ID)
    .single();
  if (vErr || !video) {
    console.error('Video not found:', vErr);
    process.exit(1);
  }
  console.log(`Video: ${(video as any).title} (${(video as any).youtube_id})`);

  // 2. Delete old segments and transcripts
  const { error: delSegErr } = await supabase.from('segments').delete().eq('video_id', VIDEO_DB_ID);
  if (delSegErr) { console.error('Error deleting segments:', delSegErr); process.exit(1); }
  console.log('Old segments deleted.');

  const { error: delTrErr } = await supabase.from('transcripts').delete().eq('video_id', VIDEO_DB_ID);
  if (delTrErr) { console.error('Error deleting transcripts:', delTrErr); process.exit(1); }
  console.log('Old transcripts deleted.');

  // 3. Insert corrected transcript
  const fullText = CURATED_SEGMENTS.map((s) => s.text).join(' ');
  const { data: tRow, error: tErr } = await supabase
    .from('transcripts')
    .insert({
      video_id: VIDEO_DB_ID,
      full_text: fullText,
      language: 'de',
      source_type: 'manual',
    } as any)
    .select('id')
    .single();
  if (tErr || !tRow) {
    console.error('Transcript insert error:', tErr);
    process.exit(1);
  }
  console.log(`New transcript inserted (ID: ${(tRow as any).id})`);

  // 4. Ensure has_transcript flag
  await supabase.from('videos').update({ has_transcript: true } as any).eq('id', VIDEO_DB_ID);

  // 5. Generate embeddings
  console.log('Generating embeddings...');
  const texts = CURATED_SEGMENTS.map((s) => s.text);
  const embRes = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts,
    encoding_format: 'float',
  });
  const embeddings = embRes.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
  console.log(`Embeddings generated: ${embeddings.length} x ${embeddings[0].length} dimensions`);

  // 6. Generate summaries
  console.log('Generating summaries...');
  const summaries: string[] = [];
  for (const t of texts) {
    const r = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      max_tokens: 50,
      messages: [
        { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
        { role: 'user', content: t },
      ],
    });
    const summary = r.choices[0]?.message?.content?.trim() ?? '';
    summaries.push(summary);
    console.log(`  Summary: "${summary}"`);
  }

  // 7. Insert new segments
  const segRows = CURATED_SEGMENTS.map((s, i) => ({
    video_id: VIDEO_DB_ID,
    transcript_id: (tRow as any).id,
    text: s.text,
    summary: summaries[i] || null,
    start_time: s.startTime,
    end_time: s.endTime,
    embedding: embeddings[i],
  }));

  const { error: sErr } = await supabase.from('segments').insert(segRows as any);
  if (sErr) {
    console.error('Segment insert error:', sErr);
    process.exit(1);
  }

  // 8. Verify
  const { data: inserted } = await supabase
    .from('segments')
    .select('id, start_time, end_time, summary')
    .eq('video_id', VIDEO_DB_ID)
    .order('start_time', { ascending: true });

  console.log(`\nSUCCESS: ${(inserted as any[])?.length} curated segments inserted:\n`);
  for (const seg of (inserted as any[]) || []) {
    console.log(`  [${seg.start_time.toFixed(1)}s - ${seg.end_time.toFixed(1)}s] ${seg.summary}`);
  }
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});

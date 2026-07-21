export type CertConfirmation = {
  reference: string;
  bookingId: string;
  createdAt: string;
  traveler: { firstName: string; lastName: string };
  flight: { title: string; detail: string };
  hotel: { title: string; detail: string };
};

const escapePdf = (value: string) => value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

const wrap = (value: string, width = 76) => {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > width && line) { lines.push(line); line = word; }
    else line = next;
  }
  if (line) lines.push(line);
  return lines;
};

/**
 * Minimal, dependency-free PDF generator for the downloadable CERT receipt.
 * It deliberately contains no ticket-style claims: the returned Sabre
 * reference and the CERT/non-travel disclaimer are the most prominent facts.
 */
export const certConfirmationPdf = (confirmation: CertConfirmation): Buffer => {
  const lines = [
    'ODYSSEY.AI',
    'SABRE CERT TEST BOOKING - NOT VALID FOR TRAVEL',
    '',
    `Sabre reference: ${confirmation.reference}`,
    `Odyssey test booking ID: ${confirmation.bookingId}`,
    `Created: ${new Date(confirmation.createdAt).toISOString()}`,
    '',
    `Test traveler: ${confirmation.traveler.firstName} ${confirmation.traveler.lastName}`,
    '',
    'SELECTED FLIGHT',
    ...wrap(confirmation.flight.title),
    ...wrap(confirmation.flight.detail),
    '',
    'SELECTED HOTEL',
    ...wrap(confirmation.hotel.title),
    ...wrap(confirmation.hotel.detail),
    '',
    'This confirmation was generated from a Sabre CERT response. It is for',
    'integration testing only and is not an airline ticket, hotel voucher,',
    'or valid travel document.',
  ];
  const stream = [
    'BT',
    '/F1 18 Tf',
    '56 760 Td',
    `(${escapePdf(lines[0])}) Tj`,
    '/F1 11 Tf',
    '0 -30 Td',
    ...lines.slice(1).flatMap((line) => [`(${escapePdf(line)}) Tj`, '0 -17 Td']),
    'ET',
  ].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, 'utf8');
};

import React from 'react';
import {Document, Page, Text, View, StyleSheet, Font} from '@react-pdf/renderer';

interface CertificateDocumentProps {
  studentName: string;
  courseName: string;
  issuedAt: string; // already formatted, e.g. "20 July 2026"
  certificateId: string;
}

Font.register({
  family: 'Roboto',
  fonts: [
    {src: 'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxP.ttf'},
    {
      src: 'https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmEU9fBBc9.ttf',
      fontWeight: 700,
    },
  ],
});

// Landscape, centered layout — deliberately plain for v1. A background image /
// logo can be added later via an <Image> node once the design team has assets;
// keeping this text-only for the first PR so it's easy to review.
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Roboto',
    padding: 60,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid #1e2327',
    margin: 20,
  },
  eyebrow: {
    fontSize: 12,
    letterSpacing: 3,
    color: '#666',
    marginBottom: 20,
  },
  studentName: {
    fontSize: 28,
    fontWeight: 700,
    marginBottom: 10,
  },
  body: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
    textAlign: 'center',
  },
  courseName: {
    fontSize: 18,
    fontWeight: 700,
    marginTop: 6,
    marginBottom: 30,
    textAlign: 'center',
  },
  footer: {
    fontSize: 9,
    color: '#999',
    marginTop: 40,
  },
});

export default function CertificateDocument({
  studentName,
  courseName,
  issuedAt,
  certificateId,
}: CertificateDocumentProps) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.eyebrow}>CERTIFICATE OF COMPLETION</Text>
        <Text style={styles.studentName}>{studentName}</Text>
        <Text style={styles.body}>has successfully completed</Text>
        <Text style={styles.courseName}>{courseName}</Text>
        <Text style={styles.body}>Issued on {issuedAt}</Text>
        <Text style={styles.footer}>
          Certificate ID: {certificateId} — verify at /certificates/{certificateId}
        </Text>
      </Page>
    </Document>
  );
}

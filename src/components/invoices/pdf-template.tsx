import React from 'react'
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'
import { format } from 'date-fns'

// Define styles
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 30,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eeeeee',
    paddingBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#111111',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  col: {
    flexDirection: 'column',
  },
  label: {
    fontSize: 10,
    color: '#666666',
    marginBottom: 4,
  },
  value: {
    fontSize: 12,
    color: '#111111',
    marginBottom: 10,
  },
  section: {
    marginTop: 20,
    marginBottom: 20,
  },
  table: {
    marginTop: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#eeeeee',
    padding: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eeeeee',
    padding: 8,
  },
  colDesc: {
    width: '50%',
  },
  colQty: {
    width: '15%',
    textAlign: 'right',
  },
  colPrice: {
    width: '15%',
    textAlign: 'right',
  },
  colTotal: {
    width: '20%',
    textAlign: 'right',
  },
  headerText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#444444',
  },
  cellText: {
    fontSize: 10,
    color: '#111111',
  },
  totals: {
    marginTop: 20,
    alignItems: 'flex-end',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 5,
  },
  totalLabel: {
    width: 100,
    fontSize: 10,
    color: '#666666',
    textAlign: 'right',
    paddingRight: 10,
  },
  totalValue: {
    width: 100,
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    textAlign: 'center',
    fontSize: 10,
    color: '#999999',
    borderTopWidth: 1,
    borderTopColor: '#eeeeee',
    paddingTop: 10,
  },
})

interface InvoicePDFProps {
  invoice: any
  organization: any
}

const formatCurrency = (amount: number, currency: string = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount / 100)
}

export const InvoicePDF = ({ invoice, organization }: InvoicePDFProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.title}>INVOICE</Text>
            <Text style={styles.value}>#{invoice.invoice_number}</Text>
          </View>
          <View style={[styles.col, { alignItems: 'flex-end' }]}>
            <Text style={[styles.value, { fontSize: 16, fontWeight: 'bold' }]}>{organization.name}</Text>
            {organization.metadata?.address && (
              <Text style={styles.label}>{organization.metadata.address}</Text>
            )}
            {organization.metadata?.email && (
              <Text style={styles.label}>{organization.metadata.email}</Text>
            )}
          </View>
        </View>
      </View>

      {/* Details */}
      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={styles.label}>Bill To:</Text>
          {/* Note: In a real app we'd need client details here. 
              Assuming invoice.organization contains client info or we pass it separately 
              For now using placeholder or if invoice has client data joined
          */}
          <Text style={styles.value}>{invoice.client_name || 'Client'}</Text>
        </View>
        <View style={styles.col}>
          <Text style={styles.label}>Issue Date:</Text>
          <Text style={styles.value}>{format(new Date(invoice.issue_date), 'MMM dd, yyyy')}</Text>
          <Text style={styles.label}>Due Date:</Text>
          <Text style={styles.value}>{format(new Date(invoice.due_date), 'MMM dd, yyyy')}</Text>
        </View>
      </View>

      {/* Line Items */}
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <View style={styles.colDesc}><Text style={styles.headerText}>Description</Text></View>
          <View style={styles.colQty}><Text style={styles.headerText}>Qty</Text></View>
          <View style={styles.colPrice}><Text style={styles.headerText}>Price</Text></View>
          <View style={styles.colTotal}><Text style={styles.headerText}>Amount</Text></View>
        </View>
        {invoice.line_items?.map((item: any, index: number) => (
          <View key={index} style={styles.tableRow}>
            <View style={styles.colDesc}><Text style={styles.cellText}>{item.description}</Text></View>
            <View style={styles.colQty}><Text style={styles.cellText}>{item.quantity}</Text></View>
            <View style={styles.colPrice}><Text style={styles.cellText}>{formatCurrency(item.unit_price, invoice.currency)}</Text></View>
            <View style={styles.colTotal}><Text style={styles.cellText}>{formatCurrency(item.amount, invoice.currency)}</Text></View>
          </View>
        ))}
      </View>

      {/* Totals */}
      <View style={styles.totals}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Subtotal:</Text>
          <Text style={styles.totalValue}>{formatCurrency(invoice.subtotal, invoice.currency)}</Text>
        </View>
        {invoice.tax_amount > 0 && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Tax:</Text>
            <Text style={styles.totalValue}>{formatCurrency(invoice.tax_amount, invoice.currency)}</Text>
          </View>
        )}
        {invoice.discount_amount > 0 && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Discount:</Text>
            <Text style={styles.totalValue}>-{formatCurrency(invoice.discount_amount, invoice.currency)}</Text>
          </View>
        )}
        <View style={[styles.totalRow, { marginTop: 5 }]}>
          <Text style={[styles.totalLabel, { fontSize: 12, fontWeight: 'bold', color: '#111' }]}>Total:</Text>
          <Text style={[styles.totalValue, { fontSize: 14 }]}>{formatCurrency(invoice.total, invoice.currency)}</Text>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text>Thank you for your business!</Text>
        {invoice.notes && <Text style={{ marginTop: 5 }}>{invoice.notes}</Text>}
      </View>
    </Page>
  </Document>
)

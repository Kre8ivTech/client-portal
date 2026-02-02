'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, User, Mail, Trash2, Send, Loader2, CheckCircle, Clock } from 'lucide-react'
import { sendContractForSignature } from '@/lib/actions/contracts'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

interface Signer {
  email: string
  name: string
  role: 'client' | 'company_representative' | 'witness' | 'approver'
  signing_order: number
}

interface ContractSignersProps {
  contractId: string
  initialSigners: any[]
  status: string
  client: { name: string; email: string }
}

export function ContractSigners({ contractId, initialSigners, status, client }: ContractSignersProps) {
  const [signers, setSigners] = useState<Signer[]>(
    initialSigners.length > 0 
      ? initialSigners.map(s => ({ 
          email: s.email, 
          name: s.name, 
          role: s.role, 
          signing_order: s.signing_order 
        }))
      : [{ email: client.email, name: client.name, role: 'client', signing_order: 1 }]
  )
  const [loading, setLoading] = useState(false)
  const [isSent, setIsSent] = useState(status !== 'draft')

  const addSigner = () => {
    setSigners([...signers, { email: '', name: '', role: 'approver', signing_order: signers.length + 1 }])
  }

  const removeSigner = (index: number) => {
    const newSigners = signers.filter((_, i) => i !== index)
    // Update signing orders
    const updatedSigners = newSigners.map((s, i) => ({ ...s, signing_order: i + 1 }))
    setSigners(updatedSigners)
  }

  const updateSigner = (index: number, field: keyof Signer, value: any) => {
    const newSigners = [...signers]
    newSigners[index] = { ...newSigners[index], [field]: value }
    setSigners(newSigners)
  }

  const handleSend = async () => {
    setLoading(true)
    try {
      const result = await sendContractForSignature(contractId, signers)
      if (result.success) {
        setIsSent(true)
        window.location.reload() // Refresh to show updated status
      } else {
        alert(result.error || 'Failed to send contract')
      }
    } catch (err) {
      alert('An expected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-4">
        {signers.map((signer, index) => (
          <div key={index} className="relative p-4 rounded-xl border border-slate-200 bg-white shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase tracking-widest">
                Signer {index + 1}
              </span>
              {!isSent && signers.length > 1 && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 text-slate-400 hover:text-red-500"
                  onClick={() => removeSigner(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-tighter">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input 
                    value={signer.name} 
                    onChange={(e) => updateSigner(index, 'name', e.target.value)}
                    disabled={isSent}
                    placeholder="Signature Name"
                    className="pl-9 h-9 text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-tighter">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input 
                    value={signer.email} 
                    onChange={(e) => updateSigner(index, 'email', e.target.value)}
                    disabled={isSent}
                    placeholder="email@example.com"
                    className="pl-9 h-9 text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-tighter">Role</Label>
                <Select 
                  value={signer.role} 
                  onValueChange={(v) => updateSigner(index, 'role', v)}
                  disabled={isSent}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="client">Client</SelectItem>
                    <SelectItem value="company_representative">Company Rep</SelectItem>
                    <SelectItem value="witness">Witness</SelectItem>
                    <SelectItem value="approver">Approver</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        ))}
      </div>

      {!isSent ? (
        <div className="space-y-4 pt-2">
          <Button 
            variant="outline" 
            className="w-full border-dashed border-slate-300 text-slate-500 hover:text-primary hover:border-primary gap-2"
            onClick={addSigner}
          >
            <Plus className="h-4 w-4" />
            Add Another Signer
          </Button>
          
          <Button 
            className="w-full bg-primary hover:bg-primary/90 py-6 font-bold shadow-lg shadow-primary/20"
            disabled={loading || signers.some(s => !s.email || !s.name)}
            onClick={handleSend}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send for Signature
              </>
            )}
          </Button>
        </div>
      ) : (
        <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex flex-col items-center text-center gap-2">
          <div className="h-10 w-10 bg-emerald-500 text-white rounded-full flex items-center justify-center">
            <CheckCircle className="h-6 w-6" />
          </div>
          <h4 className="font-bold text-emerald-900">Successfully Sent</h4>
          <p className="text-xs text-emerald-700">All signers have been notified via email through DocuSign.</p>
        </div>
      )}
    </div>
  )
}

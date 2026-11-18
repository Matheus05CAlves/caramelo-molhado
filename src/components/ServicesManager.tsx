import { useEffect, useState } from 'react'
import { Pencil, Plus, Scissors } from 'lucide-react'
import { Badge, Button, Card, Empty, IconButton, Input, Modal, Select, Textarea, Toggle } from './ui'
import { db, useAction, useApp, useQuery } from '../lib/store'
import { CATEGORIES } from '../lib/domain'
import { brl } from '../lib/util'

function ServiceForm({ open, onClose, service }: { open: boolean; onClose: () => void; service?: any }) {
  const run = useAction()
  const { toast } = useApp()
  const [f, setF] = useState<any>({})
  useEffect(() => { if (open) setF(service || { name: '', category: 'Outro', duration_min: 30, price: '', active: 1, client_visible: 1, description: '' }) }, [open, service])
  const set = (k: string) => (v: any) => setF((s: any) => ({ ...s, [k]: v }))
  const save = async () => {
    const price = Number(String(f.price).replace(',', '.'))
    if (!f.name?.trim()) return toast('Informe o nome do serviço.', 'error')
    if (!(Number(f.duration_min) >= 10)) return toast('A duração mínima é de 10 minutos.', 'error')
    if (isNaN(price) || price < 0) return toast('Preço inválido.', 'error')
    const data = { name: f.name.trim(), category: f.category, duration_min: Number(f.duration_min), price, active: f.active ? 1 : 0, client_visible: f.client_visible ? 1 : 0, description: (f.description || '').trim() }
    const ok = await run(async () => {
      if (service) await db.update('services', service.id, data)
      else await db.insert('services', { ...data, sort: 99 })
      await db.audit(service ? 'Editou serviço' : 'Criou serviço', 'Serviço', data.name)
      return true
    }, 'Serviço salvo.')
    if (ok) onClose()
  }
  return (
    <Modal open={open} onClose={onClose} size="sm" title={service ? 'Editar serviço' : 'Novo serviço'} footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button onClick={save}>Salvar serviço</Button></>}>
      <div className="m-stack grid grid-cols-2 gap-4">
        <Input className="col-span-2" label="Nome do serviço" required value={f.name} onChange={set('name')} autoFocus />
        <Select label="Categoria" value={f.category} onChange={set('category')} options={CATEGORIES} />
        <Input label="Duração (min)" type="number" min={10} step={5} value={f.duration_min} onChange={set('duration_min')} />
        <Input label="Preço (R$)" inputMode="decimal" value={f.price} onChange={set('price')} />
        <div className="pt-6"><Toggle checked={!!f.active} onChange={(v) => set('active')(v ? 1 : 0)} label="Ativo" /></div>
        <Textarea className="col-span-2" label="Descrição para o cliente" value={f.description || ''} onChange={set('description')} rows={2} placeholder="O que está incluído no serviço" />
        <div className="col-span-2"><Toggle checked={!!f.client_visible} onChange={(v) => set('client_visible')(v ? 1 : 0)} label="Aparece no app do cliente" hint="Desligue para serviços que só a equipe pode agendar." /></div>
      </div>
    </Modal>
  )
}

export function ServicesManager() {
  const { can } = useApp()
  const edit = can('services_edit')
  const { rows } = useQuery('SELECT * FROM services ORDER BY active DESC, sort, name')
  const [form, setForm] = useState<{ open: boolean; service?: any }>({ open: false })
  return (
    <Card className="p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div><h3 className="text-base font-extrabold">Serviços oferecidos</h3><p className="text-sm text-ink-muted">Nome, duração e preço usados nos agendamentos.</p></div>
        {edit && <Button icon={Plus} onClick={() => setForm({ open: true })}>Novo serviço</Button>}
      </div>
      {rows.length === 0 ? <Empty icon={Scissors} title="Nenhum serviço cadastrado" /> : (
        <div className="overflow-hidden rounded-2xl border border-paper-line">
          <table className="w-full text-sm">
            <thead className="bg-paper text-left text-xs font-semibold text-ink-muted"><tr><th className="px-4 py-3">Serviço</th><th>Categoria</th><th>Duração</th><th>Preço</th><th>Situação</th><th>App do cliente</th><th /></tr></thead>
            <tbody>
              {rows.map((s: any) => (
                <tr key={s.id} className="border-t border-paper-line">
                  <td className="px-4 py-3"><p className="font-bold">{s.name}</p>{s.description && <p className="max-w-xs truncate text-xs text-ink-muted">{s.description}</p>}</td><td className="text-ink-soft">{s.category}</td><td>{s.duration_min} min</td><td className="font-semibold">{brl(s.price)}</td>
                  <td><Badge tone={s.active ? 'green' : 'gray'} dot>{s.active ? 'Ativo' : 'Inativo'}</Badge></td>
                  <td>{s.client_visible ? <Badge tone="blue">Visível</Badge> : <Badge tone="gray">Oculto</Badge>}</td>
                  <td className="pr-3 text-right">{edit && <IconButton icon={Pencil} label="Editar" onClick={() => setForm({ open: true, service: s })} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ServiceForm open={form.open} service={form.service} onClose={() => setForm({ open: false })} />
    </Card>
  )
}
